/**
 * App-owned Google OAuth Desktop client (public client id + installed-app secret).
 * Set once for the whole product — end users never paste these.
 *
 * Create: Google Cloud Console → APIs & Services → Credentials →
 * OAuth client ID → Desktop app. Enable Calendar API and Gmail API.
 * Redirect URI used by IM Review: http://127.0.0.1:17320
 *
 * Prefer VITE_GOOGLE_OAUTH_CLIENT_ID + VITE_GOOGLE_OAUTH_CLIENT_SECRET in .env.
 * Desktop client_secret is required by Google token endpoint (not truly secret
 * in shipped desktop apps; still keep it out of git).
 */
export const GOOGLE_OAUTH_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined)?.trim() ??
  "";

export const GOOGLE_OAUTH_CLIENT_SECRET =
  (
    import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_SECRET as string | undefined
  )?.trim() ?? "";

/** UNIT-GOOGLE-001 */
export function isValidGoogleOAuthClientId(id: string): boolean {
  return id.trim().includes(".apps.googleusercontent.com");
}

/** UNIT-GOOGLE-003 */
export function hasGoogleOAuthClientSecret(secret: string): boolean {
  return secret.trim().length > 0;
}

/** UNIT-GOOGLE-002 */
export function isGoogleOAuthPairConfigured(
  clientId: string,
  clientSecret: string,
): boolean {
  return (
    isValidGoogleOAuthClientId(clientId) &&
    hasGoogleOAuthClientSecret(clientSecret)
  );
}

export function isGoogleOAuthConfigured(): boolean {
  return isGoogleOAuthPairConfigured(
    GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET,
  );
}
