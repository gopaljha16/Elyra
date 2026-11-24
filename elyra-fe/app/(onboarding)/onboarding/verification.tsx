"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { message, RequestError, type Api, type Attempt } from "@/lib/onboarding";
import { Camera } from "./camera";

function failureMessage(reason: string | null) {
  if (reason === "liveness check failed")
    return "We couldnâ€™t confirm the selfie looked like a live capture. Try again in even lighting.";
  if (reason === "face mismatch")
    return "The selfie didnâ€™t match your primary photo. Use a clear, recent photo of yourself.";
  if (reason === "verification timeout") return "Verification timed out. Try again.";
  return reason ? "Your last verification attempt couldnâ€™t be completed." : "";
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
      }
    } finally {
      setSelfie(null);
      setClosedCamera(true);
      setSubmitting(false);
    }
  }

  const exhausted = attempt?.remaining === 0;
  const pending = Boolean(attempt?.pending);
  const blocked = exhausted || pending || retryAt > 0;
  return (
    <>
      <h1>Verify itâ€™s you</h1>
      <p>
        Take a clear selfie in good light. When you submit it, Elyra sends your selfie and primary
        photo to Google Gemini for comparison.
      </p>
      {notice && (
        <p className="notice" role="alert">
          {notice}
        </p>
      )}
      {!attempt && !notice && <p role="status">Checking verification statusâ€¦</p>}
      {!attempt && notice && (
        <button
          className="outline"
          onClick={() => {
            setNotice("");
            setReload((n) => n + 1);
          }}
        >
          Check again
        </button>
      )}
      {pending && (
        <p role="status">
          Your verification is in progress. You can leave this page and come back.
        </p>
      )}
      {exhausted && !pending && (
        <p>
          Youâ€™ve used all three attempts. Contact Elyra support or try again when an attempt
          becomes available.
        </p>
      )}
      {attempt && !pending && (
        <p className="step-label" aria-live="polite">
          {attempt.remaining} {attempt.remaining === 1 ? "attempt" : "attempts"} available
        </p>
      )}
      {attempt &&
        !blocked &&
        !selfie &&
        (closedCamera ? (
          <button
            className="action"
            onClick={() => {
              setNotice("");
              setClosedCamera(false);
              setRecapture((n) => n + 1);
            }}
          >
            Try another selfie
          </button>
        ) : (
          <Camera
            key={recapture}
            onCapture={(file) => setSelfie({ file, preview: URL.createObjectURL(file) })}
          />
        ))}
      {selfie && (
        <div>
          <div className="viewfinder">
            <Image
              unoptimized
              src={selfie.preview}
              alt="Your verification selfie"
              width={640}
              height={480}
            />
          </div>
          <div className="actions">
            <button className="quiet" disabled={submitting} onClick={() => setSelfie(null)}>
              Retake
            </button>
            <button className="action" disabled={submitting} onClick={submit}>
              {submitting ? "Verifyingâ€¦" : "Submit selfie"}
            </button>
          </div>
        </div>
      )}
      <div className="actions">
        <button className="quiet" disabled={submitting} onClick={onBack}>
          Back to photos
        </button>
      </div>
    </>
  );
}
