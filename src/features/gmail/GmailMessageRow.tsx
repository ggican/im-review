import { Star } from "lucide-react";
import type { MouseEvent } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { favoriteStarClass } from "@/lib/favorite-styles";
import { relativeTime } from "@/lib/time";

import type { GmailMessageSummary } from "./types";

type Props = {
  message: GmailMessageSummary;
  onToggleStar?: (message: GmailMessageSummary) => void;
  starring?: boolean;
};

function isImportant(message: GmailMessageSummary): boolean {
  return message.labelIds.some(
    (id) => id === "IMPORTANT" || id === "CATEGORY_PERSONAL",
  );
}

export function GmailMessageRow({
  message,
  onToggleStar,
  starring = false,
}: Props) {
  const when = relativeTime(
    Number.isFinite(message.dateMs)
      ? new Date(message.dateMs).toISOString()
      : message.date,
  );

  function handleStar(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onToggleStar?.(message);
  }

  return (
    <li
      className={cn(
        "border-b border-border last:border-b-0",
        message.unread && "bg-stream-gmail/40 dark:bg-stream-gmail/30",
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2.5 hover:bg-surface-container-low/60">
        <Link
          to={`/gmail/${message.id}`}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-label={`Open message ${message.subject || message.id}`}
        >
          <span
            className={cn(
              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
              message.unread
                ? "bg-stream-gmail-fg"
                : "bg-transparent",
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Badge variant="gmail" className="px-1.5 py-0 text-[10px]">
                Gmail
              </Badge>
              <p
                className={cn(
                  "min-w-0 truncate text-body-md",
                  message.unread
                    ? "font-semibold text-on-surface"
                    : "text-on-surface-variant",
                )}
              >
                {message.from}
              </p>
              {isImportant(message) ? (
                <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                  Important
                </Badge>
              ) : null}
              <span className="ml-auto shrink-0 font-keycap text-on-surface-variant tabular-nums">
                {when}
              </span>
            </div>
            <p
              className={cn(
                "truncate text-body-md",
                message.unread
                  ? "font-medium text-on-surface"
                  : "text-on-surface-variant",
              )}
            >
              {message.subject || "(no subject)"}
            </p>
            <p className="truncate text-body-sm text-on-surface-variant">
              {message.snippet}
            </p>
          </div>
        </Link>
        {onToggleStar ? (
          <IconButton
            type="button"
            size="icon-sm"
            variant="ghost"
            className="mt-0.5 shrink-0"
            disabled={starring}
            aria-label={message.starred ? "Unstar message" : "Star message"}
            aria-pressed={message.starred}
            onClick={handleStar}
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                message.starred
                  ? favoriteStarClass(true)
                  : "text-on-surface-variant",
              )}
            />
          </IconButton>
        ) : null}
      </div>
    </li>
  );
}
