import { openUrl } from "@tauri-apps/plugin-opener";
import { Archive, ExternalLink, Loader2, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { cn } from "@/lib/cn";
import { favoriteStarClass } from "@/lib/favorite-styles";
import { useGooglePublic } from "@/lib/use-settings";

import {
  archiveGmailMessage,
  fetchGmailMessage,
  gmailErrorMessage,
  markGmailRead,
  starGmailMessage,
} from "./api";
import type { GmailMessage } from "./types";

export function GmailMessagePage() {
  const { messageId = "" } = useParams();
  const connected = useGooglePublic();
  const [message, setMessage] = useState<GmailMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!connected || !messageId) return;
    setLoading(true);
    setError(null);
    try {
      setMessage(await fetchGmailMessage(messageId));
    } catch (err) {
      setError(gmailErrorMessage(err));
      setMessage(null);
    } finally {
      setLoading(false);
    }
  }, [connected, messageId]);

  useEffect(() => {
    document.title = message?.subject
      ? `${message.subject} · Gmail · IM Review`
      : "Gmail · IM Review";
  }, [message?.subject]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openInGmail() {
    if (!message) return;
    try {
      await openUrl(message.permalink);
    } catch (err) {
      toast.error(String(err));
    }
  }

  async function toggleRead() {
    if (!message) return;
    setSaving(true);
    try {
      const nextRead = message.unread;
      await markGmailRead(message.id, nextRead);
      setMessage({
        ...message,
        unread: !nextRead,
        labelIds: nextRead
          ? message.labelIds.filter((id) => id !== "UNREAD")
          : [...message.labelIds, "UNREAD"],
      });
      toast.success(nextRead ? "Marked as read" : "Marked as unread");
    } catch (err) {
      toast.error(gmailErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStar() {
    if (!message) return;
    setSaving(true);
    try {
      const nextStarred = !message.starred;
      await starGmailMessage(message.id, nextStarred);
      setMessage({
        ...message,
        starred: nextStarred,
        labelIds: nextStarred
          ? [...message.labelIds, "STARRED"]
          : message.labelIds.filter((id) => id !== "STARRED"),
      });
      toast.success(nextStarred ? "Starred" : "Unstarred");
    } catch (err) {
      toast.error(gmailErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!message) return;
    setSaving(true);
    try {
      await archiveGmailMessage(message.id);
      toast.success("Archived");
      setMessage({
        ...message,
        labelIds: message.labelIds.filter((id) => id !== "INBOX"),
      });
    } catch (err) {
      toast.error(gmailErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!connected) {
    return (
      <PageShell>
        <PageHeader backTo="/gmail" title="Gmail" subtitle="Connect first" />
        <Card padding="default" className="border-stream-gmail-border/80">
          <CardHeader className="mb-2">
            <CardTitle className="text-title-md">Gmail not connected</CardTitle>
            <CardDescription>
              Connect Google in Settings to open messages.
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
        backTo="/gmail"
        title={message?.subject ?? messageId}
        subtitle={message?.from}
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
            onClick={() => void openInGmail()}
            disabled={!message}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Gmail
          </Button>
        }
      />

      {loading ? (
        <LoadingBlock>Loading message…</LoadingBlock>
      ) : error ? (
        <ErrorBlock tone="warning">{error}</ErrorBlock>
      ) : message ? (
        <div className="space-y-4">
          <Card
            padding="default"
            className={cn(
              "border-stream-gmail-border/80",
              message.unread && "bg-stream-gmail/30",
            )}
          >
            <CardHeader className="mb-3">
              <CardDescription className="flex flex-wrap items-center gap-2">
                <span className="text-on-surface">{message.from}</span>
                {message.unread ? (
                  <Badge variant="accent">Unread</Badge>
                ) : (
                  <Badge variant="outline">Read</Badge>
                )}
                {message.starred ? (
                  <Badge variant="warning">Starred</Badge>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void toggleRead()}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {message.unread ? "Mark read" : "Mark unread"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void toggleStar()}
                >
                  <Star
                    className={cn(
                      "h-3.5 w-3.5",
                      favoriteStarClass(message.starred),
                    )}
                  />
                  {message.starred ? "Unstar" : "Star"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void archive()}
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </Button>
              </div>

              <dl className="grid gap-2 rounded-lg border border-border bg-surface-container-low/40 px-3 py-2.5 text-body-sm sm:grid-cols-[6rem_minmax(0,1fr)]">
                <dt className="text-label-sm tracking-wide text-on-surface-variant uppercase">
                  To
                </dt>
                <dd className="break-all text-on-surface">
                  {message.to || "—"}
                </dd>
                {message.cc ? (
                  <>
                    <dt className="text-label-sm tracking-wide text-on-surface-variant uppercase">
                      Cc
                    </dt>
                    <dd className="break-all text-on-surface">{message.cc}</dd>
                  </>
                ) : null}
                <dt className="text-label-sm tracking-wide text-on-surface-variant uppercase">
                  Date
                </dt>
                <dd className="text-on-surface">
                  {new Date(message.dateMs).toLocaleString()}
                </dd>
              </dl>

              {message.labelIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {message.labelIds.map((label) => (
                    <Badge
                      key={label}
                      variant="outline"
                      className="font-mono text-[10px]"
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card padding="default">
            <CardHeader className="mb-2">
              <CardTitle className="text-label-sm tracking-wide text-on-surface-variant uppercase">
                Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              {message.bodyText ? (
                <pre className="max-h-[36rem] overflow-auto rounded-lg border border-border bg-surface-container-low p-3 font-sans text-body-md leading-relaxed whitespace-pre-wrap text-on-surface">
                  {message.bodyText}
                </pre>
              ) : message.bodyHtml ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none rounded-lg border border-border bg-surface-container-low p-3 text-on-surface"
                  dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-body-md text-on-surface-variant">
                  No plain-text body.{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => void openInGmail()}
                  >
                    Open in Gmail
                  </button>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="py-10 text-center text-body-md text-on-surface-variant">
          Message not found.
        </p>
      )}
    </PageShell>
  );
}
