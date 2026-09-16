import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarEvent } from "@/features/calendar/types";
import type { GmailMessageSummary } from "@/features/gmail/types";
import type { JiraIssue } from "@/features/jira/types";

vi.mock("@/lib/use-settings", () => ({
  useJiraPublic: vi.fn(),
  useGooglePublic: vi.fn(),
}));
vi.mock("@/features/jira/api", () => ({
  searchJiraIssues: vi.fn(),
  jiraErrorMessage: vi.fn((e) => `jira:${String(e)}`),
}));
vi.mock("@/features/gmail/api", () => ({
  fetchGmailMessages: vi.fn(),
  gmailErrorMessage: vi.fn((e) => `gmail:${String(e)}`),
}));
vi.mock("@/features/calendar/api", () => ({
  fetchCalendarEvents: vi.fn(),
  calendarErrorMessage: vi.fn((e) => `cal:${String(e)}`),
}));
vi.mock("@/features/jira/jql", () => ({
  compileJql: vi.fn(() => "assignee = currentUser()"),
}));

import {
  calendarErrorMessage,
  fetchCalendarEvents,
} from "@/features/calendar/api";
import { fetchGmailMessages, gmailErrorMessage } from "@/features/gmail/api";
import { jiraErrorMessage, searchJiraIssues } from "@/features/jira/api";
import { compileJql } from "@/features/jira/jql";
import { useGooglePublic, useJiraPublic } from "@/lib/use-settings";

import { useTodaySideData } from "./useTodaySideData";

const mockJiraPublic = vi.mocked(useJiraPublic);
const mockGooglePublic = vi.mocked(useGooglePublic);
const mockSearchJira = vi.mocked(searchJiraIssues);
const mockFetchGmail = vi.mocked(fetchGmailMessages);
const mockFetchCalendar = vi.mocked(fetchCalendarEvents);
const mockCompileJql = vi.mocked(compileJql);

function makeJira(key: string): JiraIssue {
  return {
    id: key,
    key,
    summary: `Issue ${key}`,
    status: { id: "1", name: "Open", category: "new" },
    type: { id: "2", name: "Story", iconUrl: "", subtask: false },
    parent: null,
    labels: [],
    assignee: null,
    priority: "Medium",
    updatedAt: "2026-01-01T00:00:00.000Z",
    browseUrl: `https://example.atlassian.net/browse/${key}`,
    devStart: null,
    devEnd: null,
    storyPoints: null,
  };
}

function makeMail(id: string): GmailMessageSummary {
  return {
    id,
    threadId: `t-${id}`,
    subject: `Mail ${id}`,
    from: "sender@example.com",
    snippet: "Hello",
    date: "2026-01-01T00:00:00.000Z",
    dateMs: Date.parse("2026-01-01T00:00:00.000Z"),
    labelIds: ["UNREAD"],
    unread: true,
    starred: false,
  };
}

function makeEvent(id: string): CalendarEvent {
  return {
    id,
    calendarId: "primary",
    title: `Event ${id}`,
    htmlLink: "https://calendar.google.com",
    location: null,
    description: null,
    hangoutLink: null,
    allDay: false,
    startMs: Date.parse("2026-01-01T10:00:00.000Z"),
    endMs: Date.parse("2026-01-01T11:00:00.000Z"),
    attendees: [],
  };
}

