import {
  BarChart3,
  BookMarked,
  GitPullRequest,
  Search,
  Settings,
  Sparkles,
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
import { getFavorites } from "@/lib/settings";

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
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        label: "Dashboard",
        hint: "PR lists",
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

    const all = [...nav, ...prs, ...favs];
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
        className="max-h-[min(32rem,80vh)] gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="border-b border-neutral-200 px-4 py-3 pr-12 dark:border-neutral-800">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <DialogDescription className="sr-only">
            Jump to pages, pull requests, or favorite repos
          </DialogDescription>
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-neutral-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Jump to PR, repo, or page…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
              aria-label="Search commands"
            />
            <kbd className="hidden rounded border border-neutral-200 px-1.5 py-0.5 font-mono text-xs text-neutral-400 sm:inline dark:border-neutral-700">
              esc
            </kbd>
          </div>
        </DialogHeader>

        <div
          role="listbox"
          aria-label="Commands"
          className="max-h-[min(24rem,60vh)] overflow-y-auto p-2"
        >
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-neutral-500">
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
                    <div className="px-2 pt-2 pb-1 text-xs font-semibold tracking-wide text-neutral-400 uppercase">
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
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
                      selected
                        ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                        : "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        selected ? "opacity-90" : "text-neutral-400",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span
                        className={cn(
                          "hidden max-w-[40%] truncate text-xs sm:inline",
                          selected ? "opacity-70" : "text-neutral-400",
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

        <div className="border-t border-neutral-200 px-4 py-2 text-xs text-neutral-400 dark:border-neutral-800">
          <span className="font-mono">⌘K</span> /{" "}
          <span className="font-mono">Ctrl+K</span> · ↑↓ · Enter
        </div>
      </DialogContent>
    </Dialog>
  );
}
