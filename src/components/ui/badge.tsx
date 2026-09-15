import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-semibold tracking-wide whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-surface-container-high text-on-surface-variant",
        primary: "bg-primary text-on-primary",
        accent: "bg-primary-container text-on-primary-container",
        secondary: "bg-secondary-container text-on-secondary-container",
        outline: "border border-border bg-transparent text-on-surface-variant",
        success: "bg-success-container text-on-success-container",
        warning: "bg-warning-container text-on-warning-container",
        error: "bg-error-container text-on-error-container",
        github:
          "border border-stream-github-border bg-stream-github text-stream-github-fg",
        jira: "border border-stream-jira-border bg-stream-jira text-stream-jira-fg",
        gmail:
          "border border-stream-gmail-border bg-stream-gmail text-stream-gmail-fg",
        calendar:
          "border border-stream-calendar-border bg-stream-calendar text-stream-calendar-fg",
        ai: "border border-stream-ai-border bg-stream-ai text-stream-ai-fg",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";

export { badgeVariants };