describe("useTodaySideData", () => {
  beforeEach(() => {
    mockJiraPublic.mockReset();
    mockGooglePublic.mockReset();
    mockSearchJira.mockReset();
    mockFetchGmail.mockReset();
    mockFetchCalendar.mockReset();
    mockCompileJql.mockClear();
    vi.mocked(jiraErrorMessage).mockClear();
    vi.mocked(gmailErrorMessage).mockClear();
    vi.mocked(calendarErrorMessage).mockClear();
  });

  it("does nothing when disabled", async () => {
    mockJiraPublic.mockReturnValue({
      host: "https://example.atlassian.net",
      email: "a@example.com",
      displayName: "Alice",
      accountId: "acc",
      avatarUrl: "",
    });
    mockGooglePublic.mockReturnValue({ email: "a@example.com", name: "Alice" });

    const { result } = renderHook(() => useTodaySideData(false));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSearchJira).not.toHaveBeenCalled();
    expect(mockFetchGmail).not.toHaveBeenCalled();
    expect(mockFetchCalendar).not.toHaveBeenCalled();
    expect(result.current.jira).toEqual([]);
    expect(result.current.gmail).toEqual([]);
    expect(result.current.calendar).toEqual([]);
  });

  it("clears jira when Jira is not connected", async () => {
    mockJiraPublic.mockReturnValue(null);
    mockGooglePublic.mockReturnValue({ email: "a@example.com", name: "Alice" });
    mockFetchGmail.mockResolvedValue({
      messages: [makeMail("m1")],
      nextPageToken: null,
    });
    mockFetchCalendar.mockResolvedValue([makeEvent("e1")]);

    const { result } = renderHook(() => useTodaySideData(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSearchJira).not.toHaveBeenCalled();
    expect(result.current.jira).toEqual([]);
    expect(result.current.jiraError).toBeNull();
    expect(result.current.jiraConnected).toBe(false);
    expect(result.current.gmail).toHaveLength(1);
    expect(result.current.calendar).toHaveLength(1);
  });

  it("clears gmail and calendar when Google is not connected", async () => {
    mockJiraPublic.mockReturnValue({
      host: "https://example.atlassian.net",
      email: "a@example.com",
      displayName: "Alice",
      accountId: "acc",
      avatarUrl: "",
    });
    mockGooglePublic.mockReturnValue(null);
    mockSearchJira.mockResolvedValue({
      issues: [makeJira("TTD-1")],
      nextPageToken: null,
      isLast: true,
    });

    const { result } = renderHook(() => useTodaySideData(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchGmail).not.toHaveBeenCalled();
    expect(mockFetchCalendar).not.toHaveBeenCalled();
    expect(result.current.gmail).toEqual([]);
    expect(result.current.calendar).toEqual([]);
    expect(result.current.gmailError).toBeNull();
    expect(result.current.calendarError).toBeNull();
    expect(result.current.googleConnected).toBe(false);
    expect(result.current.jira).toHaveLength(1);
  });

  it("loads all three sources and slices previews to five", async () => {
    mockJiraPublic.mockReturnValue({
      host: "https://example.atlassian.net",
      email: "a@example.com",
      displayName: "Alice",
      accountId: "acc",
      avatarUrl: "",
    });
    mockGooglePublic.mockReturnValue({ email: "a@example.com", name: "Alice" });

    const jiraIssues = Array.from({ length: 7 }, (_, i) =>
      makeJira(`TTD-${i + 1}`),
    );
    const messages = Array.from({ length: 6 }, (_, i) => makeMail(`m${i + 1}`));
    const events = Array.from({ length: 8 }, (_, i) => makeEvent(`e${i + 1}`));

    mockSearchJira.mockResolvedValue({
      issues: jiraIssues,
      nextPageToken: null,
      isLast: true,
    });
    mockFetchGmail.mockResolvedValue({ messages, nextPageToken: null });
    mockFetchCalendar.mockResolvedValue(events);

    const { result } = renderHook(() => useTodaySideData(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockCompileJql).toHaveBeenCalled();
    expect(mockSearchJira).toHaveBeenCalledWith("assignee = currentUser()");
    expect(mockFetchGmail).toHaveBeenCalledWith({ tab: "unread", search: "" });
    expect(mockFetchCalendar).toHaveBeenCalledWith({ tab: "today" });
    expect(result.current.jira).toHaveLength(5);
    expect(result.current.jira[0]?.key).toBe("TTD-1");
    expect(result.current.gmail).toHaveLength(5);
    expect(result.current.calendar).toHaveLength(5);
    expect(result.current.jiraError).toBeNull();
    expect(result.current.gmailError).toBeNull();
    expect(result.current.calendarError).toBeNull();
  });

  it("sets error messages when fetches fail", async () => {
    mockJiraPublic.mockReturnValue({
      host: "https://example.atlassian.net",
      email: "a@example.com",
      displayName: "Alice",
      accountId: "acc",
      avatarUrl: "",
    });
    mockGooglePublic.mockReturnValue({ email: "a@example.com", name: "Alice" });

    const jiraErr = new Error("jira down");
    const gmailErr = new Error("gmail down");
    const calErr = new Error("cal down");
    mockSearchJira.mockRejectedValue(jiraErr);
    mockFetchGmail.mockRejectedValue(gmailErr);
    mockFetchCalendar.mockRejectedValue(calErr);

    const { result } = renderHook(() => useTodaySideData(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.jira).toEqual([]);
    expect(result.current.gmail).toEqual([]);
    expect(result.current.calendar).toEqual([]);
    expect(result.current.jiraError).toBe("jira:Error: jira down");
    expect(result.current.gmailError).toBe("gmail:Error: gmail down");
    expect(result.current.calendarError).toBe("cal:Error: cal down");
  });

  it("refresh() reloads data when enabled", async () => {
    mockJiraPublic.mockReturnValue({
      host: "https://example.atlassian.net",
      email: "a@example.com",
      displayName: "Alice",
      accountId: "acc",
      avatarUrl: "",
    });
    mockGooglePublic.mockReturnValue(null);
    mockSearchJira.mockResolvedValue({
      issues: [makeJira("TTD-1")],
      nextPageToken: null,
      isLast: true,
    });

    const { result } = renderHook(() => useTodaySideData(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockSearchJira).toHaveBeenCalledTimes(1);

    mockSearchJira.mockResolvedValue({
      issues: [makeJira("TTD-2"), makeJira("TTD-3")],
      nextPageToken: null,
      isLast: true,
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockSearchJira).toHaveBeenCalledTimes(2);
    expect(result.current.jira).toHaveLength(2);
    expect(result.current.jira[0]?.key).toBe("TTD-2");
    expect(result.current.loading).toBe(false);
  });
});
