import Link from "next/link";
import type { ReactNode } from "react";

export function Brand() {
  return <span className="elyra-brand"><span aria-hidden="true">✦</span> Elyra</span>;
}

export function Shell({ children, exit = false }: { children: ReactNode; exit?: boolean }) {
  return (
    <main className="elyra-screen">
      <header className="elyra-header"><Brand />{exit && <Link className="quiet" href="/onboarding/paused">Save and exit</Link>}</header>
      <div className="elyra-card">{children}</div>
    </main>
  );
}

const stages = ["Welcome", "Your profile", "Photos", "Verification"];

export function Progress({ stage }: { stage: number }) {
  return (
    <ol className="progress" aria-label="Onboarding progress">
      {stages.map((label, index) => (
        <li key={label} className={index <= stage ? "reached" : ""} aria-current={index === stage ? "step" : undefined}>
          <span aria-hidden="true" />{label}
        </li>
      ))}
    </ol>
  );
}
