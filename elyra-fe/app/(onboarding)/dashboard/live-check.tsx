"use client";

import { useAuth } from "@clerk/nextjs";
import { FaceLivenessDetectorCore } from "@aws-amplify/ui-react-liveness";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2, ShieldCheck, Video } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { endpoint } from "@/lib/onboarding";
import { BrowserLiveness } from "./browser-liveness";
import { Dating } from "./dating";

type Session =
  | {
      sessionId: string;
      mode: "browser";
    }
  | {
      sessionId: string;
      mode?: "aws";
      region: string;
      credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken: string;
        expiration: string;
      };
    };

export function LiveCheck({ activities, location }: { activities: string[]; location: string }) {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<{
    verified: boolean;
    available: boolean;
    mode?: "aws" | "browser" | null;
  } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(path: string, init?: RequestInit) {
    const token = await getToken();
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${endpoint}/api/live${path}`, {
      ...init,
      cache: "no-store",
      headers,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Verification failed.");
    return data;
  }

  useEffect(() => {
    let cancelled = false;
    void request("/status")
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((failure) => {
        if (!cancelled)
          setError(failure instanceof Error ? failure.message : "Could not load verification.");
      });
    return () => {
      cancelled = true;
    };
    // The authenticated dashboard mounts this check for the current account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setBusy(true);
    setError("");
    try {
      setSession(await request("/sessions", { method: "POST" }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not start verification.");
    } finally {
      setBusy(false);
    }
  }

  if (status?.verified) return <Dating initialActivities={activities} initialLocation={location} />;

  return (
    <section className="mt-6 space-y-5">
      <div className="rounded-2xl border border-border bg-background/60 p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-2xl sm:text-3xl font-medium text-foreground">
              Confirm you are present
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Complete a short live camera check before meeting people. Your live face is compared
              with your primary profile photo.
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!status && !error && (
          <div className="space-y-2" role="status" aria-label="Checking verification">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-44 rounded-full" />
          </div>
        )}

        {status && !status.available && (
          <Alert>
            <AlertCircle className="size-4 shrink-0 mt-0.5 text-primary" />
            <AlertDescription>
              Live verification needs service setup before matching can open.
            </AlertDescription>
          </Alert>
        )}

        {status?.available && !session && (
          <div>
            <Button disabled={busy} onClick={start}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Starting check…</span>
                </>
              ) : (
                <>
                  <Video className="size-4" />
                  <span>Start live verification</span>
                </>
              )}
            </Button>
          </div>
        )}

        {session && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card p-2 sm:p-4">
            {session.mode === "browser" ? (
              <BrowserLiveness
                onComplete={async (capture) => {
                  try {
                    const result = await request(`/sessions/${session.sessionId}/complete`, {
                      method: "POST",
                      headers: { "Content-Type": capture.type || "image/jpeg" },
                      body: capture,
                    });
                    setSession(null);
                    if (result.verified) setStatus({ verified: true, available: true, mode: "browser" });
                    else
                      setError(
                        "We could not confirm the live face match. Check lighting and try again.",
                      );
                  } catch (failure) {
                    setError(failure instanceof Error ? failure.message : "Verification failed.");
                    setSession(null);
                  }
                }}
                onCancel={() => setSession(null)}
              />
            ) : (
              <FaceLivenessDetectorCore
                sessionId={session.sessionId}
                region={session.region}
                config={{
                  credentialProvider: async () => ({
                    accessKeyId: session.credentials.accessKeyId,
                    secretAccessKey: session.credentials.secretAccessKey,
                    sessionToken: session.credentials.sessionToken,
                    expiration: new Date(session.credentials.expiration),
                  }),
                }}
                onAnalysisComplete={async () => {
                  try {
                    const result = await request(`/sessions/${session.sessionId}/complete`, {
                      method: "POST",
                    });
                    setSession(null);
                    if (result.verified) setStatus({ verified: true, available: true, mode: "aws" });
                    else
                      setError(
                        "We could not confirm the live face match. Check lighting and try again.",
                      );
                  } catch (failure) {
                    setError(failure instanceof Error ? failure.message : "Verification failed.");
                    setSession(null);
                  }
                }}
                onError={() => {
                  setError("Live capture stopped. Start a new session to try again.");
                  setSession(null);
                }}
                onUserCancel={() => setSession(null)}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
