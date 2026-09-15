import {
  BarChart3,
  CalendarDays,
  GitPullRequest,
  LayoutDashboard,
  LogOut,
  Mail,
  Moon,
  Search,
  Settings,
  SquareKanban,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import imReviewLogo from "@/assets/im-review-logo.png";
import { Button, IconButton } from "@/components/ui/button";
import { openCommandPalette } from "@/features/command-palette/CommandPalette";
import { api, type GithubUser } from "@/lib/api";
import { cn } from "@/lib/cn";
import { getSettings, saveSettings, type ThemeMode } from "@/lib/settings";
import { useSettings } from "@/lib/use-settings";

type NavItem = {
  id: string;
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  isActive: (pathname: string, search: string) => boolean;
};

const PRIMARY_NAV: NavItem[] = [
  {
    id: "today",
    label: "Today",
    to: "/",
    icon: LayoutDashboard,
    isActive: (pathname, search) =>
      pathname === "/" && !new URLSearchParams(search).get("hub"),
  },
  {
    id: "prs",
    label: "Pull Requests",
    to: "/?hub=prs",
    icon: GitPullRequest,
    isActive: (pathname, search) =>
      pathname.startsWith("/review") ||
      (pathname === "/" && new URLSearchParams(search).get("hub") === "prs"),
  },
  {
    id: "jira",
    label: "Jira",
    to: "/jira",
    icon: SquareKanban,
    isActive: (pathname) => pathname.startsWith("/jira"),
  },
  {
    id: "gmail",
    label: "Gmail",
    to: "/gmail",
    icon: Mail,
    isActive: (pathname) => pathname.startsWith("/gmail"),
  },
  {
    id: "calendar",
    label: "Calendar",
    to: "/calendar",
    icon: CalendarDays,
    isActive: (pathname) => pathname.startsWith("/calendar"),
  },
  {
    id: "metrics",
    label: "Metrics",
    to: "/metrics",
    icon: BarChart3,
    isActive: (pathname) => pathname.startsWith("/metrics"),
  },
  {
    id: "settings",
    label: "Settings",
    to: "/settings",
    icon: Settings,
    isActive: (pathname) => pathname.startsWith("/settings"),
  },
];

function nextTheme(theme: ThemeMode): ThemeMode {
  if (theme === "light") return "dark";
  if (theme === "dark") return "system";
  return "light";
}

function themeLabel(theme: ThemeMode): string {
  if (theme === "dark") return "Dark theme";
  if (theme === "light") return "Light theme";
  return "System theme";
}

export function AppChrome() {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useSettings();
  const [user, setUser] = useState<GithubUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api
      .validateToken()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const darkUi = useMemo(() => {
    if (settings.theme === "dark") return true;
    if (settings.theme === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, [settings.theme]);

  async function onLogout() {
    await api.deleteToken();
    toast.success("Signed out");
    navigate("/onboarding", { replace: true });
  }

  function onToggleTheme() {
    const current = getSettings();
    saveSettings({ ...current, theme: nextTheme(current.theme) });
  }

  return (
    <header className="surface-chrome sticky top-0 z-30 border-b border-white/10">
      <div className="mx-auto flex h-14 w-full max-w-[1140px] items-center gap-3 px-4">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
          aria-label="IM Review home"
        >
          <img src={imReviewLogo} alt="" className="h-7 w-7 rounded-md" />
          <span className="font-headline hidden text-sm font-semibold tracking-tight text-chrome-foreground sm:inline">
            IM Review
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden min-w-0 flex-1 items-center gap-0.5 md:flex"
        >
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(location.pathname, location.search);
            return (
              <NavLink
                key={item.id}
                to={item.to}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-white/10 text-chrome-foreground"
                    : "text-chrome-muted hover:bg-white/5 hover:text-chrome-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                <span className="hidden xl:inline" aria-hidden>
                  {item.label}
                </span>
                <span className="xl:hidden" aria-hidden>
                  {item.id === "prs" ? "PRs" : item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Open command palette"
            className="h-8 gap-1.5 border border-white/10 bg-chrome-recessed px-2.5 text-chrome-muted hover:bg-white/10 hover:text-chrome-foreground"
            onClick={() => openCommandPalette()}
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span className="font-keycap text-chrome-muted">⌘K</span>
          </Button>

          <IconButton
            variant="ghost"
            size="icon-sm"
            aria-label={themeLabel(settings.theme)}
            title={themeLabel(settings.theme)}
            className="text-chrome-muted hover:bg-white/10 hover:text-chrome-foreground"
            onClick={onToggleTheme}
          >
            {darkUi ? (
              <Moon className="h-4 w-4" aria-hidden />
            ) : (
              <Sun className="h-4 w-4" aria-hidden />
            )}
          </IconButton>

          <div className="ml-1 hidden items-center gap-2 border-l border-white/10 pl-2 sm:flex">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-7 w-7 rounded-full border border-white/15"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-chrome-recessed" />
            )}
            <div className="min-w-0 max-w-[9rem]">
              <div className="truncate text-xs font-medium text-chrome-foreground">
                {user?.name ?? user?.login ?? "…"}
              </div>
              <div className="truncate text-[10px] text-chrome-muted">
                {user ? `@${user.login}` : "Signed in"}
              </div>
            </div>
          </div>

          <IconButton
            variant="ghost"
            size="icon-sm"
            aria-label="Sign out"
            className="text-chrome-muted hover:bg-white/10 hover:text-chrome-foreground"
            onClick={() => void onLogout()}
          >
            <LogOut className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <nav
        aria-label="Primary mobile"
        className="flex gap-1 overflow-x-auto border-t border-white/10 px-3 py-2 md:hidden"
      >
        {PRIMARY_NAV.map((item) => {
          const active = item.isActive(location.pathname, location.search);
          return (
            <NavLink
              key={item.id}
              to={item.to}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium",
                active
                  ? "bg-white/10 text-chrome-foreground"
                  : "text-chrome-muted",
              )}
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </header>
  );
}
