import { createHmac, timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import { ApiError } from "./profile.js";
import { photoLimit, photoTypes } from "./options.js";

const unavailable = "Photo upload service is temporarily unavailable. Please try again later.";
const formats: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function validateImage(bytes: Buffer, allowed: readonly string[], maxBytes: number) {
  if (bytes.length > maxBytes)
    throw new ApiError(
      413,
      maxBytes === photoLimit
        ? "Each photo must be 5 MB or smaller."
        : "Image size exceeds maximum allowed",
    );
  let format: string | undefined;
  try {
    format = (await sharp(bytes, { limitInputPixels: 25_000_000 }).metadata()).format;
  } catch {
    throw new ApiError(400, "Choose a readable image.");
  }
  const mime = format && formats[format];
  if (!mime || !allowed.includes(mime)) throw new ApiError(415, "Unsupported image format.");
  return mime;
}

export function createStorage(projectUrl: string, serviceKey: string, bucket: string) {
  const root = new URL("/storage/v1/object/", projectUrl).href;
  const bucketPath = encodeURIComponent(bucket);
  const authHeaders = serviceKey.startsWith("sb_secret_")
    ? { apikey: serviceKey }
    : { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const objectPath = (path: string) => path.split("/").map(encodeURIComponent).join("/");
  const url = (path: string) => root + "authenticated/" + bucketPath + "/" + objectPath(path);
  const signature = (userId: string, id: string, expires: number) =>
    createHmac("sha256", serviceKey)
      .update(JSON.stringify(["photo-upload", userId, id, expires]))
      .digest();

  async function request(path: string, init: RequestInit = {}) {
    try {
      const result = await fetch(root + path, {
        ...init,
        headers: { ...authHeaders, ...init.headers },
        signal: AbortSignal.timeout(10_000),
      });
      if (!result.ok) {
        console.error("Supabase Storage request failed", result.status);
        throw new Error("Storage request failed");
      }
      return result;
    } catch {
      throw new ApiError(503, unavailable);
    }
  }

  return {
    url,
    issue(userId: string, id: string) {
      const expires = Date.now() + 3_600_000;
      const token = signature(userId, id, expires).toString("hex");
      return {
        uploadPath: `/api/onboarding/photos/${id}?expires=${expires}&signature=${token}`,
        expires,
      };
    },
    check(userId: string, id: string, expires: number, token: unknown) {
      return (
        Number.isSafeInteger(expires) &&
        expires >= Date.now() &&
        typeof token === "string" &&
        /^[a-f0-9]{64}$/.test(token) &&
        timingSafeEqual(signature(userId, id, expires), Buffer.from(token, "hex"))
      );
    },
    async upload(path: string, bytes: Buffer, mime: string) {
      await request(bucketPath + "/" + objectPath(path), {
        method: "POST",
        body: new Uint8Array(bytes),
        headers: { "Content-Type": mime, "x-upsert": "true" },
      });
    },
    async download(objectUrl: string, userId: string) {
      if (!objectUrl.startsWith(url(`${userId}/`))) throw new ApiError(404, "Photo not found.");
      const result = await request(objectUrl.slice(root.length));
      return {
        bytes: Buffer.from(await result.arrayBuffer()),
        mime: result.headers.get("content-type"),
      };
    },
    async remove(path: string) {
      await request(bucketPath, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [path] }),
      });
    },
  };
}

export async function validateProfilePhoto(bytes: Buffer) {
  const mime = await validateImage(bytes, photoTypes, photoLimit);
  try {
    // Decode the entire image and discard metadata, including GPS coordinates.
    const clean = await sharp(bytes, { limitInputPixels: 25_000_000 })
      .rotate()
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .toBuffer();
    if (clean.length > photoLimit) throw new ApiError(413, "Each photo must be 5 MB or smaller.");
    return { mime, clean };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "Choose a readable image.");
  }
}
