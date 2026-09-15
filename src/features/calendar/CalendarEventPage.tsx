import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, MapPin, Users, Video } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { useGooglePublic } from "@/lib/use-settings";

import {
  calendarErrorMessage,
  fetchCalendarEvent,
  formatEventWhen,
} from "./api";
import { eventPhase, formatDuration } from "./CalendarEventRow";
import type { CalendarEvent } from "./types";

export function CalendarEventPage() {
  const { calendarId = "primary", eventId = "" } = useParams();
  const connected = useGooglePublic();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!connected || !eventId) return;
    setLoading(true);
    setError(null);
    try {
      setEvent(
        await fetchCalendarEvent(
          decodeURIComponent(calendarId),
          decodeURIComponent(eventId),
        ),
      );
    } catch (err) {
      setError(calendarErrorMessage(err));
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }, [connected, calendarId, eventId]);

  useEffect(() => {
    document.title = event
      ? `${event.title} · Calendar · IM Review`
      : "Calendar · IM Review";
  }, [event]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!connected) {
    return (
      <PageShell>
        <PageHeader
          backTo="/calendar"
          title="Calendar"
          subtitle="Connect first"
        />
        <Card
          padding="default"
          className="border-stream-calendar-border/80"
        >
          <CardHeader className="mb-2">
            <CardTitle className="text-title-md">
              Google Calendar not connected
            </CardTitle>
            <CardDescription>
              Connect Google in Settings to open event details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="accent">
              <Link to="/settings">Connect in Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const phase = event ? eventPhase(event) : null;
  const duration = event ? formatDuration(event) : null;

  return (
    <PageShell width="lg" className="gap-5">
      <PageHeader
        backTo="/calendar"
        title={event?.title ?? "Event"}
        subtitle={event ? formatEventWhen(event) : undefined}
        leading={
          <Badge variant="calendar" className="mt-1">
            Calendar
          </Badge>
        }
        actions={
          event ? (
            <div className="flex flex-wrap gap-2">
              {event.hangoutLink ? (
                <Button
                  type="button"
                  size="sm"
                  variant="accent"
                  onClick={() => {
                    void openUrl(event.hangoutLink!).catch((err) =>
                      toast.error(String(err)),
                    );
                  }}
                >
                  <Video className="h-3.5 w-3.5" />
                  Join Meet
                </Button>
              ) : null}
              {event.htmlLink ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void openUrl(event.htmlLink).catch((err) =>
                      toast.error(String(err)),
                    );
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in Calendar
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      {loading ? (
        <LoadingBlock>Loading event…</LoadingBlock>
      ) : error ? (
        <ErrorBlock tone="warning">{error}</ErrorBlock>
      ) : event ? (
        <div className="space-y-4">
          <Card
            padding="default"
            className={
              phase === "current"
                ? "border-stream-calendar-border bg-stream-calendar/40"
                : "border-stream-calendar-border/80"
            }
          >
            <CardHeader className="mb-3">
              <CardDescription className="flex flex-wrap items-center gap-2">
                <span className="font-keycap tabular-nums">
                  {formatEventWhen(event)}
                </span>
                {duration ? (
                  <Badge variant="outline" className="font-keycap">
                    {duration}
                  </Badge>
                ) : null}
                {phase ? (
                  <Badge
                    variant={
                      phase === "current"
                        ? "accent"
                        : phase === "past"
                          ? "outline"
                          : "secondary"
                    }
                  >
                    {phase === "current"
                      ? "Happening"
                      : phase === "past"
                        ? "Ended"
                        : "Upcoming"}
                  </Badge>
                ) : null}
                {event.hangoutLink ? (
                  <Badge variant="calendar" className="gap-1">
                    <Video className="h-3 w-3" aria-hidden />
                    Google Meet
                  </Badge>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetaTile
                  icon={<MapPin className="h-3.5 w-3.5" aria-hidden />}
                  label="Location"
                >
                  {event.location ? (
                    event.location
                  ) : (
                    <span className="text-on-surface-variant">No location</span>
                  )}
                </MetaTile>
                <MetaTile
                  icon={<Users className="h-3.5 w-3.5" aria-hidden />}
                  label="Calendar"
                >
                  <span className="font-mono text-xs">{event.calendarId}</span>
                </MetaTile>
              </div>

              {!event.hangoutLink ? (
                <p className="text-body-sm text-on-surface-variant">
                  No Google Meet link on this event.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card padding="default">
            <CardHeader className="mb-2">
              <CardTitle className="text-label-sm tracking-wide text-on-surface-variant uppercase">
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              {event.description ? (
                <p className="whitespace-pre-wrap text-body-md text-on-surface">
                  {event.description.replace(/<[^>]+>/g, "")}
                </p>
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-body-md text-on-surface-variant">
                  No description.
                </p>
              )}
            </CardContent>
          </Card>

          <Card padding="default">
            <CardHeader className="mb-2">
              <CardTitle className="text-label-sm tracking-wide text-on-surface-variant uppercase">
                Attendees
                {event.attendees.length > 0
                  ? ` (${event.attendees.length})`
                  : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {event.attendees.length > 0 ? (
                <ul className="space-y-2">
                  {event.attendees.slice(0, 20).map((a) => (
                    <li
                      key={a.email}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-body-sm"
                    >
                      <span className="text-on-surface">
                        {a.displayName || a.email}
                        {a.self ? (
                          <span className="ml-1 text-on-surface-variant">
                            (you)
                          </span>
                        ) : null}
                      </span>
                      {a.responseStatus ? (
                        <Badge variant="outline" className="font-keycap">
                          {a.responseStatus}
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                  {event.attendees.length > 20 ? (
                    <li className="text-body-sm text-on-surface-variant">
                      +{event.attendees.length - 20} more
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-body-md text-on-surface-variant">
                  No attendees listed.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="py-10 text-center text-body-md text-on-surface-variant">
          Event not found.
        </p>
      )}
    </PageShell>
  );
}

function MetaTile({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-container-low/40 px-3 py-2.5">
      <p className="mb-1 inline-flex items-center gap-1.5 text-label-sm tracking-wide text-on-surface-variant uppercase">
        {icon}
        {label}
      </p>
      <div className="text-body-md text-on-surface">{children}</div>
    </div>
  );
}
