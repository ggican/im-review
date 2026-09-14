import { openUrl } from "@tauri-apps/plugin-opener";
import { Archive, ExternalLink, Loader2, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
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
        backTo="/gmail"
        title={message?.subject ?? messageId}
        subtitle={message?.from}
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
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading message…
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : message ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void toggleRead()}
            >
              {message.unread ? "Mark read" : "Mark unread"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void toggleStar()}
            >
              <Star className="h-3.5 w-3.5" />
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

          <dl className="grid gap-2 text-sm sm:grid-cols-[6rem_minmax(0,1fr)]">
            <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              To
            </dt>
            <dd className="break-all">{message.to || "—"}</dd>
            {message.cc ? (
              <>
                <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                  Cc
                </dt>
                <dd className="break-all">{message.cc}</dd>
              </>
            ) : null}
            <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              Date
            </dt>
            <dd>{new Date(message.dateMs).toLocaleString()}</dd>
          </dl>

          {message.labelIds.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {message.labelIds.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-neutral-200 px-2 py-0.5 text-xs dark:border-neutral-800"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          <section>
            {message.bodyText ? (
              <pre className="font-sans text-sm whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                {message.bodyText}
              </pre>
            ) : message.bodyHtml ? (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-neutral-700 dark:text-neutral-300"
                dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
              />
            ) : (
              <p className="text-sm text-neutral-400">
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
          </section>
        </div>
      ) : null}
    </PageShell>
  );
}
