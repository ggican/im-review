import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/cn";

const cardVariants = cva("text-on-surface", {
  variants: {
    variant: {
      default: "surface-card",
      panel: "surface-panel",
      ghost: "rounded-xl bg-transparent",
      streamGithub:
        "rounded-xl border border-stream-github-border bg-stream-github text-stream-github-fg shadow-card",
      streamJira:
        "rounded-xl border border-stream-jira-border bg-stream-jira text-stream-jira-fg shadow-card",
      streamGmail:
        "rounded-xl border border-stream-gmail-border bg-stream-gmail text-stream-gmail-fg shadow-card",
      streamCalendar:
        "rounded-xl border border-stream-calendar-border bg-stream-calendar text-stream-calendar-fg shadow-card",
      streamAi:
        "rounded-xl border border-stream-ai-border bg-stream-ai text-stream-ai-fg shadow-card",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      default: "p-5",
      lg: "p-6",
    },
  },
  defaultVariants: { variant: "default", padding: "default" },
});

export interface CardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-3 flex flex-col gap-1", className)} {...props} />
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "font-headline text-headline-sm text-on-surface font-semibold tracking-tight",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-body-sm text-on-surface-variant", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-body-md", className)} {...props} />;
}

export { cardVariants };
