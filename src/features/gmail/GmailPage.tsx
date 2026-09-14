import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  fetchGmailLabels,
  fetchGmailMessages,
  gmailErrorMessage,
  needsGmailReconnect,
} from "./api";
import { GmailMessageRow } from "./GmailMessageRow";
import type { GmailLabel, GmailMessageSummary, GmailTab } from "./types";

const TABS: Array<{ id: GmailTab; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "unread", label: "Unread" },
  { id: "starred", label: "Starred" },
  { id: "sent", label: "Sent" },
];

export function GmailPage() {
  const connected = useGooglePublic();
  const [tab, setTab] = useState<GmailTab>("unread");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [labelId, setLabelId] = useState<string>("all");
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState(false);

  const load = useCallback(
    async (reset: boolean, token?: string | null) => {
      if (!connected) return;
      setLoading(true);
      if (reset) {
        setError(null);
        setReconnect(false);
      }
      try {
        const page = await fetchGmailMessages({
          tab,
          search,
          labelId: labelId === "all" ? undefined : labelId,
          pageToken: token ?? null,
        });
        setMessages((prev) =>
          reset ? page.messages : [...prev, ...page.messages],
        );
        setNextToken(page.nextPageToken);
      } catch (err) {
        const message = gmailErrorMessage(err);
        setError(message);
        if (reset) setMessages([]);
        if (needsGmailReconnect(err)) setReconnect(true);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [connected, tab, search, labelId],
  );

  useEffect(() => {
    document.title = "Gmail · IM Review";
  }, []);

  useEffect(() => {
    if (!connected) return;
    void fetchGmailLabels()
      .then(setLabels)
      .catch(() => setLabels([]));
  }, [connected]);

  useEffect(() => {
    if (!connected) return;
    void load(true);
  }, [connected, load]);

  function applySearch() {
    setSearch(searchDraft.trim());
  }

  if (!connected) {
    return (
      <PageShell>
        <PageHeader backTo="/" title="Gmail" subtitle="Connect Google" />
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
        title="Gmail"
        subtitle={`${connected.name || connected.email}`}
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

      {reconnect ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Gmail scopes may be missing on this account.{" "}
          <Link to="/settings" className="underline underline-offset-2">
            Reconnect Google
          </Link>{" "}
          to enable Calendar and Gmail.
        </p>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Gmail folders"
            className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            {TABS.map((item) => {
              const selected = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    selected
                      ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <Select value={labelId} onValueChange={setLabelId}>
            <SelectTrigger className="w-40" aria-label="Label filter">
              <SelectValue placeholder="Label" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All labels</SelectItem>
              {labels.map((label) => (
                <SelectItem key={label.id} value={label.id}>
                  {label.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <form
            className="flex min-w-48 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              applySearch();
            }}
          >
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Gmail search…"
              aria-label="Gmail search"
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" variant="outline">
              Apply
            </Button>
          </form>
        </div>

        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-neutral-500">
              No messages match this view.
            </p>
          ) : (
            <ul>
              {messages.map((message) => (
                <GmailMessageRow key={message.id} message={message} />
              ))}
            </ul>
          )}
        </div>

        {nextToken ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load(false, nextToken)}
          >
            Load more
          </Button>
        ) : null}
      </div>
    </PageShell>
  );
}
