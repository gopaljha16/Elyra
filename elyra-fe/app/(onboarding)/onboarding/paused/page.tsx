import { auth } from "@clerk/nextjs/server";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowRight, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shell } from "../shell";

export default async function PausedPage() {
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();
  return (
    <Shell>
      <div className="space-y-5">
        <div className="inline-flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <BookmarkCheck className="size-5" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
            See you soon.
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Your progress is saved on this device. You can pick up right where you left off whenever
            you are ready.
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
          <SignOutButton>
            <Button variant="ghost" type="button">
              Sign out
            </Button>
          </SignOutButton>
          <Button asChild>
            <Link href="/onboarding">
              <span>Resume setup</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Shell>
  );
}
