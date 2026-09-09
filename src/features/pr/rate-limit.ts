/** Shared GitHub rate-limit / secondary-limit detection for UI. */
export function isGithubRateLimitError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("secondary rate limit") ||
    msg.includes("rate limit") ||
    msg.includes("api rate limit") ||
    (msg.includes("403") && msg.includes("github"))
  );
}

export function rateLimitUserMessage(err: unknown): string {
  if (isGithubRateLimitError(err)) {
    return "GitHub rate limit — tunggu beberapa menit, lalu coba lagi. Tidak auto-retry.";
  }
  return String(err);
}
