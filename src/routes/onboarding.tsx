import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import imReviewLogo from "@/assets/im-review-logo.png";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Sign in · IM Review";
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    try {
      const user = await api.validateToken(token.trim());
      await api.saveToken(token.trim());
      toast.success(`Signed in as @${user.login}`);
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell width="md" className="max-w-md justify-center gap-8">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
          <img src={imReviewLogo} alt="" className="h-9 w-9 rounded-md" />
          <h1 className="text-xl font-semibold tracking-tight">IM Review</h1>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-medium tracking-tight">
            Connect your GitHub account
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Paste a Personal Access Token with{" "}
            <code className="font-mono text-xs">repo</code> and{" "}
            <code className="font-mono text-xs">read:user</code> scopes. Stored
            locally in this app (browser storage) — no GitHub OAuth app
            registration required, and no macOS Keychain prompt.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <label htmlFor="github-pat" className="block space-y-1.5">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            GitHub personal access token
          </span>
          <Input
            id="github-pat"
            type="password"
            autoFocus
            placeholder="ghp_…"
            value={token}
            onChange={(e) => setToken(e.currentTarget.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <Button
          type="submit"
          disabled={busy || !token.trim()}
          className="w-full"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Validating…" : "Continue"}
        </Button>
      </form>

      <a
        href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=IM Review"
        target="_blank"
        rel="noreferrer"
        className="text-center text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-300"
      >
        Create a new token on GitHub →
      </a>
    </PageShell>
  );
}
