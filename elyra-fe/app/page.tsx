import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarHeart, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shell } from "./(onboarding)/onboarding/shell";

const pillars = [
  {
    icon: Sparkles,
    title: "Intentional profiles",
    desc: "Share your real interests and favorite date ideas, not endless swipe noise.",
  },
  {
    icon: ShieldCheck,
    title: "Live-verified people",
    desc: "Every member completes a quick live camera check before matching opens.",
  },
  {
    icon: CalendarHeart,
    title: "Built for real dates",
    desc: "Pick a local spot, agree on a time, and actually meet up in person.",
  },
];

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/onboarding");

  return (
    <Shell>
      <div className="space-y-6">
        <Badge variant="secondary" className="px-3 py-1 text-xs">
          Thoughtful dating, verified in person
        </Badge>

        <div className="space-y-3">
          <h1 className="font-serif text-4xl sm:text-5xl md:text-[54px] font-medium leading-[1.05] tracking-tight text-foreground">
            Make room for a real connection.
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
            Share what makes you, you. Meet verified people who are looking for the same kind of
            connection—and turn matches into real-world plans.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {pillars.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-border/80 bg-background/60 p-4 transition-colors hover:bg-secondary/40"
              >
                <Icon className="size-4 text-primary mb-2" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
          <Button variant="ghost" size="lg" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button size="lg" asChild>
            <Link href="/sign-up">
              <span>Create an account</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Shell>
  );
}
