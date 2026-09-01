import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/components/lib";
import { ALERT_COLORS, type AlertLevel } from "@/lib/types";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest",
  {
    variants: {
      variant: {
        default: "border-line text-dim",
        alert: "border-line-strong text-text",
      },
      status: {
        on: "border-teal/40 bg-teal/10 text-teal",
        off: "border-faint text-faint",
        deg: "border-amber/40 bg-amber/10 text-amber",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, status, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, status }), className)} {...props}>
      {children}
    </span>
  );
}

export function AlertBadge({ level, className }: { level: AlertLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest",
        className
      )}
      style={{
        color: ALERT_COLORS[level],
        borderColor: ALERT_COLORS[level],
        background: `${ALERT_COLORS[level]}14`,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: ALERT_COLORS[level] }}
      />
      {level}
    </span>
  );
}