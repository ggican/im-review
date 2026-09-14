import { Link } from "react-router-dom";

import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";

import type { GmailMessageSummary } from "./types";

export function GmailMessageRow({ message }: { message: GmailMessageSummary }) {
  const when = relativeTime(
    Number.isFinite(message.dateMs)
      ? new Date(message.dateMs).toISOString()
      : message.date,
  );

  return (
    <li>
      <Link
        to={`/gmail/${message.id}`}
        className="flex items-start gap-3 border-b border-neutral-200 px-3 py-3 transition-colors last:border-b-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/50"
      >
        <span
          className={cn(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
            message.unread ? "bg-sky-500" : "bg-transparent",
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={cn(
                "truncate text-sm",
                message.unread
                  ? "font-semibold text-neutral-900 dark:text-neutral-50"
                  : "text-neutral-700 dark:text-neutral-300",
              )}
            >
              {message.from}
            </p>
            <span className="shrink-0 text-xs text-neutral-400 tabular-nums">
              {when}
            </span>
          </div>
          <p
            className={cn(
              "truncate text-sm",
              message.unread
                ? "font-medium text-neutral-800 dark:text-neutral-100"
                : "text-neutral-600 dark:text-neutral-400",
            )}
          >
            {message.starred ? "★ " : ""}
            {message.subject}
          </p>
          <p className="truncate text-xs text-neutral-500">{message.snippet}</p>
        </div>
      </Link>
    </li>
  );
}
