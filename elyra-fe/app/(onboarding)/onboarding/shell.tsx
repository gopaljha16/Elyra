import Link from "next/link";
import type { ReactNode } from "react";
import { Check, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 font-serif text-2xl sm:text-3xl font-bold tracking-tight text-primary whitespace-nowrap transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 rounded-lg"
    >
      <span aria-hidden="true" className="text-lg sm:text-xl">
        ✦
      </span>
      <span>Elyra</span>
    </Link>
  );
}

export function Shell({
  children,
  exit = false,
  headerRight,
  size = "default",
  cardClassName,
}: {
  children: ReactNode;
  exit?: boolean;
  headerRight?: ReactNode;
  size?: "default" | "wide" | "admin";
  cardClassName?: string;
}) {
  const containerWidth =
    size === "admin" ? "max-w-6xl" : size === "wide" ? "max-w-4xl" : "max-w-[680px]";

  return (
    <main className="elyra-ambient min-h-dvh px-3 sm:px-6 pb-16">
      <header
        className={cn(
          "mx-auto flex min-h-16 sm:min-h-20 items-center justify-between gap-3 px-1",
          size === "admin" ? "max-w-6xl" : "max-w-[930px]",
        )}
      >
        <Brand />
        <div className="flex items-center gap-2">
          {headerRight}
          {exit && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/onboarding/paused">
                <LogOut className="size-4" />
                <span>Save and exit</span>
              </Link>
            </Button>
          )}
        </div>
      </header>

      <Card
        className={cn(
          "mx-auto mt-2 sm:mt-5 w-full rounded-[22px] sm:rounded-[28px] border-[#f1dee0] p-5 sm:p-10 md:p-12",
          containerWidth,
          cardClassName,
        )}
      >
        {children}
      </Card>
    </main>
  );
}

const stages = ["Welcome", "Your profile", "Photos", "Verification"];

export function Progress({ stage }: { stage: number }) {
  return (
    <ol
      className="mb-7 sm:mb-8 grid grid-cols-4 gap-1.5 sm:gap-2.5"
      aria-label="Onboarding progress"
    >
      {stages.map((label, index) => {
        const isCurrent = index === stage;
        const isCompleted = index < stage;
        return (
          <li
            key={label}
            aria-current={isCurrent ? "step" : undefined}
            className="flex flex-col gap-1.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-full rounded-full transition-colors duration-300",
                isCurrent ? "bg-primary" : isCompleted ? "bg-[#bd7892]" : "bg-border",
              )}
            />
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] sm:text-xs leading-tight",
                isCurrent
                  ? "font-bold text-primary"
                  : isCompleted
                    ? "font-medium text-foreground/80"
                    : "text-muted-foreground",
              )}
            >
              {isCompleted && <Check className="hidden sm:inline size-3 text-primary shrink-0" />}
              <span className="truncate">{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
