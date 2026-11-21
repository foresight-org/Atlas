/**
 * Small helper for the "come back here after sign-in" flow.
 *
 * When a signed-out member taps a check-in QR code they land on
 * `/checkin/:nodeSlug`. Instead of bouncing them to the home screen after
 * they authenticate, we stash the intended path here and pop it off after
 * the next successful sign-in — so the member's experience is literally:
 *
 *   1. scan QR → /checkin/berlin (signed out)
 *   2. sign in (one tap, name is pre-filled)
 *   3. automatically land back at /checkin/berlin
 *   4. tap the check-in button → ◎ +1
 *
 * We use `sessionStorage` here (not `localStorage`) because this is a
 * navigation primitive — we only want it to survive the login detour, not
 * a browser-wide session.
 */

const RETURN_URL_KEY = "foresightatlas_return_url";
const PROFILE_PROPOSAL_KEY = "foresightatlas_profile_proposal";

/** Persist the URL the member should come back to after signing in. */
export function setPostLoginReturnUrl(pathAndQuery: string): void {
  try {
    if (!pathAndQuery || typeof pathAndQuery !== "string") return;
    sessionStorage.setItem(RETURN_URL_KEY, pathAndQuery);
  } catch {
    // sessionStorage can throw in some privacy modes; the redirect is a nicety, not a requirement.
  }
}

/** Read and clear the pending return URL in one atomic step. */
export function consumePostLoginReturnUrl(): string | null {
  try {
    const raw = sessionStorage.getItem(RETURN_URL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RETURN_URL_KEY);
    return raw;
  } catch {
    return null;
  }
}

/**
 * A profile change from an assistant has to survive the email-link tab.
 * sessionStorage would stay behind in the tab that opened the link.
 */
export function rememberProfileProposal(pathAndQuery: string): void {
  try {
    if (!pathAndQuery.startsWith("/profile?assistant=")) return;
    localStorage.setItem(PROFILE_PROPOSAL_KEY, pathAndQuery);
  } catch {
    // The link in the address bar still works once they are signed in.
  }
}

export function consumeProfileProposal(): string | null {
  try {
    const raw = localStorage.getItem(PROFILE_PROPOSAL_KEY);
    if (!raw) return null;
    localStorage.removeItem(PROFILE_PROPOSAL_KEY);
    return raw.startsWith("/profile?assistant=") ? raw : null;
  } catch {
    return null;
  }
}

export function clearPostLoginReturnUrl(): void {
  try {
    sessionStorage.removeItem(RETURN_URL_KEY);
  } catch {
    // ignore
  }
}
