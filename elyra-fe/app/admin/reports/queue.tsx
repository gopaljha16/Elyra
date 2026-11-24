"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { endpoint } from "@/lib/onboarding";

type Report = {
  id: string;
  reason: string;
  createdAt: string;
  reporter: { name: string };
  subject: { name: string; isActive: boolean };
};

export function ReportQueue() {
  const { getToken } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    const response = await fetch(`${endpoint}/api/admin/reports`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        response.status === 403 ? "Administrator access required." : "Could not load reports.",
      );
    setReports((await response.json()).reports);
  }, [getToken]);

  useEffect(() => {
    void load().catch((failure) => setError(failure.message));
  }, [load]);

  async function resolve(id: string, disposition: "DISMISSED" | "SUSPENDED") {
    setBusy(true);
    setError("");
    try {
      const token = await getToken();
      const response = await fetch(`${endpoint}/api/admin/reports/${id}/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ disposition }),
      });
      if (!response.ok) throw new Error("Could not resolve this report.");
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not resolve this report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dating-panel">
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {!error && reports.length === 0 && <p>No open reports.</p>}
      {reports.map((report) => (
        <article className="dating-item" key={report.id}>
          <strong>{report.subject.name}</strong>
          <p>
            Reported by {report.reporter.name} on {new Date(report.createdAt).toLocaleString()}
          </p>
          <p>{report.reason}</p>
          <p>Account {report.subject.isActive ? "active" : "suspended"}</p>
          <div className="actions">
            <button
              className="quiet"
              disabled={busy}
              onClick={() => void resolve(report.id, "DISMISSED")}
            >
              Dismiss
            </button>
            <button
              className="action"
              disabled={busy}
              onClick={() => void resolve(report.id, "SUSPENDED")}
            >
              Suspend account
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
