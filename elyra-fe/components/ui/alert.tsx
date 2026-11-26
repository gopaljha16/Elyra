import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border px-4 py-3 text-sm flex items-start gap-3",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground",
        destructive: "border-destructive/25 bg-[#f7e3e6] text-[#782638]",
        success: "border-emerald-200 bg-emerald-50/90 text-emerald-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("font-semibold leading-none tracking-tight", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm leading-relaxed", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
