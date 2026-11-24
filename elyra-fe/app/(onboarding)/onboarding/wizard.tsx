"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { json, message, onboardingRequest, type Api, type OnboardingStatus, type PhotoStatus } from "@/lib/onboarding";
import { blankForm, formFromProfile, ProfileForm, type Form } from "./profile-form";
import { PhotoStep } from "./photos";
import { Verification } from "./verification";
import { Progress, Shell } from "./shell";
import { draftKey, discardDraft } from "./draft-storage";

type Draft = { stage: number; step: number; form: Form; photos: PhotoStatus["photos"] };

function restore(key: string, server: OnboardingStatus): Draft {
  const fallback: Draft = {
    stage: server.profile ? (server.photos.length >= 2 ? 3 : 2) : 0,
    step: 0, form: server.profile ? formFromProfile(server.profile) : blankForm,
    photos: server.photos,
  };
  try {
    const draft = JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
    if (draft?.form && [0, 1, 2, 3].includes(draft.stage) && [0, 1, 2, 3].includes(draft.step)) {
      const stage = !server.profile && draft.stage >= 2 ? 1 : draft.stage === 3 && server.photos.length < 2 ? 2 : draft.stage;
      return { ...draft, stage, photos: server.photos };
    }
  } catch {
    // A browser may restrict local storage.
  }
  return fallback;
}

export function Wizard({ userId, initial }: { userId: string; initial: OnboardingStatus }) {
  const { getToken } = useAuth();
  const api: Api = useCallback(async (path, init) => onboardingRequest(path, await getToken(), init), [getToken]);
  const key = draftKey(userId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus>(initial);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) setDraft(restore(key, initial)); });
    return () => { cancelled = true; };
  }, [key, initial]);

  function save(next: Draft) {
    setDraft(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Continue in memory. */ }
  }

  const complete = useCallback(() => {
    discardDraft(userId);
    setDone(true);
  }, [userId]);

  if (done) return <Shell>
    <div className="success-mark" aria-hidden="true">âœ“</div>
    <h1>Youâ€™re ready to meet.</h1><p>Congratulations! Your Elyra profile is verified and ready to go.</p>
    <div className="actions"><Link className="action" href="/dashboard">Go to dashboard</Link></div>
  </Shell>;

  if (!draft) return <Shell><p role="status">Loading your setupâ€¦</p></Shell>;
  const { stage, step, form } = draft;

  function navigate(nextStage: number, nextStep = step) {
    if (!draft) return;
    setError("");
    save({ ...draft, stage: nextStage, step: nextStep });
  }

  async function nextProfile() {
    if (!draft) return;
    if (step < 3) { navigate(1, step + 1); return; }
    setBusy(true);
    setError("");
    try {
      const pref = form.preferences;
      const response = await api("/profile", json("PUT", {
        ...form, age: Number(form.age), preferences: {
          ...pref, minAge: Number(pref.minAge), maxAge: Number(pref.maxAge), maxDistance: Number(pref.maxDistance),
        },
      }));
      const status: PhotoStatus = await response.json();
      setPhotoStatus(status);
      save({ ...draft, stage: 2, photos: status.photos });
    } catch (failure) { setError(message(failure)); }
    finally { setBusy(false); }
  }

  return <Shell exit={!busy}>
    <Progress stage={stage} />
    {stage === 0 && <>
      <h1>Make room for a real connection.</h1>
      <p>Welcome to Elyra. Set up your profile, add a few photos, and verify your selfie before you start meeting people.</p>
      <div className="actions"><button className="action" onClick={() => navigate(1, 0)}>Start setup</button></div>
    </>}
    {stage === 1 && <ProfileForm key={step} step={step} form={form} busy={busy}
      update={(next) => save({ ...draft, form: next })} onNext={nextProfile}
      onBack={() => step ? navigate(1, step - 1) : navigate(0)} />}
    {stage === 2 && <PhotoStep api={api} status={photoStatus} onBack={() => navigate(1, 3)} onNext={() => navigate(3)}
      update={(status) => { setPhotoStatus(status); save({ ...draft, photos: status.photos }); }} />}
    {stage === 3 && <Verification api={api} onBack={() => navigate(2)} onComplete={complete} />}
    {error && <p className="notice" role="alert">{error}</p>}
  </Shell>;
}
