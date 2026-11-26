import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { onboardingRequest, type OnboardingStatus } from "@/lib/onboarding";
import { Wizard } from "./wizard";
import { Shell } from "./shell";

export default async function OnboardingPage() {
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
            <AlertDescription>Could not connect to the Elyra profile service.</AlertDescription>
          </Alert>
          <div className="space-y-2">
            <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
              We couldn’t load your profile.
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              Your progress is saved on this device. Please try again in a moment.
            </p>
          </div>
          <div className="flex justify-end pt-2">
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
  if (status.isOnboarded) redirect("/dashboard");
  return <Wizard key={session.userId} userId={session.userId} initial={status} />;
}
