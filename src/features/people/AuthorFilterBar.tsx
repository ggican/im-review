import { type FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sameGithubLogin } from "@/features/people/login";
import type { AuthorFilterMode, FavoriteUser } from "@/features/people/types";
import type { PullRequest } from "@/features/pr/types";
import { cn } from "@/lib/cn";

type Props = {
  authorLogin: string | null;
  authorMode: AuthorFilterMode;
  tabItems: PullRequest[];
  favoriteUsers: FavoriteUser[];
  onChange: (login: string | null, mode: AuthorFilterMode) => void;
};

export function AuthorFilterBar({
  authorLogin,
  authorMode,
  tabItems,
  favoriteUsers,
  onChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const authors = useMemo(() => {
    const map = new Map<string, { login: string; avatarUrl: string }>();
    for (const user of favoriteUsers) {
      map.set(user.login.toLowerCase(), {
        login: user.login,
        avatarUrl: user.avatarUrl,
      });
    }
    for (const pr of tabItems) {
      const key = pr.author.login.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          login: pr.author.login,
          avatarUrl: pr.author.avatarUrl,
        });
      }
    }
    return [...map.values()];
  }, [favoriteUsers, tabItems]);

  const q = query.trim().replace(/^@+/, "").toLowerCase();
  const suggestions = q
    ? authors.filter(
        (a) =>
          a.login.toLowerCase().includes(q) ||
          favoriteUsers.some(
            (u) =>
              sameGithubLogin(u.login, a.login) &&
              (u.name ?? "").toLowerCase().includes(q),
          ),
      )
    : authors.slice(0, 8);

  function apply(login: string, mode: AuthorFilterMode) {
    setQuery("");
    setOpen(false);
    onChange(login, mode);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const login = query.trim().replace(/^@+/, "");
    if (!login) return;
    const inTab = tabItems.some((pr) =>
      sameGithubLogin(pr.author.login, login),
    );
    apply(login, inTab ? "filter" : "search");
  }

  const visibleChips = favoriteUsers.slice(0, 8);
  const extra = favoriteUsers.length - visibleChips.length;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <form className="relative w-40 shrink-0" onSubmit={onSubmit}>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder="Author…"
          aria-label="Filter by author"
          className="h-8 text-xs"
        />
        {open && suggestions.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-md dark:border-neutral-800 dark:bg-neutral-950">
            {suggestions.map((a) => (
              <li key={a.login}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const inTab = tabItems.some((pr) =>
                      sameGithubLogin(pr.author.login, a.login),
                    );
                    apply(a.login, inTab ? "filter" : "search");
                  }}
                >
                  {a.avatarUrl ? (
                    <img
                      src={a.avatarUrl}
                      alt=""
                      className="h-4 w-4 rounded-full"
                    />
                  ) : (
                    <span className="h-4 w-4 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  @{a.login}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
      {authorLogin ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(null, "filter")}
        >
          @{authorLogin}
          {authorMode === "search" ? " · all" : ""} ×
        </Button>
      ) : null}
      {visibleChips.map((user) => {
        const selected =
          authorLogin != null && sameGithubLogin(authorLogin, user.login);
        return (
          <button
            key={user.login}
            type="button"
            onClick={() => {
              if (selected) {
                onChange(null, "filter");
                return;
              }
              const inTab = tabItems.some((pr) =>
                sameGithubLogin(pr.author.login, user.login),
              );
              onChange(user.login, inTab ? "filter" : "search");
            }}
            className={cn(
              "inline-flex max-w-[9rem] items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
              selected
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-400 dark:border-neutral-800 dark:text-neutral-300",
            )}
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-3.5 w-3.5 rounded-full"
              />
            ) : null}
            <span className="truncate">@{user.login}</span>
          </button>
        );
      })}
      {extra > 0 ? (
        <span className="text-xs text-neutral-400">+{extra}</span>
      ) : null}
    </div>
  );
}
