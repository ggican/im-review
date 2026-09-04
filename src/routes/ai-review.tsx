import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  FilePenLine,
  Loader2,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  buildGithubReviewPayload,
  buildPatchContext,
  type ChangedFile,
  draftToRefineJson,
  fetchChangedFiles,
  parseAiReviewText,
} from "@/features/ai-review/generate";
import { AI_PROVIDERS } from "@/features/ai-review/providers";
import type {
  AiFinding,
  AiReviewDraft,
  AiSeverity,
} from "@/features/ai-review/types";
import {
  closePullRequest,
  convertPullRequestToDraft,
  fetchPrCiChecks,
  fetchPrDetail,
  fetchPrReviews,
  markPullRequestReady,
  reopenPullRequest,
  submitReview,
} from "@/features/pr/api";
import { ChangedFilesPanel } from "@/features/pr/ChangedFilesPanel";
import { CiChecksPanel } from "@/features/pr/CiChecksPanel";
import { CurrentReviewsPanel } from "@/features/pr/CurrentReviewsPanel";
import type {
  CiChecksSnapshot,
  PrDetail,
  PrReviewsSnapshot,
  PullRequest,
  ReviewEvent,
} from "@/features/pr/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  getTemplates,
  saveReviewLocally,
  toggleFavoriteBranch,
} from "@/lib/settings";
import {
  useFavoriteBranches,
  useSettings,
  useTemplates,
} from "@/lib/use-settings";

type ProgressEvent = {
  step: string;
  message: string;
  detail?: string | null;
};

type Phase = "loading" | "ready" | "ai_running" | "draft" | "error";
type DetailTab = "detail" | "files" | "ci" | "reviews" | "ai";

const EVENTS: { id: ReviewEvent; label: string }[] = [
  { id: "COMMENT", label: "Comment" },
  { id: "REQUEST_CHANGES", label: "Request changes" },
  { id: "APPROVE", label: "Approve" },
];

const DEFAULT_APPROVE_BODY = "LGTM, thanks!";

function defaultApproveBody(): string {
  const lgtm = getTemplates().find(
    (t) => t.id === "lgtm" || t.name.toLowerCase() === "lgtm",
  );
  return lgtm?.body?.trim() || DEFAULT_APPROVE_BODY;
}

const REFINE_CHIPS = [
  {
    id: "two",
    label: "Only 2 findings",
    instruction:
      "Keep only the 2 most important findings. Drop the rest. Keep summary short.",
  },
  {
    id: "en",
    label: "English",
    instruction:
      "Rewrite the summary and all findings in clear professional English.",
  },
  {
    id: "simple",
    label: "Simpler language",
    instruction:
      "Rewrite the summary and all findings in simpler, easier-to-read language. Avoid jargon where possible.",
  },
] as const;

function severityClass(s: AiSeverity): string {
  switch (s) {
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
    case "warning":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    default:
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300";
  }
}

