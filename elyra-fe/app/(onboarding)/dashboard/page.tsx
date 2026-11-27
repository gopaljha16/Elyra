import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { onboardingRequest, type OnboardingStatus } from "@/lib/onboarding";
import { Shell } from "../onboarding/shell";
import { ClearDraft } from "../onboarding/draft-storage";
import { DashboardVitals } from "./vitals";
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
        <div className="space-y-5">
          <Alert variant="destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <AlertDescription>We could not load your dashboard right now.</AlertDescription>
          </Alert>
          <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
            Something interrupted your session.
          </h1>
          <div className="flex justify-end">
            <Button asChild>
              <a href="">
                <RefreshCw className="size-4" />
                <span>Try again</span>
              </a>
            </Button>
          </div>
        </div>
      </Shell>
    );
  }
  if (!status.isOnboarded) redirect("/onboarding");

  return (
    <Shell size="wide" headerRight={<UserButton />}>
      <DashboardVitals />
      <ClearDraft userId={session.userId} />
      <div className="space-y-2 pb-6 border-b border-border/70">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Your Elyra space</p>
        <h1 className="font-serif text-3xl sm:text-5xl font-medium tracking-tight text-foreground">
          Welcome{status.profile?.name ? `, ${status.profile.name}` : ""}.
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Your profile is set up and ready for real-world connections.
        </p>
      </div>
      <LiveCheck activities={status.dateActivities} location={status.location} />
    </Shell>
  );
}
