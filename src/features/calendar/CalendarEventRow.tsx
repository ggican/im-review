import { Video } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

import { formatEventWhen } from "./api";
import type { CalendarEvent } from "./types";

export type EventPhase = "past" | "current" | "upcoming";

export function eventPhase(event: CalendarEvent, now = Date.now()): EventPhase {
  if (event.endMs <= now) return "past";
  if (event.startMs <= now && event.endMs > now) return "current";
  return "upcoming";
}

export function formatDuration(event: CalendarEvent): string | null {
  if (event.allDay) return "All day";
  const ms = Math.max(0, event.endMs - event.startMs);
  if (!Number.isFinite(ms) || ms === 0) return null;
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function attendeePreview(event: CalendarEvent): string | null {
  if (event.attendees.length === 0) return null;
  const names = event.attendees
    .slice(0, 3)
    .map((a) => a.displayName || a.email.split("@")[0] || a.email);
  const extra = event.attendees.length - names.length;
  return extra > 0
    ? `${names.join(", ")} +${extra}`
    : names.join(", ");
}

type Props = {
  event: CalendarEvent;
  calendarColor?: string;
  calendarName?: string;
};

export function CalendarEventRow({
  event,
  calendarColor,
  calendarName,
}: Props) {
  const phase = eventPhase(event);
  const duration = formatDuration(event);
  const attendees = attendeePreview(event);
  const statusLabel =
    phase === "current"
      ? "Happening"
      : phase === "past"
        ? "Ended"
        : "Upcoming";

  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={`/calendar/${encodeURIComponent(event.calendarId)}/${encodeURIComponent(event.id)}`}
        className={cn(
          "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-container-low/60",
          phase === "current" && "bg-stream-calendar/50",
          phase === "past" && "opacity-70",
        )}
      >
        <span
          className="mt-1 h-8 w-1 shrink-0 rounded-full"
          style={{
            backgroundColor:
              calendarColor || "var(--stream-calendar-border)",
          }}
          aria-hidden
        />
        <span className="w-28 shrink-0 font-keycap text-on-surface-variant tabular-nums">
          {formatEventWhen(event)}
          {duration ? (
            <span className="mt-0.5 block font-sans text-[10px] font-normal normal-case tracking-normal text-on-surface-variant">
              {duration}
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "truncate text-body-md text-on-surface",
                phase === "current" ? "font-semibold" : "font-medium",
              )}
            >
              {event.title}
            </span>
            {event.hangoutLink ? (
              <Badge
                variant="calendar"
                className="gap-1 px-1.5 py-0 text-[10px]"
              >
                <Video className="h-3 w-3" aria-hidden />
                Meet
              </Badge>
            ) : null}
            <Badge
              variant={
                phase === "current"
                  ? "accent"
                  : phase === "past"
                    ? "outline"
                    : "secondary"
              }
              className="px-1.5 py-0 text-[10px]"
            >
              {statusLabel}
            </Badge>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body-sm text-on-surface-variant">
            {calendarName ? (
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      calendarColor || "var(--stream-calendar-border)",
                  }}
                  aria-hidden
                />
                {calendarName}
              </span>
            ) : null}
            {attendees ? <span>{attendees}</span> : null}
            {event.location ? (
              <span className="truncate">{event.location}</span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}
