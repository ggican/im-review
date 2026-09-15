import {
  BarChart3,
  BookMarked,
  CalendarDays,
  GitPullRequest,
  Mail,
  Search,
  Settings,
  Sparkles,
  SquareKanban,
  Users,
} from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  flattenPrCache,
  getPrCache,
  subscribePrCache,
} from "@/features/pr/pr-cache";
import { cn } from "@/lib/cn";
import { getLastSeenSnapshot, isPrNew, subscribeLastSeen } from "@/lib/seen";
import { getFavorites, getFavoriteUsers } from "@/lib/settings";

const OPEN_EVENT = "im-review:open-command-palette";

export function openCommandPalette(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: typeof Search;
  run: () => void;
};

function reviewPath(repo: string, number: number): string {
  const [owner, name] = repo.split("/");
  return `/review/${owner}/${name}/${number}`;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const lists = useSyncExternalStore(subscribePrCache, getPrCache, getPrCache);
  const lastSeen = useSyncExternalStore(
    subscribeLastSeen,
    getLastSeenSnapshot,
    getLastSeenSnapshot,
  );

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nav: PaletteItem[] = [
      {
        id: "nav-home",
        label: "Today",
        hint: "Work desk",
        group: "Navigate",
        icon: GitPullRequest,
        run: () => navigate("/"),
      },
      {
        id: "nav-repos",
        label: "Repos",
        hint: "Favorites & all repos",
        group: "Navigate",
        icon: BookMarked,
        run: () => navigate("/repos"),
      },
      {
        id: "nav-people",
        label: "People",
        hint: "Favorite authors",
        group: "Navigate",
        icon: Users,
        run: () => navigate("/people"),
      },
      {
        id: "nav-jira",
        label: "Jira",
        hint: "My work & saved filters",
        group: "Navigate",
        icon: SquareKanban,
        run: () => navigate("/jira"),
      },
      {
        id: "nav-calendar",
        label: "Calendar",
        hint: "Upcoming Google events",
        group: "Navigate",
        icon: CalendarDays,
        run: () => navigate("/calendar"),
      },
      {
        id: "nav-gmail",
        label: "Gmail",
        hint: "Inbox & unread mail",
        group: "Navigate",
        icon: Mail,
        run: () => navigate("/gmail"),
      },
      {
        id: "nav-metrics",
        label: "Metrics",
        hint: "Scorecard",
        group: "Navigate",
        icon: BarChart3,
        run: () => navigate("/metrics"),
      },
      {
        id: "nav-settings",
        label: "Settings",
        hint: "Keys & preferences",
        group: "Navigate",
        icon: Settings,
        run: () => navigate("/settings"),
      },
    ];

    const prs = flattenPrCache(lists).map((pr) => {
      const neu = isPrNew(pr, lastSeen);
      return {
        id: `pr-${pr.repo}#${pr.number}`,
        label: pr.title,
        hint: `${pr.repo}#${pr.number}${neu ? " · New" : ""}`,
        group: "Pull requests",
        icon: neu ? Sparkles : GitPullRequest,
        run: () => navigate(reviewPath(pr.repo, pr.number)),
      } satisfies PaletteItem;
    });

    const favs = getFavorites().map((fullName) => ({
      id: `fav-${fullName}`,
      label: fullName,
      hint: "Favorite repo",
      group: "Favorites",
      icon: BookMarked,
      run: () => navigate("/repos"),
    }));

    const people = getFavoriteUsers().map((user) => ({
      id: `person-${user.login}`,
      label: `@${user.login}`,
      hint: user.name ?? "Favorite person",
      group: "People",
      icon: Users,
      run: () => navigate(`/?author=${encodeURIComponent(user.login)}`),
    }));

    const all = [...nav, ...prs, ...favs, ...people];
    const at = q.startsWith("@")
      ? q.slice(1)
      : q.startsWith("user ")
        ? q.slice(5)
        : null;
    if (at && at.length > 0) {
      all.unshift({
        id: `author-search-${at}`,
        label: `PRs by @${at.replace(/^@/, "")}`,
        hint: "Author search",
        group: "People",
        icon: Users,
        run: () =>
          navigate(
            `/?author=${encodeURIComponent(at.replace(/^@/, ""))}&by=all`,
          ),
      });
    }
    if (!q) return all.slice(0, 40);
    return all
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.hint?.toLowerCase().includes(q) ?? false) ||
          item.group.toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [lists, lastSeen, navigate, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  function runItem(item: PaletteItem) {
    setOpen(false);
    item.run();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) runItem(item);
    }
  }

  let lastGroup = "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        side="center"
        className="max-h-[min(32rem,80vh)] gap-0 overflow-hidden border-border p-0 shadow-xl"
      >
        <DialogHeader className="border-b border-border bg-chrome px-4 py-3 pr-12 text-chrome-foreground">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <DialogDescription className="sr-only">
            Jump to pages, pull requests, or favorite repos
          </DialogDescription>
          <div className="flex items-center gap-2">
            <Search
              className="h-4 w-4 shrink-0 text-chrome-muted"
              aria-hidden
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Jump to PR, repo, or page…"
              className="w-full bg-transparent text-body-md text-chrome-foreground outline-none placeholder:text-chrome-muted"
              aria-label="Search commands"
            />
            <kbd className="hidden rounded border border-chrome-recessed bg-chrome-recessed px-1.5 py-0.5 font-keycap text-chrome-muted sm:inline">
              esc
            </kbd>
          </div>
        </DialogHeader>

        <div
          role="listbox"
          aria-label="Commands"
          className="max-h-[min(24rem,60vh)] overflow-y-auto bg-surface-container-lowest p-2"
        >
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-body-md text-on-surface-variant">
              No matches.
            </p>
          ) : (
            items.map((item, index) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              const selected = index === active;
              return (
                <div key={item.id}>
                  {showGroup ? (
                    <div className="px-2 pt-2 pb-1 text-label-sm tracking-wide text-on-surface-variant uppercase">
                      {item.group}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => runItem(item)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-body-md",
                      selected
                        ? "bg-primary text-on-primary"
                        : "text-on-surface hover:bg-surface-container-low",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        selected ? "opacity-90" : "text-on-surface-variant",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span
                        className={cn(
                          "hidden max-w-[40%] truncate text-body-sm sm:inline",
                          selected ? "opacity-80" : "text-on-surface-variant",
                        )}
                      >
                        {item.hint}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border bg-surface-container-low/50 px-4 py-2 text-body-sm text-on-surface-variant">
          <span className="font-keycap">⌘K</span> /{" "}
          <span className="font-keycap">Ctrl+K</span> · ↑↓ · Enter
        </div>
      </DialogContent>
    </Dialog>
  );
}
