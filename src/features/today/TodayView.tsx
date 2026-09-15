import {
  CalendarDays,
  GitPullRequest,
  Loader2,
  Mail,
  RefreshCw,
  SquareKanban,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import {
  formatEventWhen,
} from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/types";
import type { GmailMessageSummary } from "@/features/gmail/types";
import type { JiraIssue } from "@/features/jira/types";
import type { CiWatchHit } from "@/features/pr/ci-watch";
import { ReviewStatusBadge } from "@/features/pr/ReviewStatusBadge";
import type { PullRequest } from "@/features/pr/types";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/time";

export type SourceFilter = "all" | "prs" | "jira" | "mail";

function greetingFor(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(name: string | null | undefined, login: string): string {
  const raw = (name ?? login).trim();
  if (!raw) return "there";
  return raw.split(/\s+/)[0] ?? raw;
}

type SummaryCardsProps = {
  needsMe: number;
  prReview: number;
  prMine: number;
  ciFails: number;
  jiraCount: number;
  jiraConnected: boolean;
  meetingCount: number;
  nextMeetingLabel: string | null;
  googleConnected: boolean;
};

export function TodaySummaryCards({
  needsMe,
  prReview,
  prMine,
  ciFails,
  jiraCount,
  jiraConnected,
  meetingCount,
  nextMeetingLabel,
  googleConnected,
}: SummaryCardsProps) {
  return (
    <section
      aria-label="Today summary"
      className="grid grid-cols-2 gap-3 lg:grid-cols-4"
    >
      <Card
        variant="streamGithub"
        padding="sm"
        className="min-h-[5.5rem]"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-label-sm font-semibold tracking-wider uppercase">
            Needs me
          </span>
          <GitPullRequest className="h-4 w-4 opacity-70" aria-hidden />
        </div>
        <div className="font-headline mt-2 text-3xl font-bold tabular-nums">
          {needsMe}
        </div>
        <p className="mt-1 text-body-sm opacity-80">Action required</p>
      </Card>

      <Card
        className="min-h-[5.5rem] border border-stream-ai-border bg-stream-ai text-stream-ai-fg shadow-card"
        padding="sm"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-label-sm font-semibold tracking-wider uppercase">
            Pull Requests
          </span>
          <GitPullRequest className="h-4 w-4 opacity-70" aria-hidden />
        </div>
        <div className="font-headline mt-2 text-3xl font-bold tabular-nums">
          {prReview + prMine}
        </div>
        <p className="mt-1 text-body-sm opacity-80">
          {prReview} awaiting review
          {ciFails > 0 ? ` · ${ciFails} CI fail` : ""}
        </p>
      </Card>

      <Card variant="streamJira" padding="sm" className="min-h-[5.5rem]">
        <div className="flex items-start justify-between gap-2">
          <span className="text-label-sm font-semibold tracking-wider uppercase">
            Jira Issues
          </span>
          <SquareKanban className="h-4 w-4 opacity-70" aria-hidden />
        </div>
        <div className="font-headline mt-2 text-3xl font-bold tabular-nums">
          {jiraConnected ? jiraCount : "—"}
        </div>
        <p className="mt-1 text-body-sm opacity-80">
          {jiraConnected ? "Assigned to you" : "Connect in Settings"}
        </p>
      </Card>

      <Card variant="streamCalendar" padding="sm" className="min-h-[5.5rem]">
        <div className="flex items-start justify-between gap-2">
          <span className="text-label-sm font-semibold tracking-wider uppercase">
            Meetings Today
          </span>
          <CalendarDays className="h-4 w-4 opacity-70" aria-hidden />
        </div>
        <div className="font-headline mt-2 text-3xl font-bold tabular-nums">
          {googleConnected ? meetingCount : "—"}
        </div>
        <p className="mt-1 text-body-sm opacity-80">
          {googleConnected
            ? (nextMeetingLabel ?? "No upcoming")
            : "Connect Google"}
        </p>
      </Card>
    </section>
  );
}

type TriageItem =
  | { kind: "pr-review"; pr: PullRequest }
  | { kind: "pr-ci"; hit: CiWatchHit }
  | { kind: "jira"; issue: JiraIssue }
  | { kind: "mail"; message: GmailMessageSummary };

type NeedsMeProps = {
  filter: SourceFilter;
  onFilterChange: (f: SourceFilter) => void;
  reviewPrs: PullRequest[];
  reviewedPrs: PullRequest[];
  ciHits: CiWatchHit[];
  jira: JiraIssue[];
  gmail: GmailMessageSummary[];
  jiraConnected: boolean;
  googleConnected: boolean;
  loading: boolean;
  prLoading: boolean;
  prError: string | null;
  onSelectPr: (pr: PullRequest) => void;
  counts: { all: number; prs: number; jira: number; mail: number };
};

export function NeedsMeSection({
  filter,
  onFilterChange,
  reviewPrs,
  reviewedPrs,
  ciHits,
  jira,
  gmail,
  jiraConnected,
  googleConnected,
  loading,
  prLoading,
  prError,
  onSelectPr,
  counts,
}: NeedsMeProps) {
  const items = useMemo(() => {
    const list: TriageItem[] = [];
    if (filter === "all" || filter === "prs") {
      for (const pr of reviewPrs) list.push({ kind: "pr-review", pr });
      for (const hit of ciHits) list.push({ kind: "pr-ci", hit });
    }
    if (filter === "all" || filter === "jira") {
      for (const issue of jira) list.push({ kind: "jira", issue });
    }
    if (filter === "all" || filter === "mail") {
      for (const message of gmail) list.push({ kind: "mail", message });
    }
    return list;
  }, [filter, reviewPrs, ciHits, jira, gmail]);

  const busy = loading || prLoading;
  const empty =
    !busy &&
    !prError &&
    items.length === 0 &&
    (filter !== "prs" || reviewPrs.length === 0);

  return (
    <section aria-labelledby="needs-me-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="needs-me-heading"
          className="font-headline text-headline-sm font-semibold tracking-tight text-on-surface"
        >
          Needs me
        </h2>
        <TabsList aria-label="Source filter">
          {(
            [
              ["all", "All", counts.all],
              ["prs", "PRs", counts.prs],
              ["jira", "Jira", counts.jira],
              ["mail", "Mail", counts.mail],
            ] as const
          ).map(([id, label, count]) => (
            <TabsTrigger
              key={id}
              id={`today-filter-${id}`}
              aria-controls="today-needs-panel"
              active={filter === id}
              onClick={() => onFilterChange(id)}
            >
              {label}
              <span className="font-keycap text-on-surface-variant tabular-nums">
                {count}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {prError ? <ErrorBlock>{prError}</ErrorBlock> : null}

      <TabsPanel
        id="today-needs-panel"
        aria-labelledby={`today-filter-${filter}`}
        className="space-y-3"
      >
      {busy ? (
        <LoadingBlock>Loading today’s work…</LoadingBlock>
      ) : null}

      {empty ? (
        <Card padding="default" className="text-center">
          <CardTitle className="text-title-md">You’re clear</CardTitle>
          <CardDescription className="mt-1">
            {filter === "jira" && !jiraConnected
              ? "Connect Jira in Settings to see assigned issues."
              : filter === "mail" && !googleConnected
                ? "Connect Google in Settings to see unread mail."
                : "Nothing needs you right now. Check Pull Requests for the full queue."}
          </CardDescription>
          <div className="mt-4 flex justify-center gap-2">
            {filter === "jira" && !jiraConnected ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/settings">Open Settings</Link>
              </Button>
            ) : null}
            {filter === "mail" && !googleConnected ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/settings">Open Settings</Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link to="/?hub=prs">Pull Requests</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {!busy && items.length > 0 ? (
        <ul className="flex flex-col gap-2.5">
          {items.map((item) => {
            if (item.kind === "pr-review") {
              const pr = item.pr;
              return (
                <li key={`pr-${pr.repo}-${pr.number}`}>
                  <Card
                    variant="streamGithub"
                    padding="sm"
                    className="bg-surface-container-lowest text-on-surface"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="github">GitHub</Badge>
                          <span className="font-keycap text-body-sm text-on-surface-variant">
                            PR #{pr.number}
                          </span>
                          <span className="font-keycap text-body-sm text-on-surface-variant">
                            {pr.repo}
                          </span>
                          <Badge variant="accent">Needs review</Badge>
                          {pr.isDraft ? (
                            <Badge variant="outline">Draft</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-title-md font-semibold text-on-surface">
                          {pr.title}
                        </p>
                        <p className="mt-1 text-body-sm text-on-surface-variant">
                          Requested by {pr.author.login} ·{" "}
                          {relativeTime(pr.updatedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onSelectPr(pr)}
                        >
                          Review Diff
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            }
            if (item.kind === "pr-ci") {
              const { pr, description } = item.hit;
              return (
                <li key={`ci-${pr.repo}-${pr.number}`}>
                  <Card padding="sm" className="border-error/25">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="github">GitHub</Badge>
                          <span className="font-keycap text-body-sm text-on-surface-variant">
                            PR #{pr.number}
                          </span>
                          <Badge variant="error">CI failed</Badge>
                        </div>
                        <p className="mt-1.5 text-title-md font-semibold">
                          {pr.title}
                        </p>
                        <p className="mt-1 text-body-sm text-on-surface-variant">
                          {description} · {relativeTime(pr.updatedAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onSelectPr(pr)}
                      >
                        Inspect
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            }
            if (item.kind === "jira") {
              const issue = item.issue;
              return (
                <li key={`jira-${issue.key}`}>
                  <Card
                    variant="streamJira"
                    padding="sm"
                    className="bg-surface-container-lowest text-on-surface"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="jira">Jira</Badge>
                          <span className="font-keycap text-body-sm text-stream-jira-fg">
                            {issue.key}
                          </span>
                          <Badge variant="outline">{issue.status.name}</Badge>
                        </div>
                        <p className="mt-1.5 text-title-md font-semibold">
                          {issue.summary}
                        </p>
                        <p className="mt-1 text-body-sm text-on-surface-variant">
                          {issue.type.name}
                          {issue.priority ? ` · ${issue.priority}` : ""} ·{" "}
                          {relativeTime(issue.updatedAt)}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/jira/${issue.key}`}>Open Jira</Link>
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            }
            const message = item.message;
            return (
              <li key={`mail-${message.id}`}>
                <Card
                  variant="streamGmail"
                  padding="sm"
                  className="bg-surface-container-lowest text-on-surface"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="gmail">Gmail</Badge>
                        {message.unread ? (
                          <Badge variant="warning">Unread</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-title-md font-semibold">
                        {message.subject || "(no subject)"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-body-sm text-on-surface-variant">
                        {message.from} · {message.snippet}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/gmail/${message.id}`}>Open</Link>
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      {reviewedPrs.length > 0 && (filter === "all" || filter === "prs") ? (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-headline text-label-md font-semibold tracking-wide text-on-surface-variant uppercase">
              Already reviewed
            </h3>
            <Badge variant="success">{reviewedPrs.length}</Badge>
          </div>
          <ul className="flex flex-col gap-2 opacity-90">
            {reviewedPrs.slice(0, 8).map((pr) => (
              <li key={`reviewed-${pr.repo}-${pr.number}`}>
                <button
                  type="button"
                  onClick={() => onSelectPr(pr)}
                  className={cn(
                    "w-full rounded-xl border border-stream-ai-border bg-stream-ai/60 px-3 py-2.5 text-left transition-colors",
                    "hover:bg-stream-ai focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-keycap text-body-sm text-stream-ai-fg">
                      #{pr.number}
                    </span>
                    <span className="truncate text-body-md font-medium text-on-surface">
                      {pr.title}
                    </span>
                    {pr.localReviewEvent ? (
                      <ReviewStatusBadge event={pr.localReviewEvent} compact />
                    ) : (
                      <Badge variant="success">Already reviewed</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-body-sm text-on-surface-variant">
                    {pr.repo} · {relativeTime(pr.updatedAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      </TabsPanel>
    </section>
  );
}

type SidePreviewsProps = {
  calendar: CalendarEvent[];
  gmail: GmailMessageSummary[];
  jira: JiraIssue[];
  googleConnected: boolean;
  jiraConnected: boolean;
  calendarError: string | null;
  gmailError: string | null;
  jiraError: string | null;
  loading: boolean;
};

export function TodaySidePreviews({
  calendar,
  gmail,
  jira,
  googleConnected,
  jiraConnected,
  calendarError,
  gmailError,
  jiraError,
  loading,
}: SidePreviewsProps) {
  const topMail = gmail[0] ?? null;
  const upcoming = calendar.slice(0, 3);

  return (
    <aside className="flex flex-col gap-4">
      <section aria-labelledby="schedule-heading" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="schedule-heading"
            className="font-headline text-headline-sm font-semibold tracking-tight text-on-surface"
          >
            Today’s schedule
          </h2>
          <Badge variant="calendar">{upcoming.length} events</Badge>
        </div>
        <p className="text-body-sm text-on-surface-variant">
          {googleConnected
            ? "Google Calendar"
            : "Connect Google in Settings to sync meetings."}
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Loading agenda…
          </div>
        ) : null}

        {calendarError ? (
          <p className="text-body-sm text-error" role="alert">
            {calendarError}
          </p>
        ) : null}

        {!loading && googleConnected && upcoming.length === 0 && !calendarError ? (
          <Card padding="sm">
            <CardDescription>No meetings left today.</CardDescription>
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link to="/calendar">Open Calendar</Link>
            </Button>
          </Card>
        ) : null}

        {!googleConnected ? (
          <Card padding="sm" variant="streamCalendar">
            <CardDescription className="text-inherit opacity-90">
              Connect Google to see today’s agenda here.
            </CardDescription>
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link to="/settings">Settings</Link>
            </Button>
          </Card>
        ) : null}

        <ul className="flex flex-col gap-2">
          {upcoming.map((event, index) => {
            const isNext = index === 0;
            return (
              <li key={`${event.calendarId}-${event.id}`}>
                <Card
                  padding="sm"
                  className={cn(
                    isNext
                      ? "border-primary-container/50 ring-1 ring-primary-container/30"
                      : "",
                  )}
                >
                  <CardHeader className="mb-1">
                    {isNext ? (
                      <Badge variant="accent">Next up</Badge>
                    ) : (
                      <span className="text-body-sm text-on-surface-variant">
                        Later today
                      </span>
                    )}
                    <p className="font-keycap text-body-sm text-on-surface-variant">
                      {formatEventWhen(event)}
                    </p>
                    <CardTitle className="text-title-md">{event.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {event.hangoutLink ? (
                      <Button asChild size="sm" variant="accent">
                        <a
                          href={event.hangoutLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Join Meet
                        </a>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to={`/calendar/${encodeURIComponent(event.calendarId)}/${encodeURIComponent(event.id)}`}
                      >
                        Details
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Gmail preview">
        {topMail ? (
          <Card variant="streamGmail" padding="sm">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-label-md font-semibold">
                    {topMail.from}
                  </span>
                  <span className="shrink-0 text-body-sm opacity-80">
                    {relativeTime(
                      new Date(topMail.dateMs || Date.parse(topMail.date)).toISOString(),
                    )}
                  </span>
                </div>
                <p className="mt-1 text-title-md font-semibold text-inherit">
                  {topMail.subject || "(no subject)"}
                </p>
                <p className="mt-1 line-clamp-2 text-body-sm opacity-90">
                  {topMail.snippet}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm">
                    <Link to={`/gmail/${topMail.id}`}>Open mail</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/gmail">Inbox</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card padding="sm" variant="streamGmail">
            <CardTitle className="text-title-md text-inherit">Gmail</CardTitle>
            <CardDescription className="mt-1 text-inherit opacity-90">
              {gmailError
                ? gmailError
                : googleConnected
                  ? "No unread messages in preview."
                  : "Connect Google to preview unread mail."}
            </CardDescription>
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link to={googleConnected ? "/gmail" : "/settings"}>
                {googleConnected ? "Open Gmail" : "Settings"}
              </Link>
            </Button>
          </Card>
        )}
      </section>

      <section aria-label="Jira preview">
        <Card variant="streamJira" padding="sm">
          <CardHeader className="mb-2">
            <CardTitle className="text-title-md text-inherit">Jira</CardTitle>
            <CardDescription className="text-inherit opacity-90">
              {jiraConnected
                ? "Assigned unresolved issues"
                : "Connect Jira to preview your work."}
            </CardDescription>
          </CardHeader>
          {jiraError ? (
            <p className="text-body-sm text-error" role="alert">
              {jiraError}
            </p>
          ) : null}
          {jiraConnected && jira.length === 0 && !jiraError ? (
            <p className="text-body-sm opacity-90">No open issues assigned.</p>
          ) : null}
          <ul className="flex flex-col gap-1.5">
            {jira.slice(0, 3).map((issue) => (
              <li key={issue.key}>
                <Link
                  to={`/jira/${issue.key}`}
                  className="block rounded-lg px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="font-keycap text-body-sm">{issue.key}</span>
                  <span className="mt-0.5 block truncate text-body-md font-medium text-on-surface">
                    {issue.summary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Button asChild size="sm" variant="outline" className="mt-2">
            <Link to={jiraConnected ? "/jira" : "/settings"}>
              {jiraConnected ? "Open Jira" : "Settings"}
            </Link>
          </Button>
        </Card>
      </section>
    </aside>
  );
}

type TodayHeaderProps = {
  userName: string | null;
  userLogin: string;
  actionCount: number;
  onRefresh: () => void;
  refreshing: boolean;
  favoritesCount: number;
};

export function TodayHeader({
  userName,
  userLogin,
  actionCount,
  onRefresh,
  refreshing,
  favoritesCount,
}: TodayHeaderProps) {
  const greet = greetingFor();
  const name = firstName(userName, userLogin);
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-headline text-headline-lg font-bold tracking-tight text-on-surface">
          {greet}, {name}
        </h1>
        <p className="mt-1 text-body-lg text-on-surface-variant">
          Here’s what needs your attention today.
          {actionCount > 0 ? (
            <>
              {" "}
              You have{" "}
              <span className="font-semibold text-on-surface">
                {actionCount} high-priority action
                {actionCount === 1 ? "" : "s"}
              </span>
              .
            </>
          ) : (
            " You’re caught up on priority items."
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-keycap">
          {dateLabel}
        </Badge>
        <IconButton
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Refresh"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            className={cn("h-4 w-4", refreshing && "animate-spin")}
            aria-hidden
          />
        </IconButton>
        <Button asChild variant="outline" size="sm">
          <Link to="/people">People</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/repos">
            Repos
            {favoritesCount > 0 ? (
              <span className="tabular-nums opacity-70">{favoritesCount}</span>
            ) : null}
          </Link>
        </Button>
      </div>
    </header>
  );
}

export function useSourceFilter(initial: SourceFilter = "all") {
  return useState<SourceFilter>(initial);
}
