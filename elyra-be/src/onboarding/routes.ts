import { randomUUID } from "node:crypto";
import { Router, raw, type Request } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { ApiError, lock, profileSchema } from "./profile.js";
import { createStorage, validateProfilePhoto } from "./storage.js";
import { photoLimit, photoTypes } from "./options.js";
import { dateActivities } from "../dating/options.js";

export type Storage = ReturnType<typeof createStorage>;
export const photoPath = (clerkId: string, id: string) => `${clerkId}/photos/${id}`;
export const staleAttempt = 120_000;
export const rawImage = (limit: number) => raw({ type: "image/*", limit });
const photoId = z.uuid();
const photoRequest = z.object({ type: z.enum(photoTypes), size: z.number().int().positive().max(photoLimit) });

export function clerkId(req: Request) {
  const auth = getAuth(req);
  if (!auth.isAuthenticated || !auth.userId) throw new ApiError(401, "Sign in to continue.");
  return auth.userId;
}

export async function editableUser(tx: Prisma.TransactionClient, id: string) {
  const user = await tx.user.findUnique({ where: { clerkId: id } });
  if (!user) throw new ApiError(409, "Complete your profile details first.");
  if (user.isOnboarded) throw new ApiError(409, "Onboarding is already complete.");
  if (user.verificationStatus === "PENDING") {
    const latest = await tx.verificationLog.findFirst({
      where: { userId: user.id, status: "PENDING" }, orderBy: { createdAt: "desc" },
    });
    if (latest && Date.now() - +latest.createdAt < staleAttempt) {
      throw new ApiError(409, "Verification is in progress.");
    }
    if (latest) await tx.verificationLog.update({
      where: { id: latest.id },
      data: { status: "REJECTED", aiCheckPassed: false, failureReason: "verification timeout" },
    });
    return tx.user.update({
      where: { id: user.id },
      data: { verificationStatus: "REJECTED", verificationNote: "verification timeout" },
    });
  }
  return user;
}

export function profileResponse(user: {
  profilePhotos: string[];
  primaryPhotoUrl: string | null;
  isOnboarded: boolean;
  verificationStatus: string;
  dateActivities: string[];
  location: string;
} | null) {
  return {
    photos: (user?.profilePhotos ?? []).map((url) => ({ id: url.split("/").at(-1), url })),
    primaryPhotoId: user?.primaryPhotoUrl?.split("/").at(-1) ?? null,
    isOnboarded: user?.isOnboarded ?? false,
    verificationStatus: user?.verificationStatus ?? "UNVERIFIED",
    dateActivities: user?.dateActivities ?? [],
    location: user?.location ?? "",
  };
}

