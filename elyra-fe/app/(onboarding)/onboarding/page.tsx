import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { onboardingRequest, type OnboardingStatus } from "@/lib/onboarding";
import { Wizard } from "./wizard";
import { Shell } from "./shell";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();

  let status: OnboardingStatus;
  try {
    const response = await onboardingRequest("", await session.getToken(), { signal: AbortSignal.timeout(8_000) });
    status = await response.json();
  } catch {
    return <Shell><h1>We couldn’t load your profile.</h1><p>Your progress is saved on this device.</p><a className="action" href="">Try again</a></Shell>;
  }
  if (status.isOnboarded) redirect("/dashboard");
  return <Wizard key={session.userId} userId={session.userId} initial={status} />;
}
