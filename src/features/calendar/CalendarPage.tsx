import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { useGooglePublic } from "@/lib/use-settings";

import {
  calendarErrorMessage,
  fetchCalendarEvents,
  fetchCalendarList,
  filterEvents,
  groupEventsByDay,
  windowForTab,
} from "./api";
import { CalendarEventRow } from "./CalendarEventRow";
import type { CalendarEvent, CalendarSource, CalendarTab } from "./types";

const TABS: Array<{ id: CalendarTab; label: string }> = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "week", label: "This week" },
  { id: "allday", label: "All-day" },
];

function emptyCopy(tab: CalendarTab, query: string): string {
  if (query.trim()) return "No search results.";
  switch (tab) {
    case "upcoming":
      return "No upcoming events.";
    case "allday":
      return "No all-day events.";
    case "week":
      return "No events this week.";
    default:
      return "No events on the agenda.";
  }
}

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
  const activeSource =
    sources.find((s) => s.id === calendarId) ??
    sources.find((s) => s.primary) ??
    null;

  if (!connected) {
    return (
      <PageShell>
        <PageHeader
          backTo="/"
          title="Calendar"
          subtitle="Connect Google Calendar"
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
              Link Google to triage meetings beside PR, Jira, and mail.
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

  return (
    <PageShell width="lg" className="gap-5">
      <PageHeader
        backTo="/"
        title="Calendar"
        subtitle={`Meeting triage · ${connected.name || connected.email} · ${win.label}`}
        leading={
          <Badge variant="calendar" className="mt-1">
            Calendar
          </Badge>
        }
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void load(true)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        }
      />

      <Card
        padding="default"
        className="border-stream-calendar-border/80"
      >
        <CardHeader className="mb-3">
          <CardTitle className="text-title-md font-semibold">Agenda</CardTitle>
          <CardDescription>
            Scan today and upcoming meetings — not a full calendar editor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <TabsList aria-label="Calendar range" className="h-auto flex-wrap">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.id}
                  id={`calendar-tab-${t.id}`}
                  aria-controls="calendar-tab-panel"
                  active={tab === t.id}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <Select value={calendarId} onValueChange={setCalendarId}>
              <SelectTrigger
                className="h-8 w-[12rem] text-xs"
                aria-label="Calendar"
              >
                <SelectValue placeholder="Calendar" />
              </SelectTrigger>
              <SelectContent>
                {(sources.length > 0
                  ? sources
                  : [{ id: "primary", summary: "Primary", primary: true }]
                ).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="inline-flex items-center gap-2">
                      {"backgroundColor" in s && s.backgroundColor ? (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.backgroundColor }}
                          aria-hidden
                        />
                      ) : null}
                      {s.summary}
                      {s.primary ? " (primary)" : ""}
                    </span>
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

          {error ? <ErrorBlock tone="warning">{error}</ErrorBlock> : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-keycap text-body-sm text-on-surface-variant">
          {loading && events.length === 0
            ? "Loading…"
            : `${filtered.length} event${filtered.length === 1 ? "" : "s"}`}
        </p>
        {activeSource ? (
          <span className="inline-flex items-center gap-1.5 text-body-sm text-on-surface-variant">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor:
                  activeSource.backgroundColor ||
                  "var(--stream-calendar-border)",
              }}
              aria-hidden
            />
            {activeSource.summary}
          </span>
        ) : null}
      </div>

      <TabsPanel
        id="calendar-tab-panel"
        aria-labelledby={`calendar-tab-${tab}`}
      >
        {loading && events.length === 0 ? (
          <LoadingBlock>Loading events…</LoadingBlock>
        ) : groups.length === 0 ? (
          <Card padding="default">
            <p className="py-12 text-center text-body-md text-on-surface-variant">
              {emptyCopy(tab, query)}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <Card key={group.key} padding="none" className="overflow-hidden">
                <div className="border-b border-border bg-surface-container-low/50 px-3 py-2">
                  <h2 className="text-label-sm font-semibold tracking-wide text-on-surface-variant uppercase">
                    {group.label}
                    <span className="ml-2 font-keycap normal-case tracking-normal text-on-surface-variant">
                      {group.items.length}
                    </span>
                  </h2>
                </div>
                <ul>
                  {group.items.map((event) => (
                    <CalendarEventRow
                      key={`${event.calendarId}:${event.id}`}
                      event={event}
                      calendarColor={activeSource?.backgroundColor}
                      calendarName={activeSource?.summary}
                    />
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </TabsPanel>
    </PageShell>
  );
}
