import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-xl border border-input bg-[#fffdfb] px-3.5 py-2.5 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/30",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
