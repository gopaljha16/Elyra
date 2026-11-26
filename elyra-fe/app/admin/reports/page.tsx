import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Shell } from "../../(onboarding)/onboarding/shell";
import { ReportQueue } from "./queue";

export default async function ReportsPage() {
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();
  return (
    <Shell
      size="admin"
      headerRight={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </Button>
          <UserButton />
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/70">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <ShieldAlert className="size-3.5" aria-hidden="true" />
              <span>Moderation workspace</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-foreground">
              Safety &amp; Reports
            </h1>
            <p className="text-sm text-muted-foreground">
              Review member reports, dismiss false positives, or suspend accounts that violate
              community guidelines.
            </p>
          </div>
        </div>
        <ReportQueue />
      </div>
    </Shell>
  );
}
