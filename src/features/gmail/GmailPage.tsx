import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
  fetchGmailLabels,
  fetchGmailMessages,
  gmailErrorMessage,
  needsGmailReconnect,
  starGmailMessage,
} from "./api";
import { GmailMessageRow } from "./GmailMessageRow";
import type { GmailLabel, GmailMessageSummary, GmailTab } from "./types";

const TABS: Array<{ id: GmailTab; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "unread", label: "Unread" },
  { id: "starred", label: "Starred" },
  { id: "sent", label: "Sent" },
];

function emptyCopy(tab: GmailTab, search: string): string {
  if (search.trim()) return "No search results.";
  switch (tab) {
    case "unread":
      return "No unread messages.";
    case "starred":
      return "No starred messages.";
    case "sent":
      return "No sent messages match this view.";
    default:
      return "No messages in inbox.";
  }
}

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
  const [starringId, setStarringId] = useState<string | null>(null);
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

  async function onToggleStar(message: GmailMessageSummary) {
    const nextStarred = !message.starred;
    setStarringId(message.id);
    try {
      await starGmailMessage(message.id, nextStarred);
      setMessages((prev) =>
        prev.map((row) =>
          row.id === message.id
            ? {
                ...row,
                starred: nextStarred,
                labelIds: nextStarred
                  ? [...row.labelIds, "STARRED"]
                  : row.labelIds.filter((id) => id !== "STARRED"),
              }
            : row,
        ),
      );
      toast.success(nextStarred ? "Starred" : "Unstarred");
    } catch (err) {
      toast.error(gmailErrorMessage(err));
    } finally {
      setStarringId(null);
    }
  }

  if (!connected) {
    return (
      <PageShell>
        <PageHeader backTo="/" title="Gmail" subtitle="Connect Google" />
        <Card padding="default" className="border-stream-gmail-border/80">
          <CardHeader className="mb-2">
            <CardTitle className="text-title-md">Gmail not connected</CardTitle>
            <CardDescription>
              Link Google to triage unread mail beside PR and Jira work.
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
        title="Gmail"
        subtitle={`Email triage · ${connected.name || connected.email}`}
        leading={
          <Badge variant="gmail" className="mt-1">
            Gmail
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

      {reconnect ? (
        <ErrorBlock tone="warning">
          Gmail scopes may be missing on this account.{" "}
          <Link to="/settings" className="underline underline-offset-2">
            Reconnect Google
          </Link>{" "}
          to enable Calendar and Gmail.
        </ErrorBlock>
      ) : null}

      <Card padding="default" className="border-stream-gmail-border/80">
        <CardHeader className="mb-3">
          <CardTitle className="text-title-md font-semibold">
            Inbox workspace
          </CardTitle>
          <CardDescription>
            Scan unread and starred mail quickly — not a full Gmail clone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <TabsList aria-label="Gmail folders" className="h-auto flex-wrap">
              {TABS.map((item) => (
                <TabsTrigger
                  key={item.id}
                  id={`gmail-tab-${item.id}`}
                  aria-controls="gmail-tab-panel"
                  active={tab === item.id}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>

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

          {error ? <ErrorBlock tone="warning">{error}</ErrorBlock> : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-keycap text-body-sm text-on-surface-variant">
          {loading && messages.length === 0
            ? "Loading…"
            : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <TabsPanel
        id="gmail-tab-panel"
        aria-labelledby={`gmail-tab-${tab}`}
        className="space-y-3"
      >
        <Card padding="none" className="overflow-hidden">
          {loading && messages.length === 0 ? (
            <LoadingBlock embedded>Loading messages…</LoadingBlock>
          ) : messages.length === 0 ? (
            <p className="px-4 py-12 text-center text-body-md text-on-surface-variant">
              {emptyCopy(tab, search)}
            </p>
          ) : (
            <ul>
              {messages.map((message) => (
                <GmailMessageRow
                  key={message.id}
                  message={message}
                  starring={starringId === message.id}
                  onToggleStar={(row) => void onToggleStar(row)}
                />
              ))}
            </ul>
          )}
        </Card>

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
      </TabsPanel>
    </PageShell>
  );
}
