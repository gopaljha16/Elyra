export const endpoint = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export type Profile = {
  name: string;
  age: number;
  gender: string;
  location: string;
  bio?: string;
  interests: string[];
  personalityAnswers: { weekend: string; connection: string; spontaneity: string };
  preferences: {
    minAge: number;
    maxAge: number;
    gender: string;
    maxDistance: number;
    relationship: string;
  };
};

export type PhotoStatus = {
  photos: { id: string; url: string }[];
  primaryPhotoId: string | null;
  isOnboarded: boolean;
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  dateActivities: string[];
  location: string;
};

export type OnboardingStatus = PhotoStatus & { profile: Profile | null };

export type Attempt = {
  verified: boolean;
  reason: string | null;
  remaining: number;
  retryAfter?: number | null;
  pending?: boolean;
};

export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public remaining?: number,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export async function onboardingRequest(path: string, token: string | null, init?: RequestInit) {
  if (!token) throw new RequestError("Sign in to continue.", 401);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  let result: Response;
  try {
    result = await fetch(`${endpoint.replace(/\/$/, "")}/api/onboarding${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new RequestError("Could not connect to Elyra. Check your connection and try again.", 503);
  }
  if (!result.ok) {
    const data = await result.json().catch(() => null);
    throw new RequestError(
      data?.error ?? "Something went wrong. Try again.",
      result.status,
      data?.remaining,
      data?.retryAfter,
    );
  }
  return result;
}

export type Api = (path: string, init?: RequestInit) => Promise<Response>;

export function json(method: string, data: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) };
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
