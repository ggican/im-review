import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/** Shared loading surface for redesigned routes. */
export function LoadingBlock({
  children,
  className,
  embedded = false,
}: {
  children: ReactNode;
  className?: string;
  /** When true, skip Card wrapper (for use inside an existing surface). */
  embedded?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "text-body-md text-on-surface-variant flex items-center justify-center gap-2 py-12",
        embedded && "px-4",
        !embedded && className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {children}
    </div>
  );

  if (embedded) return body;

  return (
    <Card padding="default" className={className}>
      {body}
    </Card>
  );
}

/** Shared error / warning alert surface. Does not change error handling logic. */
export function ErrorBlock({
  children,
  tone = "error",
  className,
}: {
  children: ReactNode;
  tone?: "error" | "warning";
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "text-body-sm rounded-lg border px-4 py-3",
        tone === "error" &&
          "border-error/30 bg-error-container text-on-error-container",
        tone === "warning" &&
          "border-warning/30 bg-warning-container text-on-warning-container",
        className,
      )}
    >
      {children}
    </div>
  );
}
