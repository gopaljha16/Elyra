import { createHmac, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { Router } from "express";
import { createGemini, GeminiError, optimizeImage } from "./gemini.js";
import { selfieLimit } from "./options.js";
import { ApiError, lock, profileSchema } from "./profile.js";
import { clerkId, editableUser, rawImage, staleAttempt, type Storage } from "./routes.js";
import { validateImage } from "./storage.js";

const hour = 3_600_000;
const day = 24 * hour;

async function recentAttempts(tx: Prisma.TransactionClient, userId: string, now: Date) {
  return tx.verificationLog.findMany({
    where: { userId, createdAt: { gt: new Date(+now - day) } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, status: true, failureReason: true },
  });
}

function retrySeconds(date: Date, window: number, now: Date) {
  return Math.max(1, Math.ceil((+date + window - +now) / 1000));
}

class RateError extends ApiError {
  constructor(message: string, public retryAfter: number) { super(429, message); }
}

type VerificationConfig = {
  geminiKey: string;
  geminiModel: string;
  ipHashKey: string;
  adminIds: string[];
};

export function verificationRoutes(db: PrismaClient, storage: Storage, config: VerificationConfig) {
  const router = Router({ mergeParams: true });
  const analyze = createGemini(config.geminiKey, config.geminiModel);

  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  router.get("/verification", async (req, res) => {
    const user = await db.user.findUnique({ where: { clerkId: clerkId(req) } });
    const now = new Date();
    const rows = user ? await recentAttempts(db, user.id, now) : [];
    const latest = rows.at(-1);
    const pending = latest?.status === "PENDING" && +now - +latest.createdAt < staleAttempt;
    res.json({
      verified: user?.isOnboarded ?? false,
      pending,
      reason: latest?.failureReason ?? (latest?.status === "PENDING" && !pending ? "verification timeout" : null),
      remaining: Math.max(0, 3 - rows.length),
      retryAfter: rows.length >= 3 ? retrySeconds(rows[0].createdAt, day, now) : null,
    });
  });

  router.post("/verification", (req, _res, next) => { clerkId(req); next(); }, rawImage(selfieLimit - 1), async (req, res) => {
    const id = clerkId(req);
    if (!Buffer.isBuffer(req.body)) throw new ApiError(415, "Capture a JPEG or PNG selfie.");
    await validateImage(req.body, ["image/jpeg", "image/png"], selfieLimit - 1);
    const selfie = await optimizeImage(req.body);
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const ipHash = createHmac("sha256", config.ipHashKey).update(ip).digest("hex");
    const attemptId = randomUUID();
    const selfiePath = `${id}/verification/${attemptId}`;
    const selfieUrl = storage.url(selfiePath);

    try {
      const attempt = await db.$transaction(async (tx) => {
        await lock(tx, id);
        // Lock and check shared IP usage before reserving a slot across instances.
        await lock(tx, `verification-ip:${ipHash}`);
        const user = await editableUser(tx, id);
        if (user.profilePhotos.length < 2 || !user.primaryPhotoUrl || !user.profilePhotos.includes(user.primaryPhotoUrl)) {
          throw new ApiError(409, "Upload at least two photos and choose a primary photo first.");
        }
        const profile = profileSchema.safeParse(user);
        if (!profile.success) throw new ApiError(409, "Complete your profile details first.");
        const now = new Date();
        const attempts = await recentAttempts(tx, user.id, now);
        if (attempts.length >= 3) {
          throw new RateError("You have used all three attempts. Contact support or try again later.",
            retrySeconds(attempts[0].createdAt, day, now));
        }
        const ipWhere = { attemptIpHash: ipHash, createdAt: { gt: new Date(+now - hour) } };
        if (await tx.verificationLog.count({ where: ipWhere }) >= 100) {
          const first = await tx.verificationLog.findFirstOrThrow({ where: ipWhere, orderBy: { createdAt: "asc" } });
          throw new RateError("Too many verification attempts from this connection. Try again later.",
            retrySeconds(first.createdAt, hour, now));
        }

        await tx.verificationLog.create({ data: {
          id: attemptId, userId: user.id, selfieUrl, attemptIpHash: ipHash, reviewedBy: "ai", status: "PENDING",
        } });
        await tx.user.update({ where: { id: user.id }, data: { verificationStatus: "PENDING", verificationNote: null } });
        return { user, profile: profile.data, primaryPhotoUrl: user.primaryPhotoUrl, remaining: 2 - attempts.length };
      });

      let failure: string | null = null;
      let rawResponse: unknown = null;
      let serviceError: ApiError | null = null;
      let selfieStored = false;
      try {
        await storage.upload(selfiePath, selfie, "image/jpeg");
        selfieStored = true;
        const primary = await storage.download(attempt.primaryPhotoUrl, id);
        const profile = await optimizeImage(primary.bytes);
        const requestedAt = new Date();
        await db.verificationLog.update({ where: { id: attemptId }, data: {
          geminiRequestedAt: requestedAt, geminiImageBytes: selfie.length + profile.length,
        } });
        console.info("Gemini verification request", { userId: attempt.user.id, requestedAt, selfieBytes: selfie.length, profileBytes: profile.length });
        const result = await analyze(selfie, profile);
        failure = result.failure;
        rawResponse = result.raw;
      } catch (error) {
        serviceError = error instanceof ApiError ? error
          : new ApiError(503, "Service is temporarily unavailable. Please try again later.");
        failure = error instanceof GeminiError ? error.reason : serviceError.message;
        rawResponse = error instanceof GeminiError ? error.raw : null;
        console.error("Verification processing failed", { attemptId, reason: failure });
      }

      const status = failure ? "REJECTED" : "VERIFIED";
      await db.$transaction(async (tx) => {
        await lock(tx, id);
        const saved = await tx.verificationLog.updateMany({
          where: { id: attemptId, status: "PENDING" },
          data: { status, aiCheckPassed: !failure, aiReason: JSON.stringify(rawResponse), failureReason: failure },
        });
        if (saved.count !== 1) throw new ApiError(409, "This verification attempt expired. Try again.");
        await tx.user.update({ where: { id: attempt.user.id }, data: {
          ...(failure ? {} : { ...attempt.profile, bio: attempt.profile.bio || null }),
          verificationStatus: status, verificationNote: failure,
          verificationSelfieUrl: selfieStored ? selfieUrl : undefined,
          isOnboarded: !failure, verifiedAt: failure ? null : new Date(),
        } });
      });
      if (serviceError) {
        res.status(serviceError.status).json({ error: serviceError.message, reason: failure, remaining: attempt.remaining });
        return;
      }
      res.json({ verified: !failure, reason: failure, remaining: attempt.remaining });
    } catch (error) {
      if (error instanceof RateError) {
        res.set("Retry-After", String(error.retryAfter)).status(429).json({ error: error.message, retryAfter: error.retryAfter });
        return;
      }
      throw error;
    }
  });

  router.get("/verification/usage", async (req, res) => {
    const id = clerkId(req);
    if (!config.adminIds.includes(id)) throw new ApiError(403, "Administrator access required.");
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const daily = await db.$queryRaw<{ date: string; requests: number; imageBytes: number }[]>`
      SELECT to_char("geminiRequestedAt", 'YYYY-MM-DD') AS date,
        COUNT(*)::integer AS requests, SUM("geminiImageBytes")::double precision AS "imageBytes"
      FROM verification_logs WHERE "geminiRequestedAt" >= ${start} AND "geminiRequestedAt" < ${end}
      GROUP BY 1 ORDER BY 1
    `;
    res.json({ start, end, daily, requests: daily.reduce((sum, day) => sum + day.requests, 0),
      imageBytes: daily.reduce((sum, day) => sum + day.imageBytes, 0) });
  });

  return router;
}
