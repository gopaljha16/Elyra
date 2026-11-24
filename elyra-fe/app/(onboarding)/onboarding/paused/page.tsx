import { auth } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { Shell } from "../shell";

export default async function PausedPage() {
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();
  return (
    <Shell>
      <h1>See you soon.</h1>
      <p>You can pick up where you left off on this device.</p>
      <div className="actions">
        <SignOutButton><button className="quiet">Sign out</button></SignOutButton>
        <Link className="action" href="/onboarding">Resume setup</Link>
      </div>
    </Shell>
  );
}
