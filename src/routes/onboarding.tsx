import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import imReviewLogo from "@/assets/im-review-logo.png";
import { PageShell } from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function OnboardingPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Sign in · IM Review";
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const user = await api.validateToken(token.trim());
      await api.saveToken(token.trim());
      toast.success(`Signed in as @${user.login}`);
      navigate("/", { replace: true });
    } catch (err) {
      const message = String(err);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell
      width="md"
      className="from-stream-github/40 via-background to-background max-w-md justify-center gap-6 bg-gradient-to-b"
    >
      <div className="space-y-4 text-center">
        <div className="border-stream-github-border bg-surface-container-lowest mx-auto flex h-14 w-14 items-center justify-center rounded-xl border shadow-sm">
          <img
            src={imReviewLogo}
            alt="IM Review"
            className="h-10 w-10 rounded-md"
          />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-headline text-headline-lg text-on-surface">
            IM Review
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Welcome — connect GitHub to triage PRs, drafts, and reviews.
          </p>
        </div>
      </div>

      <Card
        padding="default"
        className="border-stream-github-border/80 text-left"
      >
        <CardHeader className="mb-3">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="github">GitHub</Badge>
            <Badge variant="outline">Local only</Badge>
          </div>
          <CardTitle className="text-title-md">
            Connect your GitHub account
          </CardTitle>
          <CardDescription>
            Paste a Personal Access Token with{" "}
            <code className="font-mono text-xs">repo</code> and{" "}
            <code className="font-mono text-xs">read:user</code> scopes. Stored
            locally in this app — no OAuth app registration, and the token is
            never shown after you continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <label htmlFor="github-pat" className="block space-y-1.5">
              <span className="text-label-sm text-on-surface-variant">
                GitHub personal access token
              </span>
              <Input
                id="github-pat"
                type="password"
                autoFocus
                placeholder="ghp_…"
                value={token}
                onChange={(e) => {
                  setToken(e.currentTarget.value);
                  if (error) setError(null);
                }}
                disabled={busy}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(error)}
              />
            </label>

            {error ? (
              <div
                role="alert"
                className="border-error/30 bg-error-container text-body-sm text-on-error-container rounded-lg border px-3 py-2"
              >
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              variant="accent"
              disabled={busy || !token.trim()}
              className="w-full"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Validating…" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <a
        href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=IM Review"
        target="_blank"
        rel="noreferrer"
        className="text-body-sm text-on-surface-variant hover:text-on-surface text-center underline underline-offset-2"
      >
        Create a new token on GitHub →
      </a>
    </PageShell>
  );
}
