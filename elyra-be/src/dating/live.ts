import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  RekognitionClient,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
  CompareFacesCommand,
} from "@aws-sdk/client-rekognition";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { ApiError, lock } from "../onboarding/profile.js";
import { clerkId, rawImage, type Storage } from "../onboarding/routes.js";
import { createVerifier, optimizeImage, type VisionConfig } from "../onboarding/gemini.js";
import { selfieLimit } from "../onboarding/options.js";
import { validateImage } from "../onboarding/storage.js";

export function liveRoutes(
  db: PrismaClient,
  storage: Storage,
  region: string,
  roleArn: string,
  vision?: VisionConfig,
) {
  const router = Router();
  const rekognition = region ? new RekognitionClient({ region }) : null;
  const sts = region ? new STSClient({ region }) : null;
  const awsEnabled = Boolean(region && roleArn && rekognition && sts);
  const analyze = vision ? createVerifier(vision) : null;
  const browserEnabled = Boolean(!awsEnabled && analyze);
  router.use((req, res, next) => {
    clerkId(req);
    res.set("Cache-Control", "no-store");
    next();
  });

  router.get("/status", async (req, res) => {
    const user = await db.user.findUnique({ where: { clerkId: clerkId(req) } });
    res.json({
      verified: Boolean(user?.liveVerifiedAt && user.livePrimaryPhotoUrl === user.primaryPhotoUrl),
      available: awsEnabled || browserEnabled,
      mode: awsEnabled ? "aws" : browserEnabled ? "browser" : null,
    });
  });

  router.post("/sessions", async (req, res) => {
    const id = clerkId(req);
    if (!awsEnabled && !browserEnabled)
      throw new ApiError(503, "Live verification is not configured yet.");
    const reservationId = randomUUID();
    const user = await db.$transaction(async (tx) => {
      await lock(tx, `live:${id}`);
      const current = await tx.user.findUnique({ where: { clerkId: id } });
      if (
        !current?.isOnboarded ||
        !current.primaryPhotoUrl ||
        current.verificationStatus !== "VERIFIED"
      )
        throw new ApiError(409, "Complete profile setup first.");
      const count = await tx.liveSession.count({
        where: { userId: current.id, createdAt: { gt: new Date(Date.now() - 86400_000) } },
      });
      if (count >= 3)
        throw new ApiError(429, "Live verification limit reached. Try again tomorrow.");
      await tx.liveSession.create({
        data: { id: reservationId, userId: current.id, primaryPhotoUrl: current.primaryPhotoUrl },
      });
      return current;
    });
    if (browserEnabled) {
      res.status(201).json({ sessionId: reservationId, mode: "browser" });
      return;
    }
    let sessionId: string;
    try {
      const result = await rekognition!.send(
        new CreateFaceLivenessSessionCommand({
          ClientRequestToken: crypto.randomUUID(),
          Settings: { AuditImagesLimit: 0 },
        }),
      );
      if (!result.SessionId) throw new Error("Missing session ID");
      sessionId = result.SessionId;
    } catch (error) {
      await db.liveSession.deleteMany({ where: { id: reservationId } });
      console.error(
        "Live session creation failed",
        error instanceof Error ? error.name : "Unknown error",
      );
      throw new ApiError(503, "Live verification is temporarily unavailable.");
    }
    await db.liveSession.update({ where: { id: reservationId }, data: { id: sessionId } });
    let credentials;
    try {
      const result = await sts!.send(
        new AssumeRoleCommand({
          RoleArn: roleArn,
          RoleSessionName: `elyra-live-${user.id.slice(0, 12)}`,
          DurationSeconds: 900,
          Policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              { Effect: "Allow", Action: ["rekognition:StartFaceLivenessSession"], Resource: "*" },
            ],
          }),
        }),
      );
      credentials = result.Credentials;
      if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken)
        throw new Error("Missing temporary credentials");
    } catch (error) {
      await db.liveSession.deleteMany({ where: { id: sessionId, result: "PENDING" } });
      console.error(
        "Live streaming credentials failed",
        error instanceof Error ? error.name : "Unknown error",
      );
      throw new ApiError(503, "Live verification is temporarily unavailable.");
    }
    res.status(201).json({
      sessionId,
      mode: "aws",
      region,
      credentials: {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
        expiration: credentials.Expiration,
      },
    });
  });

  router.post("/sessions/:id/complete", rawImage(selfieLimit - 1), async (req, res) => {
    const id = clerkId(req);
    if (!awsEnabled && !browserEnabled)
      throw new ApiError(503, "Live verification is not configured yet.");
    const session = await db.liveSession.findUnique({
      where: { id: String(req.params.id) },
      include: { user: true },
    });
    if (!session || session.user.clerkId !== id) throw new ApiError(404, "Session not found.");
    if (session.completedAt) {
      res.json({ verified: session.result === "VERIFIED", result: session.result });
      return;
    }
    if (Date.now() - +session.createdAt > 180_000)
      throw new ApiError(410, "Live session expired. Start again.");
    let verified = false;
    if (browserEnabled && analyze) {
      if (!Buffer.isBuffer(req.body)) throw new ApiError(415, "Capture a JPEG or PNG selfie.");
      await validateImage(req.body, ["image/jpeg", "image/png"], selfieLimit - 1);
      const selfie = await optimizeImage(req.body);
      try {
        const photo = await storage.download(session.primaryPhotoUrl, id);
        const profile = await optimizeImage(photo.bytes);
        const result = await analyze(selfie, profile);
        verified = !result.failure;
      } catch (error) {
        if (error instanceof ApiError && error.status < 500) throw error;
        console.error(
          "Browser live verification failed",
          error instanceof Error ? error.name : "Unknown error",
        );
        throw new ApiError(503, "Live verification is temporarily unavailable.");
      }
    } else {
      let result;
      try {
        result = await rekognition!.send(
          new GetFaceLivenessSessionResultsCommand({ SessionId: session.id }),
        );
      } catch (error) {
        console.error(
          "Live result retrieval failed",
          error instanceof Error ? error.name : "Unknown error",
        );
        throw new ApiError(503, "Live verification is temporarily unavailable.");
      }
      if (result.Status === "CREATED" || result.Status === "IN_PROGRESS")
        throw new ApiError(409, "Live capture is still in progress.");
      if (
        result.Status === "SUCCEEDED" &&
        (result.Confidence ?? 0) >= 90 &&
        result.ReferenceImage?.Bytes
      ) {
        try {
          const photo = await storage.download(session.primaryPhotoUrl, id);
          const optimized = await optimizeImage(photo.bytes);
          const comparison = await rekognition!.send(
            new CompareFacesCommand({
              SourceImage: { Bytes: result.ReferenceImage.Bytes },
              TargetImage: { Bytes: optimized },
              SimilarityThreshold: 90,
            }),
          );
          verified = (comparison.FaceMatches ?? []).some((face) => (face.Similarity ?? 0) >= 90);
        } catch (error) {
          console.error(
            "Live face comparison failed",
            error instanceof Error ? error.name : "Unknown error",
          );
          throw new ApiError(503, "Face comparison is temporarily unavailable.");
        }
      }
    }
    await db.$transaction(async (tx) => {
      await lock(tx, `live:${id}`);
      const current = await tx.user.findUniqueOrThrow({ where: { id: session.userId } });
      const update = await tx.liveSession.updateMany({
        where: { id: session.id, completedAt: null },
        data: { completedAt: new Date(), result: verified ? "VERIFIED" : "REJECTED" },
      });
      if (update.count && verified && current.primaryPhotoUrl === session.primaryPhotoUrl) {
        await tx.user.update({
          where: { id: current.id },
          data: { liveVerifiedAt: new Date(), livePrimaryPhotoUrl: session.primaryPhotoUrl },
        });
      }
    });
    res.json({ verified, result: verified ? "VERIFIED" : "REJECTED" });
  });

  return router;
}
