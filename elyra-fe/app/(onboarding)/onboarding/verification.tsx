"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Camera as CameraIcon, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { message, RequestError, type Api, type Attempt } from "@/lib/onboarding";
import { Camera } from "./camera";

function failureMessage(reason: string | null) {
  if (reason === "liveness check failed")
    return "We could not confirm the selfie looked like a live capture. Try again in even lighting.";
  if (reason === "face mismatch")
    return "The selfie did not match your primary photo. Use a clear, recent photo of yourself.";
  if (reason === "verification timeout") return "Verification timed out. Try again.";
  return reason ? "Your last verification attempt could not be completed." : "";
}

export function Verification({
  api,
  onBack,
  onComplete,
}: {
  api: Api;
  onBack: () => void;
  onComplete: () => void;
}) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [notice, setNotice] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [selfie, setSelfie] = useState<{ file: Blob; preview: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reload, setReload] = useState(0);
  const [recapture, setRecapture] = useState(0);
  const [closedCamera, setClosedCamera] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const status: Attempt = await (
          await api("/verification", { signal: controller.signal })
        ).json();
        if (controller.signal.aborted) return;
        if (status.verified) {
          onComplete();
          return;
        }
        setAttempt(status);
        setNotice(failureMessage(status.reason));
        const delay = status.pending ? 3000 : status.retryAfter ? status.retryAfter * 1000 : null;
        if (delay) timer = setTimeout(load, delay);
      } catch (error) {
        if (!controller.signal.aborted) setNotice(message(error));
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [api, onComplete, reload]);

  useEffect(() => {
    const preview = selfie?.preview;
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [selfie?.preview]);

  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(
      () => {
        setRetryAt(0);
        setReload((n) => n + 1);
      },
      Math.max(0, retryAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [retryAt]);

  async function submit() {
    if (!selfie) return;
    setSubmitting(true);
    setNotice("");
    let keepSelfie = false;
    try {
      const result: Attempt = await (
        await api("/verification", { method: "POST", body: selfie.file })
      ).json();
      if (result.verified) {
        onComplete();
        return;
      }
      setAttempt(result);
      if (result.retryAfter) setRetryAt(Date.now() + result.retryAfter * 1000);
      setNotice(failureMessage(result.reason));
    } catch (error) {
      setNotice(message(error));
      if (error instanceof RequestError) {
        if (typeof error.remaining === "number")
          setAttempt((previous) => previous && { ...previous, remaining: error.remaining! });
        if (error.retryAfter) setRetryAt(Date.now() + error.retryAfter * 1000);
        if (error.status === 409) setReload((n) => n + 1);
        keepSelfie = error.status >= 500 || error.status === 429;
      } else {
        keepSelfie = true;
      }
    } finally {
      if (!keepSelfie) {
        setSelfie(null);
        setClosedCamera(true);
      }
      setSubmitting(false);
    }
  }

  const exhausted = attempt?.remaining === 0;
  const pending = Boolean(attempt?.pending);
  const blocked = exhausted || pending || retryAt > 0;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl sm:text-5xl font-medium leading-[1.06] tracking-tight text-foreground">
          Verify it is you
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Take a clear selfie in good light. When you submit it, Elyra securely compares your selfie
          with your primary photo.
        </p>
      </div>

      {notice && (
        <Alert variant="destructive">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {!attempt && !notice && (
        <p className="text-sm text-muted-foreground flex items-center gap-2" role="status">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span>Checking verification status...</span>
        </p>
      )}

      {!attempt && notice && (
        <Button
          variant="outline"
          onClick={() => {
            setNotice("");
            setReload((n) => n + 1);
          }}
        >
          <RefreshCw className="size-4" />
          <span>Check again</span>
        </Button>
      )}

      {pending && (
        <Alert>
          <Loader2 className="size-4 animate-spin text-primary shrink-0 mt-0.5" />
          <AlertDescription role="status">
            Your verification is in progress. You can leave this page and come back.
          </AlertDescription>
        </Alert>
      )}

      {exhausted && !pending && (
        <p className="text-sm text-muted-foreground">
          You have used all three attempts. Contact Elyra support or try again when an attempt
          becomes available.
        </p>
      )}

      {attempt && !pending && (
        <Badge variant="secondary" aria-live="polite">
          {attempt.remaining} {attempt.remaining === 1 ? "attempt" : "attempts"} available
        </Badge>
      )}

      {attempt &&
        !blocked &&
        !selfie &&
        (closedCamera ? (
          <div>
            <Button
              onClick={() => {
                setNotice("");
                setClosedCamera(false);
                setRecapture((n) => n + 1);
              }}
            >
              <CameraIcon className="size-4" />
              <span>Try another selfie</span>
            </Button>
          </div>
        ) : (
          <Camera
            key={recapture}
            onCapture={(file) => setSelfie({ file, preview: URL.createObjectURL(file) })}
          />
        ))}

      {selfie && (
        <div className="space-y-4">
          <div className="relative grid place-items-center overflow-hidden aspect-[4/3] rounded-2xl bg-[#2e1924]">
            <Image
              unoptimized
              src={selfie.preview}
              alt="Your verification selfie"
              width={640}
              height={480}
              className="size-full object-contain"
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button variant="ghost" disabled={submitting} onClick={() => setSelfie(null)}>
              Retake
            </Button>
            <Button disabled={submitting} onClick={submit}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Submit selfie</span>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button variant="ghost" disabled={submitting} onClick={onBack}>
          <ArrowLeft className="size-4" />
          <span>Back to photos</span>
        </Button>
      </div>
    </div>
  );
}
