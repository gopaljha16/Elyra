"use client";

import { useAuth } from "@clerk/nextjs";
import { FaceLivenessDetectorCore } from "@aws-amplify/ui-react-liveness";
import { useEffect, useState } from "react";
import { endpoint } from "@/lib/onboarding";
import { Dating } from "./dating";

type Session = { sessionId: string; region: string; credentials: {
  accessKeyId: string; secretAccessKey: string; sessionToken: string; expiration: string;
} };

export function LiveCheck({ activities, location }: { activities: string[]; location: string }) {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<{ verified: boolean; available: boolean } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(path: string, method = "GET") {
    const token = await getToken();
    const response = await fetch(`${endpoint}/api/live${path}`, {
      method, cache: "no-store", headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Verification failed.");
    return data;
  }

  useEffect(() => {
    let cancelled = false;
    void request("/status").then((data) => { if (!cancelled) setStatus(data); })
      .catch((failure) => { if (!cancelled) setError(failure instanceof Error ? failure.message : "Could not load verification."); });
    return () => { cancelled = true; };
  // The authenticated dashboard mounts this check for the current account.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setBusy(true); setError("");
    try { setSession(await request("/sessions", "POST")); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not start verification."); }
    finally { setBusy(false); }
  }

  if (status?.verified) return <Dating initialActivities={activities} initialLocation={location} />;
  return <section className="dating-panel">
    <h2>Confirm you are present</h2>
    <p>Complete a short live camera check before meeting people. Your live face is compared with your primary profile photo.</p>
    {error && <p className="notice" role="alert">{error}</p>}
    {!status && !error && <p role="status">Checking verification…</p>}
    {status && !status.available && <p>Live verification needs service setup before matching can open.</p>}
    {status?.available && !session && <button className="action" disabled={busy} onClick={start}>Start live verification</button>}
    {session && <FaceLivenessDetectorCore
      sessionId={session.sessionId} region={session.region}
      config={{ credentialProvider: async () => ({
        accessKeyId: session.credentials.accessKeyId, secretAccessKey: session.credentials.secretAccessKey,
        sessionToken: session.credentials.sessionToken, expiration: new Date(session.credentials.expiration),
      }) }}
      onAnalysisComplete={async () => {
        try {
          const result = await request(`/sessions/${session.sessionId}/complete`, "POST");
          setSession(null);
          if (result.verified) setStatus({ verified: true, available: true });
          else setError("We could not confirm the live face match. Check lighting and try again.");
        } catch (failure) { setError(failure instanceof Error ? failure.message : "Verification failed."); setSession(null); }
      }}
      onError={() => { setError("Live capture stopped. Start a new session to try again."); setSession(null); }}
      onUserCancel={() => setSession(null)}
    />}
  </section>;
}
