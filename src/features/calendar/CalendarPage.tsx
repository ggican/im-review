import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { useGooglePublic } from "@/lib/use-settings";

import {
  calendarErrorMessage,
  fetchCalendarEvents,
  fetchCalendarList,
  filterEvents,
  formatEventWhen,
  groupEventsByDay,
  windowForTab,
} from "./api";
import type { CalendarEvent, CalendarSource, CalendarTab } from "./types";

const TABS: Array<{ id: CalendarTab; label: string }> = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "week", label: "This week" },
  { id: "allday", label: "All-day" },
];

export function CalendarPage() {
  const connected = useGooglePublic();
  const [tab, setTab] = useState<CalendarTab>("today");
  const [calendarId, setCalendarId] = useState("primary");
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSources = useCallback(async () => {
    if (!connected) return;
    try {
      const list = await fetchCalendarList();
      setSources(list);
      setCalendarId((current) => {
        if (list.some((s) => s.id === current)) return current;
        return list.find((s) => s.primary)?.id ?? list[0]?.id ?? "primary";
      });
    } catch {
      // keep primary fallback
    }
  }, [connected]);

  const load = useCallback(
    async (refresh = false) => {
      if (!connected) return;
      setLoading(true);
      if (!refresh) setError(null);
      try {
        setEvents(
          await fetchCalendarEvents({
            calendarId,
            tab: tab === "allday" ? "upcoming" : tab,
          }),
        );
        setError(null);
      } catch (err) {
        const message = calendarErrorMessage(err);
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [connected, calendarId, tab],
  );

  useEffect(() => {
    document.title = "Calendar · IM Review";
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => filterEvents(events, { tab, query }),
    [events, tab, query],
  );
  const groups = useMemo(() => groupEventsByDay(filtered), [filtered]);
  const win = windowForTab(tab);

  if (!connected) {
    return (
      <PageShell>
        <PageHeader
          backTo="/"
          title="Calendar"
          subtitle="Connect Google Calendar"
        />
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
        backTo="/"
        title="Calendar"
        subtitle={`${connected.name || connected.email} · ${win.label}`}
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void load(true)}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex flex-wrap gap-1 rounded-lg border border-neutral-200 p-1 dark:border-neutral-800"
          role="tablist"
          aria-label="Calendar range"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                tab === t.id
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900",
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Select value={calendarId} onValueChange={setCalendarId}>
          <SelectTrigger className="h-8 w-[12rem] text-xs" aria-label="Calendar">
            <SelectValue placeholder="Calendar" />
          </SelectTrigger>
          <SelectContent>
            {(sources.length > 0
              ? sources
              : [{ id: "primary", summary: "Primary", primary: true }]
            ).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.summary}
                {s.primary ? " (primary)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-8 max-w-xs text-xs"
          placeholder="Search title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search events"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {loading && events.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading events…
        </p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-neutral-500">No events in this range.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
                {group.label}
              </h2>
              <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {group.items.map((event) => (
                  <li key={`${event.calendarId}:${event.id}`}>
                    <Link
                      to={`/calendar/${encodeURIComponent(event.calendarId)}/${encodeURIComponent(event.id)}`}
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
                    >
                      <span className="w-28 shrink-0 text-xs text-neutral-500 tabular-nums">
                        {formatEventWhen(event)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          {event.title}
                          {event.hangoutLink ? (
                            <span className="ml-2 text-xs font-normal text-sky-600 dark:text-sky-400">
                              Meet
                            </span>
                          ) : null}
                        </span>
                        {event.location ? (
                          <span className="block truncate text-xs text-neutral-500">
                            {event.location}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}