export function AiReviewPage() {
  const { owner = "", repo = "", number = "" } = useParams();
  const navigate = useNavigate();
  const prNumber = Number(number);

  const [phase, setPhase] = useState<Phase>("loading");
  const [detail, setDetail] = useState<PrDetail | null>(null);
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [files, setFiles] = useState<ChangedFile[]>([]);
  const [logs, setLogs] = useState<ProgressEvent[]>([]);
  const [draft, setDraft] = useState<AiReviewDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAiKey, setHasAiKey] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [posting, setPosting] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refineText, setRefineText] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("detail");
  const [reviews, setReviews] = useState<PrReviewsSnapshot | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [ci, setCi] = useState<CiChecksSnapshot | null>(null);
  const [ciLoading, setCiLoading] = useState(false);
  const [ciError, setCiError] = useState<string | null>(null);
  const [approveBody, setApproveBody] = useState(defaultApproveBody);
  const [approving, setApproving] = useState(false);
  const [viewerLogin, setViewerLogin] = useState<string | null>(null);
  const [ownerAction, setOwnerAction] = useState<
    "close" | "reopen" | "draft" | "ready" | null
  >(null);
  const [confirmAction, setConfirmAction] = useState<"close" | "draft" | null>(
    null,
  );
  const templates = useTemplates();
  const appSettings = useSettings();
  const aiProvider = appSettings.aiProvider;
  const aiProviderLabel =
    AI_PROVIDERS.find((p) => p.id === aiProvider)?.label ?? aiProvider;

  const isOwnPr = Boolean(
    viewerLogin &&
    detail?.author.login &&
    viewerLogin.toLowerCase() === detail.author.login.toLowerCase(),
  );
  const canManageOwnPr =
    isOwnPr && detail && detail.state !== "merged" && pr?.state !== "merged";

  const totals = useMemo(() => {
    return files.reduce(
      (acc, f) => {
        acc.add += f.additions;
        acc.del += f.deletions;
        return acc;
      },
      { add: 0, del: 0 },
    );
  }, [files]);

  useEffect(() => {
    document.title =
      owner && repo ? `${repo} #${prNumber} · IM Review` : "IM Review";
  }, [owner, repo, prNumber]);

  useEffect(() => {
    void api
      .validateToken()
      .then((user) => setViewerLogin(user.login))
      .catch(() => setViewerLogin(null));
  }, []);

  useEffect(() => {
    void api
      .hasAiKey(aiProvider)
      .then(setHasAiKey)
      .catch(() => setHasAiKey(false));
  }, [aiProvider]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<ProgressEvent>("cursor-review-progress", (event) => {
      setLogs((prev) => [...prev, event.payload]);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  // Fast path: load PR + file list from GitHub only (same idea as pasting a PR link).
  useEffect(() => {
    if (!owner || !repo || !Number.isFinite(prNumber) || prNumber <= 0) return;
    let cancelled = false;

    async function load() {
      setPhase("loading");
      setError(null);
      setDraft(null);
      setLogs([]);
      setConfirmed(false);
      setFiles([]);
      setReviews(null);
      setReviewsError(null);
      setCi(null);
      setCiError(null);
      setDetailTab("detail");
      try {
        const stub: PullRequest = {
          id: 0,
          number: prNumber,
          repo: `${owner}/${repo}`,
          title: "…",
          url: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
          state: "open",
          author: { login: "", avatarUrl: "" },
          isDraft: false,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        setReviewsLoading(true);
        setCiLoading(true);
        const [d, changed, reviewSnap] = await Promise.all([
          fetchPrDetail(stub),
          fetchChangedFiles(stub),
          fetchPrReviews(stub).catch((err) => {
            if (!cancelled) setReviewsError(String(err));
            return null;
          }),
        ]);
        if (cancelled) return;
        const loaded: PullRequest = {
          id: d.id,
          number: d.number,
          repo: d.repo,
          title: d.title,
          url: d.url,
          state: d.state,
          author: d.author,
          isDraft: d.isDraft,
          updatedAt: d.updatedAt,
          createdAt: d.createdAt,
          headBranch: d.headBranch,
        };
        setDetail(d);
        setPr(loaded);
        setFiles(changed);
        if (reviewSnap) setReviews(reviewSnap);
        setHasAiKey(await api.hasAiKey(aiProvider));
        setPhase("ready");
        try {
          const ciSnap = await fetchPrCiChecks(loaded, d.headSha);
          if (!cancelled) setCi(ciSnap);
        } catch (err) {
          if (!cancelled) setCiError(String(err));
        } finally {
          if (!cancelled) setCiLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(String(err));
        setPhase("error");
        setCiLoading(false);
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [owner, repo, prNumber, aiProvider]);

  const refreshReviews = useCallback(async () => {
    if (!pr) return;
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const snap = await fetchPrReviews(pr);
      setReviews(snap);
    } catch (err) {
      setReviewsError(String(err));
    } finally {
      setReviewsLoading(false);
    }
  }, [pr]);

  const refreshCi = useCallback(async () => {
    if (!pr || !detail?.headSha) return;
    setCiLoading(true);
    setCiError(null);
    try {
      const snap = await fetchPrCiChecks(pr, detail.headSha);
      setCi(snap);
    } catch (err) {
      setCiError(String(err));
    } finally {
      setCiLoading(false);
    }
  }, [pr, detail]);

  const runAi = useCallback(async () => {
    if (!pr) return;
    if (!(await api.hasAiKey(aiProvider))) {
      toast.error(`Add a ${aiProviderLabel} API key in Settings first`);
      return;
    }
    const { text, fileCount } = buildPatchContext(files);
    if (!text.trim()) {
      toast.error("No reviewable patch content from GitHub");
      return;
    }
    setPhase("ai_running");
    setDetailTab("ai");
    setDraft(null);
    setConfirmed(false);
    setLogs([
      {
        step: "github",
        message: `Using ${fileCount} file patch(es) via ${aiProviderLabel}`,
      },
    ]);
    try {
      const raw = await api.aiReviewPr({
        provider: aiProvider,
        prTitle: pr.title,
        prNumber: pr.number,
        prUrl: pr.url,
        patchContext: text,
      });
      setDraft(parseAiReviewText(raw, pr));
      setPhase("draft");
      toast.success("AI draft ready — review before submitting");
    } catch (err) {
      setError(String(err));
      setPhase("ready");
      toast.error(String(err));
    }
  }, [pr, files, aiProvider, aiProviderLabel]);

  const refineDraft = useCallback(
    async (instruction: string) => {
      if (!pr || !draft) return;
      const trimmed = instruction.trim();
      if (!trimmed) {
        toast.error("Write a refine instruction first");
        return;
      }
      if (!(await api.hasAiKey(aiProvider))) {
        toast.error(`Add a ${aiProviderLabel} API key in Settings first`);
        return;
      }
      setRefining(true);
      setConfirmed(false);
      setLogs((prev) => [
        ...prev,
        { step: "refine", message: `Instruction: ${trimmed}` },
      ]);
      try {
        const raw = await api.aiRefineReview({
          provider: aiProvider,
          currentDraftJson: draftToRefineJson(draft),
          instruction: trimmed,
        });
        setDraft(parseAiReviewText(raw, pr));
        setRefineText("");
        toast.success("Draft refined — still not submitted");
      } catch (err) {
        toast.error(String(err));
      } finally {
        setRefining(false);
      }
    },
    [pr, draft, aiProvider, aiProviderLabel],
  );

  const favoriteBranches = useFavoriteBranches();
  const branchStarred = Boolean(
    detail?.headBranch &&
    favoriteBranches.some(
      (b) =>
        b.repo === detail.repo &&
        (b.branch === detail.headBranch || b.prNumber === detail.number),
    ),
  );

  async function onToggleBranchFavorite() {
    if (!detail?.headBranch) {
      toast.error("Branch not loaded yet");
      return;
    }
    const next = toggleFavoriteBranch({
      repo: detail.repo,
      branch: detail.headBranch,
      prNumber: detail.number,
      title: detail.title,
      url: detail.url,
    });
    const on = next.some(
      (b) => b.repo === detail.repo && b.branch === detail.headBranch,
    );
    toast.success(
      on
        ? `Favorited branch ${detail.headBranch}`
        : `Removed favorite ${detail.headBranch}`,
    );
  }

  async function onQuickApprove() {
    if (!pr || !detail) return;
    if (detail.isDraft || pr.isDraft) {
      toast.error("Draft PRs cannot be approved on GitHub");
      return;
    }
    const body = approveBody.trim() || DEFAULT_APPROVE_BODY;
    setApproving(true);
    try {
      await submitReview(pr, "APPROVE", body, {
        commitId: detail.headSha,
      });
      saveReviewLocally({
        repo: pr.repo,
        prNumber: pr.number,
        prTitle: detail.title,
        prUrl: pr.url,
        branch: detail.headBranch,
        event: "APPROVE",
        summary: body,
        body,
        comments: [],
      });
      toast.success("Approved on GitHub — saved locally");
      navigate("/");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setApproving(false);
    }
  }

  async function onCloseOwnPr() {
    if (!pr || !detail) {
      toast.error("PR belum siap");
      return;
    }
    if (!canManageOwnPr) {
      toast.error("Hanya author PR yang bisa menutup PR ini");
      return;
    }
    setConfirmAction(null);
    setOwnerAction("close");
    toast.message("Closing PR on GitHub…");
    try {
      await closePullRequest(pr);
      setDetail({ ...detail, state: "closed" });
      setPr({ ...pr, state: "closed" });
      toast.success(`Closed ${pr.repo} #${pr.number}`);
    } catch (err) {
      toast.error(`Gagal close PR: ${String(err)}`);
    } finally {
      setOwnerAction(null);
    }
  }

  async function onReopenOwnPr() {
    if (!pr || !detail || !canManageOwnPr) return;
    setOwnerAction("reopen");
    toast.message("Reopening PR on GitHub…");
    try {
      await reopenPullRequest(pr);
      setDetail({ ...detail, state: "open" });
      setPr({ ...pr, state: "open" });
      toast.success(`Reopened ${pr.repo} #${pr.number}`);
    } catch (err) {
      toast.error(`Gagal reopen PR: ${String(err)}`);
    } finally {
      setOwnerAction(null);
    }
  }

  async function onConvertOwnPrToDraft() {
    if (!pr || !detail) {
      toast.error("PR belum siap");
      return;
    }
    if (!canManageOwnPr) {
      toast.error("Hanya author PR yang bisa mengubah draft");
      return;
    }
    if (detail.isDraft) {
      toast.error("Already a draft");
      return;
    }
    if (!detail.nodeId) {
      toast.error("Missing PR id — refresh halaman lalu coba lagi");
      return;
    }
    setConfirmAction(null);
    setOwnerAction("draft");
    toast.message("Converting PR to draft…");
    try {
      await convertPullRequestToDraft(detail.nodeId);
      setDetail({ ...detail, isDraft: true });
      setPr({ ...pr, isDraft: true });
      toast.success(`Converted ${pr.repo} #${pr.number} to draft`);
    } catch (err) {
      toast.error(`Gagal convert to draft: ${String(err)}`);
    } finally {
      setOwnerAction(null);
    }
  }

  async function onMarkOwnPrReady() {
    if (!pr || !detail || !canManageOwnPr) return;
    setOwnerAction("ready");
    toast.message("Marking PR ready for review…");
    try {
      await markPullRequestReady(pr);
      setDetail({ ...detail, isDraft: false });
      setPr({ ...pr, isDraft: false });
      toast.success(`Marked ${pr.repo} #${pr.number} ready for review`);
    } catch (err) {
      toast.error(`Gagal mark ready: ${String(err)}`);
    } finally {
      setOwnerAction(null);
    }
  }

  async function onSubmit() {
    if (!pr || !draft || !confirmed || !detail) return;
    setPosting(true);
    try {
      const payload = buildGithubReviewPayload(draft, files);
      await submitReview(pr, draft.suggestedEvent, payload.body, {
        commitId: detail.headSha,
        comments: payload.comments,
      });
      saveReviewLocally({
        repo: pr.repo,
        prNumber: pr.number,
        prTitle: detail.title,
        prUrl: pr.url,
        branch: detail.headBranch,
        event: draft.suggestedEvent,
        summary: draft.summary,
        body: payload.body,
        comments: payload.comments.map((c) => ({
          path: c.path,
          line: c.line,
          body: c.body,
        })),
      });
      toast.success(
        payload.inlineCount > 0
          ? `Submitted ${payload.inlineCount} inline comment(s) — saved locally`
          : "Review submitted — saved locally",
      );
      navigate("/");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setPosting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <Dialog
        open={confirmAction != null}
        onOpenChange={(open) => {
          if (!open && ownerAction == null) setConfirmAction(null);
        }}
      >
        <DialogContent side="center" className="max-w-md p-0">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "close"
                ? "Close this pull request?"
                : "Convert to draft?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "close"
                ? `${pr?.repo} #${pr?.number} will be closed on GitHub (not merged). You can reopen later.`
                : `${pr?.repo} #${pr?.number} will stop looking ready for review. You can mark it ready again later.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 px-5 py-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={ownerAction != null}
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              variant={confirmAction === "close" ? "destructive" : "default"}
              disabled={ownerAction != null}
              onClick={() => {
                if (confirmAction === "close") void onCloseOwnPr();
                else if (confirmAction === "draft")
                  void onConvertOwnPrToDraft();
              }}
            >
              {ownerAction != null ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {confirmAction === "close" ? "Close PR" : "Convert to draft"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="font-mono text-xs text-neutral-500">
              {owner}/{repo}#{prNumber}
            </p>
            <h1 className="mt-1 text-xl leading-snug font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {detail?.title ?? pr?.title ?? "Loading PR…"}
            </h1>
            {detail ? (
              <p className="mt-1 text-xs text-neutral-500">
                {detail.author.login}
                {detail.headBranch ? (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-mono text-neutral-400">
                      {detail.headBranch}
                    </span>
                  </>
                ) : null}{" "}
                ·{" "}
                <span className="font-mono text-emerald-600 tabular-nums">
                  +{detail.additions}
                </span>{" "}
                <span className="font-mono text-red-600 tabular-nums">
                  −{detail.deletions}
                </span>{" "}
                · {detail.changedFiles} files
              </p>
            ) : null}
          </div>
        </div>
        {pr ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={
                approving || posting || !detail || detail.isDraft || pr.isDraft
              }
              onClick={() => void onQuickApprove()}
              title="Submit APPROVE review to GitHub"
            >
              {approving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Approve LGTM
            </Button>
            <Button
              type="button"
              size="sm"
              variant={branchStarred ? "default" : "outline"}
              disabled={!detail?.headBranch}
              aria-pressed={branchStarred}
              onClick={() => void onToggleBranchFavorite()}
              className={cn(
                branchStarred &&
                  "border-amber-500 bg-amber-500 text-white hover:bg-amber-600",
              )}
            >
              <Star
                className={cn(
                  "h-3.5 w-3.5",
                  branchStarred && "fill-current text-white",
                )}
              />
              {branchStarred ? "Branch favorited" : "Favorite branch"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void openUrl(pr.url)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open on GitHub
            </Button>
          </div>
        ) : null}
      </header>

      {phase === "loading" ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading PR + changed files from GitHub…
        </div>
      ) : null}

      {error && phase === "error" ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {phase !== "loading" && phase !== "error" ? (
        <>
          <div
            role="tablist"
            className="flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            {(
              [
                { id: "detail" as const, label: "PR detail" },
                {
                  id: "files" as const,
                  label: `Files${files.length ? ` (${files.length})` : ""}`,
                },
                {
                  id: "ci" as const,
                  label: ci
                    ? ci.failedCount > 0
                      ? `CI (${ci.failedCount} failed)`
                      : `CI (${ci.items.length})`
                    : detail?.ciStatus === "failure"
                      ? "CI (failed)"
                      : "CI",
                },
                {
                  id: "reviews" as const,
                  label: `Reviews${
                    reviews ? ` (${reviews.latestByUser.length})` : ""
                  }`,
                },
                {
                  id: "ai" as const,
                  label: draft ? "AI review · draft" : "AI review",
                },
              ] as const
            ).map((tab) => {
              const selected = detailTab === tab.id;
              const ciFailed = tab.id === "ci" && (ci?.failedCount ?? 0) > 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setDetailTab(tab.id)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    selected
                      ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-neutral-50"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
                    ciFailed && !selected && "text-red-600 dark:text-red-400",
                    ciFailed &&
                      selected &&
                      "bg-white text-red-700 dark:bg-neutral-800 dark:text-red-300",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {detailTab === "detail" ? (
            <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              {canManageOwnPr ? (
                <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
                  <div>
                    <h2 className="text-sm font-semibold">Your PR controls</h2>
                    <p className="mt-1 text-xs text-neutral-500">
                      Close the PR, or turn it into a draft so it stops looking
                      ready for review. Only shown on PRs you authored.
                    </p>
                    {detail.state === "closed" ? (
                      <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">
                        Status: closed
                      </p>
                    ) : detail.isDraft ? (
                      <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                        Status: draft
                      </p>
                    ) : (
                      <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        Status: open
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail.state === "open" ? (
                      <>
                        {!detail.isDraft ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              ownerAction != null || approving || posting
                            }
                            onClick={() => setConfirmAction("draft")}
                          >
                            {ownerAction === "draft" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <FilePenLine className="h-3.5 w-3.5" />
                            )}
                            Convert to draft
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              ownerAction != null || approving || posting
                            }
                            onClick={() => void onMarkOwnPrReady()}
                          >
                            {ownerAction === "ready" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Mark ready for review
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={ownerAction != null || approving || posting}
                          onClick={() => setConfirmAction("close")}
                        >
                          {ownerAction === "close" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          Close PR
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={ownerAction != null || approving || posting}
                        onClick={() => void onReopenOwnPr()}
                      >
                        {ownerAction === "reopen" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Circle className="h-3.5 w-3.5" />
                        )}
                        Reopen PR
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                <div>
                  <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                    Quick approve
                  </h2>
                  <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    For small changes — submit an APPROVE review to GitHub
                    without running AI. Edit the message if needed.
                  </p>
                </div>
                {templates.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        disabled={approving || posting}
                        onClick={() => setApproveBody(t.body)}
                        className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                        title={t.body}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Textarea
                  rows={3}
                  value={approveBody}
                  onChange={(e) => setApproveBody(e.currentTarget.value)}
                  disabled={approving || posting}
                  placeholder={DEFAULT_APPROVE_BODY}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    approving ||
                    posting ||
                    !detail ||
                    !pr ||
                    detail.isDraft ||
                    pr.isDraft
                  }
                  onClick={() => void onQuickApprove()}
                >
                  {approving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Approve & submit to GitHub
                </Button>
                {(detail?.isDraft || pr?.isDraft) && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Draft PRs cannot be approved until marked ready for review.
                  </p>
                )}
              </div>

              <div>
                <h2 className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                  Description
                </h2>
                <pre className="mt-2 max-h-[28rem] overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed whitespace-pre-wrap dark:border-neutral-800 dark:bg-neutral-900">
                  {detail?.body || "No description."}
                </pre>
              </div>
              {detail ? (
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                      Author
                    </dt>
                    <dd className="mt-1 flex items-center gap-2">
                      {detail.author.avatarUrl ? (
                        <img
                          src={detail.author.avatarUrl}
                          alt=""
                          className="h-5 w-5 rounded-full"
                        />
                      ) : null}
                      {detail.author.login}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                      Branch
                    </dt>
                    <dd className="mt-1 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                      {detail.headBranch || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                      Diff
                    </dt>
                    <dd className="mt-1 font-mono text-xs">
                      <span className="text-emerald-600">
                        +{detail.additions}
                      </span>{" "}
                      <span className="text-red-600">−{detail.deletions}</span>{" "}
                      · {detail.changedFiles} files
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                      CI
                    </dt>
                    <dd className="mt-1 text-xs text-neutral-700 dark:text-neutral-300">
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
                        onClick={() => setDetailTab("ci")}
                      >
                        {ci?.overall ?? detail.ciStatus} ·{" "}
                        {ci
                          ? `${ci.failedCount} failed · ${ci.pendingCount} pending · ${ci.successCount} passed`
                          : detail.ciDescription}
                      </button>
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                      Reviewers
                    </dt>
                    <dd className="mt-1 text-xs text-neutral-700 dark:text-neutral-300">
                      {detail.reviewers.length
                        ? detail.reviewers.join(", ")
                        : "None listed"}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </section>
          ) : null}

          {detailTab === "files" ? (
            <ChangedFilesPanel files={files} totals={totals} />
          ) : null}

          {detailTab === "ci" ? (
            <CiChecksPanel
              snapshot={ci}
              loading={ciLoading}
              error={ciError}
              onRefresh={() => void refreshCi()}
            />
          ) : null}

          {detailTab === "reviews" ? (
            <CurrentReviewsPanel
              snapshot={reviews}
              loading={reviewsLoading}
              error={reviewsError}
              onRefresh={() => void refreshReviews()}
            />
          ) : null}

          {detailTab === "ai" ? (
            <section className="space-y-4 rounded-lg border border-violet-200 bg-violet-50/30 p-5 dark:border-violet-900 dark:bg-violet-950/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-violet-600" />
                    Cursor AI review
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Like pasting a diff into chat: GitHub loads patches,{" "}
                    {aiProviderLabel} drafts findings, you check, then
                    optionally submit to GitHub.
                  </p>
                </div>
                {phase === "ready" ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!hasAiKey || files.length === 0}
                    onClick={() => void runAi()}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Run AI review
                  </Button>
                ) : null}
              </div>

              {!hasAiKey ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {aiProviderLabel} API key missing.{" "}
                  <Link to="/settings" className="underline">
                    Add it in Settings
                  </Link>
                  .
                </p>
              ) : null}

              <ol className="space-y-2 text-sm">
                <Step
                  done={phase !== "ready" || !!draft}
                  active={phase === "ai_running"}
                  label="AI reads GitHub patches"
                />
                <Step
                  done={phase === "draft"}
                  active={phase === "draft"}
                  label="You check findings (not posted yet)"
                />
                <Step
                  done={false}
                  active={false}
                  label="Submit to GitHub only after you confirm"
                />
              </ol>

              {phase === "ai_running" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-violet-800 dark:text-violet-200">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cursor AI is reviewing patches…
                  </div>
                  {logs.length > 0 ? (
                    <div className="max-h-36 overflow-y-auto rounded-md bg-white/70 p-3 font-mono text-xs text-neutral-600 dark:bg-neutral-950/60 dark:text-neutral-400">
                      {logs.map((l, i) => (
                        <div key={`${l.step}-${i}`}>
                          <span className="text-neutral-400">[{l.step}]</span>{" "}
                          {l.message}
                          {l.detail ? (
                            <span className="text-neutral-400">
                              {" "}
                              — {l.detail}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {phase === "draft" && draft ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="review-draft-summary"
                      className="text-xs font-medium tracking-wide text-neutral-400 uppercase"
                    >
                      Summary
                    </label>
                    <Textarea
                      id="review-draft-summary"
                      rows={3}
                      value={draft.summary}
                      onChange={(e) =>
                        setDraft({ ...draft, summary: e.currentTarget.value })
                      }
                      disabled={posting || refining}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                      Findings (
                      {draft.findings.filter((f) => f.included).length}/
                      {draft.findings.length} selected)
                    </div>
                    <ul className="space-y-2">
                      {draft.findings.map((f) => (
                        <FindingRow
                          key={f.id}
                          finding={f}
                          disabled={posting || refining}
                          onToggle={(id) =>
                            setDraft({
                              ...draft,
                              findings: draft.findings.map((x) =>
                                x.id === id
                                  ? { ...x, included: !x.included }
                                  : x,
                              ),
                            })
                          }
                        />
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2 rounded-md border border-dashed border-violet-300 bg-white/60 p-3 dark:border-violet-800 dark:bg-neutral-950/40">
                    <div className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                      Refine draft (prompt)
                    </div>
                    <p className="text-xs text-neutral-500">
                      Ask Cursor to rewrite this draft — e.g. only 2 findings,
                      English, simpler wording. Still not posted until you
                      submit.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {REFINE_CHIPS.map((chip) => (
                        <Button
                          key={chip.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={posting || refining}
                          onClick={() => void refineDraft(chip.instruction)}
                        >
                          {chip.label}
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        placeholder="Custom: e.g. make it friendlier, focus on tests…"
                        value={refineText}
                        onChange={(e) => setRefineText(e.currentTarget.value)}
                        disabled={posting || refining}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void refineDraft(refineText);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={posting || refining || !refineText.trim()}
                        onClick={() => void refineDraft(refineText)}
                      >
                        {refining ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Apply
                      </Button>
                    </div>
                    {refining ? (
                      <p className="flex items-center gap-2 text-xs text-violet-700 dark:text-violet-300">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Refining draft…
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {EVENTS.map((ev) => (
                      <Button
                        key={ev.id}
                        type="button"
                        size="sm"
                        variant={
                          draft.suggestedEvent === ev.id ? "default" : "outline"
                        }
                        disabled={posting || refining}
                        onClick={() =>
                          setDraft({ ...draft, suggestedEvent: ev.id })
                        }
                      >
                        {ev.label}
                      </Button>
                    ))}
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={confirmed}
                      disabled={posting || refining}
                      onChange={(e) => setConfirmed(e.currentTarget.checked)}
                    />
                    <span>
                      I reviewed these findings. Submit will post{" "}
                      <strong>inline comments</strong> on matching file/line in
                      the PR diff (plus a short summary).
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={!confirmed || posting || refining}
                      onClick={() => void onSubmit()}
                    >
                      {posting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      Submit review to GitHub
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={posting || refining}
                      onClick={() => void runAi()}
                    >
                      Re-run AI
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={posting || refining}
                      onClick={() => {
                        setDraft(null);
                        setPhase("ready");
                        setConfirmed(false);
                        setRefineText("");
                      }}
                    >
                      Discard draft
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function Step({
  done,
  active,
  label,
}: {
  done: boolean;
  active: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2">
      {active ? (
        <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
      ) : done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <Circle className="h-4 w-4 text-neutral-300" />
      )}
      <span
        className={cn(
          active && "font-medium text-violet-800 dark:text-violet-200",
        )}
      >
        {label}
      </span>
    </li>
  );
}

function FindingRow({
  finding,
  onToggle,
  disabled,
}: {
  finding: AiFinding;
  onToggle: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <li className="flex gap-2 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
      <input
        type="checkbox"
        className="mt-1"
        checked={finding.included}
        disabled={disabled}
        onChange={() => onToggle(finding.id)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium uppercase",
              severityClass(finding.severity),
            )}
          >
            {finding.severity}
          </span>
          <span className="text-xs font-medium">{finding.title}</span>
        </div>
        {finding.path ? (
          <div className="mt-0.5 font-mono text-xs text-neutral-400">
            {finding.path}
            {finding.line != null ? `:${finding.line}` : ""}
          </div>
        ) : null}
        <p className="mt-1 text-xs whitespace-pre-wrap text-neutral-600 dark:text-neutral-300">
          {finding.body}
        </p>
      </div>
    </li>
  );
}
