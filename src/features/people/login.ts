const LOGIN_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

/** Trim, strip a leading @, reject invalid GitHub logins. */
export function normalizeGithubLogin(raw: string): string | null {
  const login = raw.trim().replace(/^@+/, "");
  if (!login || login.length > 39 || !LOGIN_RE.test(login)) return null;
  return login;
}

export function sameGithubLogin(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
