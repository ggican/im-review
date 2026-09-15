import { listen } from "@tauri-apps/api/event";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorBlock, LoadingBlock } from "@/components/ui/feedback";
import { TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { AiReviewTab } from "@/features/ai-review/AiReviewTab";
import {
  buildGithubReviewPayload,
  buildPatchContext,
  type ChangedFile,
  draftToRefineJson,
  fetchChangedFiles,
  parseAiReviewText,
} from "@/features/ai-review/generate";
import { AI_PROVIDERS } from "@/features/ai-review/providers";
import type { AiReviewDraft } from "@/features/ai-review/types";
import {
  closePullRequest,
  convertPullRequestToDraft,
  fetchIssueComments,
  fetchPrCiChecks,
  fetchPrDetail,
  fetchPrReviews,
  markPullRequestReady,
  reopenPullRequest,
  submitReview,
} from "@/features/pr/api";
import { ChangedFilesPanel } from "@/features/pr/ChangedFilesPanel";
import { CiChecksPanel } from "@/features/pr/CiChecksPanel";
import { ConversationPanel } from "@/features/pr/ConversationPanel";
import { CurrentReviewsPanel } from "@/features/pr/CurrentReviewsPanel";
import { PendingReviewBar } from "@/features/pr/PendingReviewBar";
import { PrDetailHeader } from "@/features/pr/PrDetailHeader";
import { PrDetailTab } from "@/features/pr/PrDetailTab";
import {
  isGithubRateLimitError,
  rateLimitUserMessage,
} from "@/features/pr/rate-limit";
import {
  githubReviewStateToEvent,
} from "@/features/pr/review-status";
import type {
  CiChecksSnapshot,
  IssueComment,
  PendingInlineComment,
  PrDetail,
  PrReviewsSnapshot,
  PullRequest,
  ReviewEvent,
} from "@/features/pr/types";
import { latestReviewsByPr, prKey } from "@/features/pr/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  getTemplates,
  saveReviewLocally,
  toggleFavoriteBranch,
} from "@/lib/settings";
import {
  useFavoriteBranches,
  useSavedReviews,
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

const DEFAULT_APPROVE_BODY = "LGTM, thanks!";

function defaultApproveBody(): string {
  const lgtm = getTemplates().find(
    (t) => t.id === "lgtm" || t.name.toLowerCase() === "lgtm",
  );
  return lgtm?.body?.trim() || DEFAULT_APPROVE_BODY;
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
  const [aiError, setAiError] = useState<string | null>(null);
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
  const [issueComments, setIssueComments] = useState<IssueComment[]>([]);
  const [issueCommentsLoading, setIssueCommentsLoading] = useState(false);
  const [issueCommentsError, setIssueCommentsError] = useState<string | null>(
    null,
  );
  const [writesPaused, setWritesPaused] = useState(false);
  const [pendingComments, setPendingComments] = useState<
    PendingInlineComment[]
  >([]);
  const [pendingEvent, setPendingEvent] = useState<ReviewEvent>("COMMENT");
  const [pendingBody, setPendingBody] = useState("");
  const [ownerAction, setOwnerAction] = useState<
    "close" | "reopen" | "draft" | "ready" | null
  >(null);
  const [confirmAction, setConfirmAction] = useState<"close" | "draft" | null>(
    null,
  );
  const templates = useTemplates();
  const savedReviews = useSavedReviews();
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

  const localSavedReview = useMemo(() => {
    if (!owner || !repo || !Number.isFinite(prNumber) || prNumber <= 0) {
      return undefined;
    }
    return latestReviewsByPr(savedReviews).get(
      prKey(`${owner}/${repo}`, prNumber),
    );
  }, [owner, repo, prNumber, savedReviews]);

  const githubMyReview = useMemo(() => {
    if (!viewerLogin || !reviews) return undefined;
    return reviews.latestByUser.find(
      (r) => r.user.toLowerCase() === viewerLogin.toLowerCase(),
    );
  }, [viewerLogin, reviews]);

  /** Prefer local IM Review history; fall back to your latest GitHub review. */
  const yourReviewEvent: ReviewEvent | undefined =
    localSavedReview?.event ??
    (githubMyReview
      ? githubReviewStateToEvent(githubMyReview.state)
      : undefined);

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
      setAiError(null);
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

  useEffect(() => {
    if (detailTab !== "files" || !pr) return;
    let cancelled = false;
    setIssueCommentsLoading(true);
    setIssueCommentsError(null);
    void fetchIssueComments(pr, viewerLogin)
      .then((list) => {
        if (!cancelled) setIssueComments(list);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = rateLimitUserMessage(err);
        setIssueCommentsError(msg);
        if (isGithubRateLimitError(err)) setWritesPaused(true);
      })
      .finally(() => {
        if (!cancelled) setIssueCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailTab, pr, viewerLogin]);

  useEffect(() => {
    setPendingComments([]);
    setPendingBody("");
    setPendingEvent("COMMENT");
    setWritesPaused(false);
  }, [owner, repo, prNumber]);

  const refreshReviews = useCallback(async () => {
    if (!pr) return;
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const snap = await fetchPrReviews(pr, viewerLogin);
      setReviews(snap);
    } catch (err) {
      setReviewsError(String(err));
    } finally {
      setReviewsLoading(false);
    }
  }, [pr, viewerLogin]);

  useEffect(() => {
    if (!pr || !viewerLogin) return;
    void refreshReviews();
  }, [viewerLogin, pr, refreshReviews]);

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
    setAiError(null);
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
      setAiError(null);
      toast.success("AI draft ready — review before submitting");
    } catch (err) {
      setAiError(String(err));
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
        setAiError(null);
        toast.success("Draft refined — still not submitted");
      } catch (err) {
        setAiError(String(err));
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
      toast.error("Pull request is not ready");
      return;
    }
    if (!canManageOwnPr) {
      toast.error("Only the pull request author can close this PR");
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
      toast.error(`Failed to close PR: ${String(err)}`);
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
      toast.error(`Failed to reopen PR: ${String(err)}`);
    } finally {
      setOwnerAction(null);
    }
  }

  async function onConvertOwnPrToDraft() {
    if (!pr || !detail) {
      toast.error("Pull request is not ready");
      return;
    }
    if (!canManageOwnPr) {
      toast.error("Only the pull request author can change draft status");
      return;
    }
    if (detail.isDraft) {
      toast.error("Already a draft");
      return;
    }
    if (!detail.nodeId) {
      toast.error("Missing PR id — refresh the page and try again");
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
      toast.error(`Failed to convert to draft: ${String(err)}`);
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
      toast.error(`Failed to mark ready: ${String(err)}`);
    } finally {
      setOwnerAction(null);
    }
  }

  async function onSubmit() {
    if (!pr || !draft || !confirmed || !detail) return;
    setPosting(true);
    try {
      const payload = buildGithubReviewPayload(draft, files);
      const manual = pendingComments.map((c) => ({
        path: c.path,
        line: c.line,
        side: c.side,
        body: c.body,
      }));
      await submitReview(pr, draft.suggestedEvent, payload.body, {
        commitId: detail.headSha,
        comments: [...payload.comments, ...manual],
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
        comments: [...payload.comments, ...manual].map((c) => ({
          path: c.path,
          line: c.line,
          body: c.body,
        })),
      });
      setPendingComments([]);
      toast.success(
        payload.inlineCount + manual.length > 0
          ? `Submitted ${payload.inlineCount + manual.length} inline comment(s) — saved locally`
          : "Review submitted — saved locally",
      );
      navigate("/");
    } catch (err) {
      if (isGithubRateLimitError(err)) setWritesPaused(true);
      toast.error(rateLimitUserMessage(err));
    } finally {
      setPosting(false);
    }
  }

  async function onSubmitPendingReview() {
    if (!pr || !detail || pendingComments.length === 0) return;
    if (pendingEvent === "APPROVE" && (detail.isDraft || pr.isDraft)) {
      toast.error("Draft PRs cannot be approved on GitHub");
      return;
    }
    setPosting(true);
    try {
      const aiPayload =
        draft != null
          ? buildGithubReviewPayload(draft, files)
          : {
              body: "",
              comments: [] as Array<{
                path: string;
                line: number;
                side: "RIGHT";
                body: string;
              }>,
            };
      const manual = pendingComments.map((c) => ({
        path: c.path,
        line: c.line,
        side: c.side,
        body: c.body,
      }));
      const body =
        pendingBody.trim() ||
        (draft ? aiPayload.body : "") ||
        (pendingEvent === "APPROVE" ? "" : "Review comments");
      const comments = [...aiPayload.comments, ...manual];
      await submitReview(pr, pendingEvent, body, {
        commitId: detail.headSha,
        comments,
      });
      saveReviewLocally({
        repo: pr.repo,
        prNumber: pr.number,
        prTitle: detail.title,
        prUrl: pr.url,
        branch: detail.headBranch,
        event: pendingEvent,
        summary: body || pendingEvent,
        body,
        comments: comments.map((c) => ({
          path: c.path,
          line: c.line,
          body: c.body,
        })),
      });
      setPendingComments([]);
      setPendingBody("");
      toast.success(
        `Submitted ${comments.length} inline comment(s) as ${pendingEvent}`,
      );
      void refreshReviews();
      setDetailTab("reviews");
    } catch (err) {
      if (isGithubRateLimitError(err)) setWritesPaused(true);
      toast.error(rateLimitUserMessage(err));
    } finally {
      setPosting(false);
    }
  }

  return (
    <PageShell width="full" className="max-w-5xl gap-5">
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

      <PrDetailHeader
        owner={owner}
        repo={repo}
        prNumber={prNumber}
        detail={detail}
        pr={pr}
        yourReviewEvent={yourReviewEvent}
        githubMyReview={githubMyReview}
        localSavedReview={localSavedReview}
        branchStarred={branchStarred}
        approving={approving}
        posting={posting}
        onQuickApprove={() => void onQuickApprove()}
        onToggleBranchFavorite={() => void onToggleBranchFavorite()}
      />

      {yourReviewEvent || localSavedReview || githubMyReview ? (
        <div
          data-testid="your-review-banner"
          className="rounded-xl border border-stream-ai-border bg-stream-ai px-4 py-3 text-body-md text-stream-ai-fg"
        >
          <p className="font-semibold">
            Already reviewed
            {yourReviewEvent ? (
              <>
                {" "}
                —{" "}
                {yourReviewEvent === "APPROVE"
                  ? "Approved"
                  : yourReviewEvent === "REQUEST_CHANGES"
                    ? "Changes requested"
                    : "Commented"}
              </>
            ) : null}
          </p>
          <p className="mt-1 text-body-sm opacity-90">
            You already reviewed this PR. It stays marked on the dashboard so
            you don’t treat it as a fresh request. You can still submit another
            review if needed.
          </p>
        </div>
      ) : null}

      {phase === "loading" ? (
        <LoadingBlock>Loading PR + changed files from GitHub…</LoadingBlock>
      ) : null}

      {error && phase === "error" ? <ErrorBlock>{error}</ErrorBlock> : null}

      {phase !== "loading" && phase !== "error" ? (
        <>
          <TabsList aria-label="PR detail sections" className="h-auto w-full flex-wrap justify-start">
            {(
              [
                { id: "detail" as const, label: "Detail" },
                {
                  id: "files" as const,
                  label: files.length ? `Files (${files.length})` : "Files",
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
                  danger:
                    (ci?.failedCount ?? 0) > 0 ||
                    detail?.ciStatus === "failure",
                },
                {
                  id: "reviews" as const,
                  label: reviews
                    ? `Reviews (${reviews.latestByUser.length})`
                    : "Reviews",
                },
                {
                  id: "ai" as const,
                  label: draft ? "AI review · draft" : "AI review",
                },
              ] as const
            ).map((tab) => {
              const selected = detailTab === tab.id;
              const danger = "danger" in tab && tab.danger;
              return (
                <TabsTrigger
                  key={tab.id}
                  id={`pr-detail-tab-${tab.id}`}
                  aria-controls="pr-detail-tab-panel"
                  active={selected}
                  onClick={() => setDetailTab(tab.id)}
                  className={cn(
                    danger && !selected && "text-error",
                    danger && selected && "text-error",
                  )}
                >
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsPanel
            id="pr-detail-tab-panel"
            aria-labelledby={`pr-detail-tab-${detailTab}`}
          >
          {detailTab === "detail" ? (
            <PrDetailTab
              detail={detail}
              pr={pr}
              files={files}
              reviews={reviews}
              ci={ci}
              canManageOwnPr={Boolean(canManageOwnPr)}
              ownerAction={ownerAction}
              approving={approving}
              posting={posting}
              approveBody={approveBody}
              setApproveBody={setApproveBody}
              templates={templates}
              yourReviewEvent={yourReviewEvent}
              onQuickApprove={() => void onQuickApprove()}
              onSetConfirmAction={setConfirmAction}
              onMarkReady={() => void onMarkOwnPrReady()}
              onReopen={() => void onReopenOwnPr()}
              onOpenCiTab={() => setDetailTab("ci")}
            />
          ) : null}

          {detailTab === "files" ? (
            <div className="space-y-4">
              <ChangedFilesPanel
                files={files}
                totals={totals}
                pendingComments={pendingComments}
                onAddPending={(c) => setPendingComments((prev) => [...prev, c])}
              />
              {pr ? (
                <ConversationPanel
                  pr={pr}
                  comments={issueComments}
                  loading={issueCommentsLoading}
                  error={issueCommentsError}
                  templates={templates}
                  writeDisabled={writesPaused}
                  onPosted={(c) => setIssueComments((prev) => [...prev, c])}
                  onUpdated={(c) =>
                    setIssueComments((prev) =>
                      prev.map((row) => (row.id === c.id ? c : row)),
                    )
                  }
                  onDeleted={(id) =>
                    setIssueComments((prev) =>
                      prev.filter((row) => row.id !== id),
                    )
                  }
                />
              ) : null}
              <PendingReviewBar
                pending={pendingComments}
                event={pendingEvent}
                body={pendingBody}
                isDraft={Boolean(detail?.isDraft || pr?.isDraft)}
                submitting={posting}
                onEventChange={setPendingEvent}
                onBodyChange={setPendingBody}
                onRemove={(id) =>
                  setPendingComments((prev) => prev.filter((p) => p.id !== id))
                }
                onSubmit={() => void onSubmitPendingReview()}
              />
            </div>
          ) : null}

          {detailTab === "ci" ? (
            <CiChecksPanel
              snapshot={ci}
              loading={ciLoading}
              error={ciError}
              onRefresh={() => void refreshCi()}
              headBranch={detail?.headBranch ?? pr?.headBranch}
            />
          ) : null}

          {detailTab === "reviews" && pr ? (
            <div className="space-y-4">
              <CurrentReviewsPanel
                pr={pr}
                snapshot={reviews}
                loading={reviewsLoading}
                error={reviewsError}
                writeDisabled={writesPaused}
                onRefresh={() => void refreshReviews()}
                onMutated={() => void refreshReviews()}
              />
              <PendingReviewBar
                pending={pendingComments}
                event={pendingEvent}
                body={pendingBody}
                isDraft={Boolean(detail?.isDraft || pr?.isDraft)}
                submitting={posting}
                onEventChange={setPendingEvent}
                onBodyChange={setPendingBody}
                onRemove={(id) =>
                  setPendingComments((prev) => prev.filter((p) => p.id !== id))
                }
                onSubmit={() => void onSubmitPendingReview()}
              />
            </div>
          ) : null}

          {detailTab === "ai" ? (
            <AiReviewTab
              phase={
                phase === "ai_running" || phase === "draft" ? phase : "ready"
              }
              draft={draft}
              logs={logs}
              hasAiKey={hasAiKey}
              aiProviderLabel={aiProviderLabel}
              filesCount={files.length}
              confirmed={confirmed}
              posting={posting}
              refining={refining}
              refineText={refineText}
              runError={aiError}
              pendingInlineCount={pendingComments.length}
              onConfirmedChange={setConfirmed}
              onRefineTextChange={setRefineText}
              onSummaryChange={(summary) => {
                if (!draft) return;
                setDraft({ ...draft, summary });
              }}
              onToggleFinding={(id) => {
                if (!draft) return;
                setDraft({
                  ...draft,
                  findings: draft.findings.map((x) =>
                    x.id === id ? { ...x, included: !x.included } : x,
                  ),
                });
              }}
              onIgnoreFinding={(id) => {
                if (!draft) return;
                setDraft({
                  ...draft,
                  findings: draft.findings.map((x) =>
                    x.id === id ? { ...x, included: false } : x,
                  ),
                });
              }}
              onEventChange={(event) => {
                if (!draft) return;
                setDraft({ ...draft, suggestedEvent: event });
              }}
              onRun={() => void runAi()}
              onRefine={(instruction) => void refineDraft(instruction)}
              onSubmit={() => void onSubmit()}
              onDiscard={() => {
                setDraft(null);
                setPhase("ready");
                setConfirmed(false);
                setRefineText("");
                setAiError(null);
              }}
            />
          ) : null}
          </TabsPanel>
        </>
      ) : null}
    </PageShell>
  );
}

