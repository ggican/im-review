import { useCallback, useEffect, useState } from "react";

import {
  calendarErrorMessage,
  fetchCalendarEvents,
} from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/types";
import { fetchGmailMessages, gmailErrorMessage } from "@/features/gmail/api";
import type { GmailMessageSummary } from "@/features/gmail/types";
import { jiraErrorMessage, searchJiraIssues } from "@/features/jira/api";
import { compileJql } from "@/features/jira/jql";
import type { JiraIssue } from "@/features/jira/types";
import { useGooglePublic, useJiraPublic } from "@/lib/use-settings";

const PREVIEW_LIMIT = 5;

export type TodaySideData = {
  jira: JiraIssue[];
  gmail: GmailMessageSummary[];
  calendar: CalendarEvent[];
  jiraConnected: boolean;
  googleConnected: boolean;
  loading: boolean;
  jiraError: string | null;
  gmailError: string | null;
  calendarError: string | null;
  refresh: () => Promise<void>;
};

export function useTodaySideData(enabled: boolean): TodaySideData {
  const jiraPublic = useJiraPublic();
  const googlePublic = useGooglePublic();
  const jiraConnected = Boolean(jiraPublic);
  const googleConnected = Boolean(googlePublic);

  const [jira, setJira] = useState<JiraIssue[]>([]);
  const [gmail, setGmail] = useState<GmailMessageSummary[]>([]);
  const [calendar, setCalendar] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [jiraError, setJiraError] = useState<string | null>(null);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    const jobs: Promise<void>[] = [];

    if (jiraConnected) {
      jobs.push(
        (async () => {
          try {
            const jql = compileJql({
              typeNames: [],
              labels: [],
              extraJql: "",
              includeDone: false,
            });
            const page = await searchJiraIssues(jql);
            setJira(page.issues.slice(0, PREVIEW_LIMIT));
            setJiraError(null);
          } catch (err) {
            setJira([]);
            setJiraError(jiraErrorMessage(err));
          }
        })(),
      );
    } else {
      setJira([]);
      setJiraError(null);
    }

    if (googleConnected) {
      jobs.push(
        (async () => {
          try {
            const page = await fetchGmailMessages({
              tab: "unread",
              search: "",
            });
            setGmail(page.messages.slice(0, PREVIEW_LIMIT));
            setGmailError(null);
          } catch (err) {
            setGmail([]);
            setGmailError(gmailErrorMessage(err));
          }
        })(),
      );
      jobs.push(
        (async () => {
          try {
            const events = await fetchCalendarEvents({ tab: "today" });
            setCalendar(events.slice(0, PREVIEW_LIMIT));
            setCalendarError(null);
          } catch (err) {
            setCalendar([]);
            setCalendarError(calendarErrorMessage(err));
          }
        })(),
      );
    } else {
      setGmail([]);
      setCalendar([]);
      setGmailError(null);
      setCalendarError(null);
    }

    await Promise.all(jobs);
    setLoading(false);
  }, [enabled, jiraConnected, googleConnected]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    jira,
    gmail,
    calendar,
    jiraConnected,
    googleConnected,
    loading,
    jiraError,
    gmailError,
    calendarError,
    refresh,
  };
}