export function onboardingRoutes(db: PrismaClient, storage: Storage) {
  const router = Router();
  router.use((req, res, next) => {
    clerkId(req);
    res.set("Cache-Control", "no-store");
    next();
  });

  router.get("/", async (req, res) => {
    const user = await db.user.findUnique({ where: { clerkId: clerkId(req) } });
    const parsed = profileSchema.safeParse(user);
    res.json({ ...profileResponse(user), profile: parsed.success ? parsed.data : null });
  });

  router.put("/profile", async (req, res) => {
    const profile = profileSchema.parse(req.body);
    const id = clerkId(req);
    const user = await db.$transaction(async (tx) => {
      await lock(tx, id);
      const existing = await tx.user.findUnique({ where: { clerkId: id } });
      if (existing) await editableUser(tx, id);
      const fields = { ...profile, bio: profile.bio || null };
      return tx.user.upsert({ where: { clerkId: id }, create: { clerkId: id, ...fields }, update: fields });
    });
    res.json(profileResponse(user));
  });

  router.put("/date-activities", async (req, res) => {
    const activities = z.array(z.enum(dateActivities)).min(1).max(5).parse(req.body?.activities);
    const id = clerkId(req);
    const user = await db.$transaction(async (tx) => {
      await lock(tx, id);
      const current = await tx.user.findUnique({ where: { clerkId: id } });
      if (!current?.isOnboarded) throw new ApiError(409, "Complete onboarding first.");
      return tx.user.update({ where: { id: current.id }, data: { dateActivities: activities } });
    });
    res.json({ activities: user.dateActivities });
  });

  router.post("/photos/upload-url", async (req, res) => {
    photoRequest.parse(req.body);
    const id = clerkId(req);
    const user = await db.$transaction(async (tx) => {
      await lock(tx, id);
      return editableUser(tx, id);
    });
    if (user.profilePhotos.length >= 5) throw new ApiError(409, "You can upload up to 5 photos.");
    res.json(storage.issue(id, randomUUID()));
  });

  router.put("/photos/:id", rawImage(photoLimit), async (req, res) => {
    const id = clerkId(req);
    const photo = photoId.parse(req.params.id);
    if (!storage.check(id, photo, Number(req.query.expires), req.query.signature)) {
      throw new ApiError(403, "The upload link is invalid or has expired. Request a new link.");
    }
    if (!Buffer.isBuffer(req.body)) throw new ApiError(415, "Choose a JPEG, PNG, or WebP image.");
    const { mime, clean } = await validateProfilePhoto(req.body);
    const path = photoPath(id, photo);
    const url = storage.url(path);
    const user = await db.$transaction(async (tx) => {
      await lock(tx, id);
      const current = await editableUser(tx, id);
      if (current.profilePhotos.includes(url)) return current;
      if (current.profilePhotos.length >= 5) throw new ApiError(409, "You can upload up to 5 photos.");
      await storage.upload(path, clean, mime);
      return tx.user.update({
        where: { id: current.id },
        data: { profilePhotos: { push: url }, primaryPhotoUrl: current.primaryPhotoUrl ?? url },
      });
    }, { timeout: 15_000 });
    res.json(profileResponse(user));
  });

  router.get("/photos/:id", async (req, res) => {
    const id = clerkId(req);
    const photo = photoId.parse(req.params.id);
    const url = storage.url(photoPath(id, photo));
    const user = await db.user.findUnique({ where: { clerkId: id } });
    if (!user?.profilePhotos.includes(url)) throw new ApiError(404, "Photo not found.");
    const { bytes, mime } = await storage.download(url, id);
    res.type(mime ?? "application/octet-stream").send(bytes);
  });

  router.patch("/photos/:id/primary", async (req, res) => {
    const id = clerkId(req);
    const url = storage.url(photoPath(id, photoId.parse(req.params.id)));
    const user = await db.$transaction(async (tx) => {
      await lock(tx, id);
      const current = await editableUser(tx, id);
      if (!current.profilePhotos.includes(url)) throw new ApiError(404, "Photo not found.");
      return tx.user.update({ where: { id: current.id }, data: { primaryPhotoUrl: url } });
    });
    res.json(profileResponse(user));
  });

  router.delete("/photos/:id", async (req, res) => {
    const id = clerkId(req);
    const path = photoPath(id, photoId.parse(req.params.id));
    const url = storage.url(path);
    const user = await db.$transaction(async (tx) => {
      await lock(tx, id);
      const current = await editableUser(tx, id);
      if (!current.profilePhotos.includes(url)) return current;
      const photos = current.profilePhotos.filter((photo) => photo !== url);
      return tx.user.update({
        where: { id: current.id },
        data: { profilePhotos: photos, primaryPhotoUrl: current.primaryPhotoUrl === url ? photos[0] ?? null : current.primaryPhotoUrl },
      });
    });
    await db.$transaction(async (tx) => {
      await lock(tx, id);
      const current = await tx.user.findUnique({ where: { clerkId: id } });
      if (!current?.profilePhotos.includes(url)) await storage.remove(path);
    }, { timeout: 15_000 }).catch(() => console.error("A private photo could not be removed from storage."));
    res.json(profileResponse(user));
  });

  return router;
}
