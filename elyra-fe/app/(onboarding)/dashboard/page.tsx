import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { onboardingRequest, type OnboardingStatus } from "@/lib/onboarding";
import { Shell } from "../onboarding/shell";
import { ClearDraft } from "../onboarding/draft-storage";
import { LiveCheck } from "./live-check";

export default async function DashboardPage() {
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();

  let status: OnboardingStatus;
  try {
    const response = await onboardingRequest("", await session.getToken(), {
      signal: AbortSignal.timeout(8_000),
    });
    status = await response.json();
  } catch {
    return (
      <Shell>
        <h1>We could not load your dashboard.</h1>
        <a className="action" href="">
          Try again
        </a>
      </Shell>
    );
  }
  if (!status.isOnboarded) redirect("/onboarding");

  return (
    <Shell>
      <ClearDraft userId={session.userId} />
      <div className="dashboard-heading">
        <h1>Welcome{status.profile?.name ? `, ${status.profile.name}` : ""}.</h1>
        <UserButton />
      </div>
      <p>Your Elyra profile setup is complete.</p>
      <LiveCheck activities={status.dateActivities} location={status.location} />
    </Shell>
  );
}
