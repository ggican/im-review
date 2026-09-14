import {
  createBrowserRouter,
  Navigate,
  Outlet,
  redirect,
} from "react-router-dom";

import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { api } from "@/lib/api";
import { AiReviewPage } from "@/routes/ai-review";
import { CalendarEventPage, CalendarPage } from "@/routes/calendar";
import { DashboardPage } from "@/routes/dashboard";
import { GmailMessagePage, GmailPage } from "@/routes/gmail";
import { JiraIssuePage, JiraPage } from "@/routes/jira";
import { MetricsPage } from "@/routes/metrics";
import { OnboardingPage } from "@/routes/onboarding";
import { PeoplePage } from "@/routes/people";
import { ReposPage } from "@/routes/repos";
import { SettingsPage } from "@/routes/settings";

export async function requireAuth() {
  const ok = await api.hasToken();
  if (!ok) throw redirect("/onboarding");
  return null;
}

export async function redirectIfAuthed() {
  const ok = await api.hasToken();
  if (ok) throw redirect("/");
  return null;
}

function AppShell() {
  return (
    <>
      <Outlet />
      <CommandPalette />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      {
        path: "/onboarding",
        loader: redirectIfAuthed,
        element: <OnboardingPage />,
      },
      {
        path: "/",
        loader: requireAuth,
        element: <DashboardPage />,
      },
      {
        path: "/repos",
        loader: requireAuth,
        element: <ReposPage />,
      },
      {
        path: "/people",
        loader: requireAuth,
        element: <PeoplePage />,
      },
      {
        path: "/jira",
        loader: requireAuth,
        element: <JiraPage />,
      },
      {
        path: "/jira/:issueKey",
        loader: requireAuth,
        element: <JiraIssuePage />,
      },
      {
        path: "/calendar",
        loader: requireAuth,
        element: <CalendarPage />,
      },
      {
        path: "/calendar/:calendarId/:eventId",
        loader: requireAuth,
        element: <CalendarEventPage />,
      },
      {
        path: "/gmail",
        loader: requireAuth,
        element: <GmailPage />,
      },
      {
        path: "/gmail/:messageId",
        loader: requireAuth,
        element: <GmailMessagePage />,
      },
      {
        path: "/settings",
        loader: requireAuth,
        element: <SettingsPage />,
      },
      {
        path: "/metrics",
        loader: requireAuth,
        element: <MetricsPage />,
      },
      {
        path: "/review/:owner/:repo/:number",
        loader: requireAuth,
        element: <AiReviewPage />,
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
