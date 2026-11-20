/**
 * AssistantConnectPage — the moment Claude or ChatGPT sends a member home
 * to prove they belong to the community.
 *
 * The connector URL is not an invitation. This page is. Nothing is shared
 * until the person signs in with the Atlas password they already have, reads
 * who is asking, and presses Allow. The server checks the roster again
 * before it mints a code, so a crafted link cannot skip that step.
 */

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Identity } from "../services/identity";
import { getApiBase } from "../services/api-base";
import { getLastSignedInName } from "../services/identity";
import { DirectoryLoginForm } from "../components/auth/DirectoryLoginForm";
import { Button } from "../components/ui/button";
import { buildFullPath } from "../utils/router";
import foresightIcon from "../assets/Foresight_RGB_Icon_Black.png?url";

interface AssistantConnectPageProps {
  identity: Identity | null;
}

interface ConnectRequest {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  scope: string;
  resource: string;
}

function readRequest(): ConnectRequest | null {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get("client_id") || "";
  const redirectUri = params.get("redirect_uri") || "";
  const codeChallenge = params.get("code_challenge") || "";
  const state = params.get("state") || "";
  if (!clientId || !redirectUri || !codeChallenge || !state) return null;
  return {
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod: params.get("code_challenge_method") || "",
    state,
    scope: params.get("scope") || "atlas:read",
    resource: params.get("resource") || "",
  };
}

/** Only the assistants we invited are allowed to receive the browser back. */
function isAssistantReturn(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:" &&
      (parsed.hostname === "claude.ai" ||
        parsed.hostname === "claude.com" ||
        parsed.hostname === "chatgpt.com")
    ) {
      return true;
    }
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      parsed.pathname === "/callback"
    );
  } catch {
    return false;
  }
}

function assistantHost(redirectUri: string): string {
  try {
    return new URL(redirectUri).hostname;
  } catch {
    return "an assistant";
  }
}

export function AssistantConnectPage({ identity }: AssistantConnectPageProps) {
  const request = useMemo(() => readRequest(), []);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);

  async function decide(action: "allow" | "deny") {
    if (!request || !identity) return;
    setPending(action);
    setError(null);
    try {
      const response = await fetch(`${getApiBase()}/assistant/consent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${identity.token}`,
        },
        body: JSON.stringify({
          action,
          client_id: request.clientId,
          redirect_uri: request.redirectUri,
          code_challenge: request.codeChallenge,
          code_challenge_method: request.codeChallengeMethod,
          state: request.state,
          scope: request.scope,
          resource: request.resource,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { redirectTo?: string; error?: string } | null;
      if (!response.ok || !payload?.redirectTo) {
        setError(payload?.error || "The Atlas could not finish connecting.");
        setPending(null);
        return;
      }
      if (!isAssistantReturn(payload.redirectTo)) {
        setError("The Atlas refused to send you back to that address.");
        setPending(null);
        return;
      }
      window.location.assign(payload.redirectTo);
    } catch {
      setError("The Atlas could not finish connecting.");
      setPending(null);
    }
  }

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-start overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-sky-50 px-5 py-6 sm:min-h-[100dvh] sm:justify-center sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-sky-200/30 blur-3xl"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-3xl border border-gray-200 bg-white shadow-sm">
            <img src={foresightIcon} alt="" className="size-8" />
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">
            Connect an assistant
          </h1>
          {identity || !request ? (
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Sign in with the Atlas account you already have. The assistant sees the same
              people you see, and nothing past that. A community account does not open the
              fellow and grantee network.
            </p>
          ) : null}
        </div>

        {!request ? (
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm leading-relaxed text-gray-600">
              This page opens when you connect the Atlas from Claude or ChatGPT. Copy the
              server address from your profile, in the Claude and ChatGPT section.
            </p>
            <a
              href={buildFullPath("/profile")}
              className="mt-5 inline-flex min-h-[44px] items-center text-sm font-medium text-sky-700 underline underline-offset-2"
            >
              Back to your profile
            </a>
          </section>
        ) : !identity ? (
          <DirectoryLoginForm
            title="Sign in to connect"
            description={`${assistantHost(request.redirectUri)} is asking to read the Atlas as you. We'll email a sign-in link. The assistant can only see the layer that account already sees.`}
            submitLabel="Email me my sign-in link"
            initialName={getLastSignedInName()}
          />
        ) : (
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm leading-relaxed text-gray-600">
              <span className="font-medium text-gray-900">{assistantHost(request.redirectUri)}</span>{" "}
              wants to read the atlas as{" "}
              <span className="font-medium text-gray-900">{identity.fullName}</span>. It can see
              the same directory you can. It cannot change anything, and it never receives
              roster emails.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                className="min-h-[48px] flex-1"
                disabled={pending !== null}
                onClick={() => void decide("allow")}
              >
                {pending === "allow" ? <Loader2 className="size-4 animate-spin" /> : null}
                Allow
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[48px] flex-1"
                disabled={pending !== null}
                onClick={() => void decide("deny")}
              >
                {pending === "deny" ? <Loader2 className="size-4 animate-spin" /> : null}
                Don’t allow
              </Button>
            </div>
            {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
          </section>
        )}
      </div>
    </main>
  );
}
