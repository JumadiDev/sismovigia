import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/components/lib";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-sm border text-xs font-mono uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border-teal bg-teal/10 text-teal hover:bg-teal/20",
        ghost: "border-line text-dim hover:text-text hover:border-line-strong",
        danger: "border-red bg-red/10 text-red hover:bg-red/20",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2 text-[10px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };