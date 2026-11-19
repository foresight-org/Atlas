import { getApiBase } from "./api-base";
import type { DirectoryAuthResult } from "./memberAuth";

export async function requestLoginLink(email: string): Promise<{ ok: true; message: string }> {
  const response = await fetch(`${getApiBase()}/member-login-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (payload as { error?: string }).error || "Could not send a sign-in link.",
    );
  }
  return payload as { ok: true; message: string };
}

export async function redeemLoginLink(token: string): Promise<DirectoryAuthResult> {
  const response = await fetch(`${getApiBase()}/member-login-redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (payload as { error?: string }).error || "This sign-in link could not be used.",
    );
  }
  return payload as DirectoryAuthResult;
}
