import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import imReviewLogo from "@/assets/im-review-logo.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Width = "md" | "lg";

export function PageShell({
  children,
  width = "md",
  className,
}: {
  children: ReactNode;
  width?: Width;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto flex min-h-screen w-full flex-col gap-6 px-6 py-8",
        width === "lg" ? "max-w-4xl" : "max-w-3xl",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function PageHeader({
  title,
  subtitle,
  backTo,
  actions,
  leading,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backTo?: string;
  actions?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {backTo ? (
          <Button asChild variant="ghost" size="icon" aria-label="Back">
            <Link to={backTo}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
        {leading}
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {title}
          </h1>
          {subtitle ? (
            <div className="mt-0.5 text-xs text-neutral-500">{subtitle}</div>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img src={imReviewLogo} alt="" className="h-8 w-8 rounded-md" />
      <span className="text-sm font-semibold tracking-tight">IM Review</span>
    </div>
  );
}
