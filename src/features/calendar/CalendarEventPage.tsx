import { openUrl } from "@tauri-apps/plugin-opener";
import { ExternalLink, Loader2, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { useGooglePublic } from "@/lib/use-settings";

import {
  calendarErrorMessage,
  fetchCalendarEvent,
  formatEventWhen,
} from "./api";
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
        <PageHeader backTo="/calendar" title="Calendar" subtitle="Connect first" />
        <p className="text-sm text-neutral-500">
          No Google account connected.{" "}
          <Link to="/settings" className="underline underline-offset-2">
            Connect in Settings
          </Link>
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell width="lg" className="gap-5">
      <PageHeader
        backTo="/calendar"
        title={event?.title ?? "Event"}
        subtitle={event ? formatEventWhen(event) : undefined}
        actions={
          event ? (
            <div className="flex flex-wrap gap-2">
              {event.hangoutLink ? (
                <Button
                  type="button"
                  size="sm"
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
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading event…
        </p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : event ? (
        <div className="space-y-4 text-sm">
          {event.location ? (
            <p>
              <span className="text-xs text-neutral-500">Location</span>
              <span className="mt-0.5 block">{event.location}</span>
            </p>
          ) : null}
          {event.description ? (
            <div>
              <span className="text-xs text-neutral-500">Description</span>
              <p className="mt-1 whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
                {event.description.replace(/<[^>]+>/g, "")}
              </p>
            </div>
          ) : null}
          {event.attendees.length > 0 ? (
            <div>
              <span className="text-xs text-neutral-500">
                Attendees ({event.attendees.length})
              </span>
              <ul className="mt-1 space-y-1">
                {event.attendees.slice(0, 20).map((a) => (
                  <li key={a.email} className="text-neutral-700 dark:text-neutral-300">
                    {a.displayName || a.email}
                    {a.self ? " (you)" : ""}
                    {a.responseStatus ? (
                      <span className="ml-1 text-xs text-neutral-400">
                        {a.responseStatus}
                      </span>
                    ) : null}
                  </li>
                ))}
                {event.attendees.length > 20 ? (
                  <li className="text-xs text-neutral-400">
                    +{event.attendees.length - 20} more
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
