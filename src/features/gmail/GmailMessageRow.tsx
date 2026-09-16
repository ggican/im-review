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
    <li className="border-border border-b last:border-b-0">
      <div className="hover:bg-surface-container-low/60 flex items-start gap-2 px-3 py-2.5">
        <Link
          to={`/gmail/${message.id}`}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-label={`Open message ${message.subject || message.id}`}
        >
          <span
            className={cn(
              "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
              message.unread ? "bg-stream-gmail-fg" : "bg-transparent",
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-body-sm text-on-surface-variant min-w-0 truncate font-medium">
                {message.from}
              </p>
              {message.unread ? <Badge variant="accent">Unread</Badge> : null}
              {isImportant(message) ? (
                <Badge variant="warning">Important</Badge>
              ) : null}
              <span className="text-body-sm text-on-surface-variant ml-auto shrink-0 tabular-nums">
                {when}
              </span>
            </div>
            <p
              className={cn(
                "text-body-md text-on-surface mt-0.5 truncate",
                message.unread ? "font-semibold" : "font-medium",
              )}
            >
              {message.subject || "(no subject)"}
            </p>
            {message.snippet ? (
              <p className="text-body-sm text-on-surface-variant mt-0.5 truncate">
                {message.snippet}
              </p>
            ) : null}
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
