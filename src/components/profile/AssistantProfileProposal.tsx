/**
 * An assistant can ask to change a profile. The sheet stays as it is until
 * the member saves these exact fields.
 */

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Identity } from "../../services/identity";
import type { Person } from "../../types";
import { getApiBase } from "../../services/api-base";
import { Button } from "../ui/button";

interface ProposalChange {
  field: string;
  label: string;
  before: string;
  after: string;
}

interface ProposalPreview {
  saved: false;
  changes: ProposalChange[];
}

interface AppliedProposal {
  saved: true;
  person: Person;
  auth?: { token: string; expiresAt: string; mustChangePassword: boolean };
}

interface AssistantProfileProposalProps {
  identity: Identity | null;
  onProfileSaved?: (
    person: Person,
    auth?: { token: string; expiresAt: string; mustChangePassword: boolean },
  ) => void;
}

function proposalToken() {
  return new URLSearchParams(window.location.search).get("assistant") || "";
}

function clearProposalToken() {
  const url = new URL(window.location.href);
  url.searchParams.delete("assistant");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}

export function AssistantProfileProposal({
  identity,
  onProfileSaved,
}: AssistantProfileProposalProps) {
  const [token, setToken] = useState(proposalToken);
  const [changes, setChanges] = useState<ProposalChange[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const current = proposalToken();
    setToken(current);
    if (!current || !identity?.token) {
      setChanges(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${getApiBase()}/assistant/profile-proposal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${identity.token}`,
      },
      body: JSON.stringify({ token: current, action: "preview" }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | (ProposalPreview & { error?: string })
          | null;
        if (!response.ok) {
          throw new Error(body?.error || "This profile link could not be read.");
        }
        setChanges(Array.isArray(body?.changes) ? body.changes : []);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setChanges(null);
        setError(reason instanceof Error ? reason.message : "This profile link could not be read.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [identity?.token]);

  if (!token) return null;

  function dismiss() {
    clearProposalToken();
    setToken("");
    setChanges(null);
    setError("");
  }

  async function save() {
    if (!identity?.token || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${getApiBase()}/assistant/profile-proposal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${identity.token}`,
        },
        body: JSON.stringify({ token, action: "apply" }),
      });
      const body = (await response.json().catch(() => null)) as
        | (AppliedProposal & { error?: string })
        | null;
      if (!response.ok || !body?.saved || !body.person) {
        throw new Error(body?.error || "The profile could not be saved.");
      }
      onProfileSaved?.(body.person, body.auth);
      dismiss();
      toast.success("Profile saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
        Assistant
      </p>
      <h2 className="mt-1 text-base font-semibold tracking-tight text-neutral-900">
        Your assistant asked to change your profile
      </h2>
      <p className="mt-1 text-sm leading-5 text-neutral-500">
        Nothing is saved yet. These are the exact fields. A sentence in someone else’s bio is not a reason to accept them.
      </p>

      {!identity ? (
        <p className="mt-4 text-sm text-neutral-700">Sign in to review the change.</p>
      ) : null}

      {loading ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="size-4 animate-spin" />
          Reading the request
        </p>
      ) : null}

      {changes && changes.length > 0 ? (
        <dl className="mt-4 space-y-3">
          {changes.map((change) => (
            <div key={change.field} className="rounded-xl bg-neutral-50 px-3 py-3">
              <dt className="text-xs font-medium text-neutral-500">{change.label}</dt>
              <dd className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words text-sm text-neutral-900">
                {change.after}
              </dd>
              <dd className="mt-1 text-xs text-neutral-400">Now: {change.before}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {identity && changes ? (
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full sm:w-auto sm:min-w-44"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Check />}
            {saving ? "Saving" : "Save this change"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={dismiss}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          Keep my profile
        </Button>
      </div>
    </section>
  );
}
