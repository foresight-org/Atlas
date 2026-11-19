/**
 * A quiet footer for people who already want an agent hook.
 *
 * Custom connectors on Team/Enterprise Claude need an org owner, so we do
 * not lead with those steps. The MCP address works in Hermes, Claude Code,
 * Cursor, and similar agents after the person signs in.
 */

import { useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { atlasConnectorUrl } from "../../services/agentHandoff";
import { INDEX_NETWORK_URL } from "../../constants/foresight";
import { buildFullPath } from "../../utils/router";

interface AgentAccessNoteProps {
  className?: string;
}

export function AgentAccessNote({ className }: AgentAccessNoteProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = atlasConnectorUrl();

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 text-left text-xs text-gray-500 transition hover:text-gray-700"
        aria-expanded={open}
      >
        Interact with Atlas from your agents
        <ChevronDown className={`size-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div className="mt-2 space-y-2 rounded-xl border border-gray-200/80 bg-white/80 px-3 py-2.5 text-xs leading-relaxed text-gray-600">
          <p>
            Paste this MCP address into Hermes, Claude Code, Cursor, or another agent that
            accepts remote connectors. Sign in when asked — the agent never gets your password.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-gray-50 px-2.5 py-2 text-[11px] text-gray-800">
              {url}
            </code>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-[11px] text-gray-500">
            <a className="underline underline-offset-2" href={INDEX_NETWORK_URL} target="_blank" rel="noopener noreferrer">
              Foresight on Index
            </a>
            {" — introductions stay mutual, and this does not open the fellow network. "}
            On Claude Team or Enterprise, an org owner has to add the connector first.
            Updating your password disconnects assistants.{" "}
            <a className="underline underline-offset-2" href={buildFullPath("/llms.txt")}>llms.txt</a>
            {" · "}
            <a className="underline underline-offset-2" href={buildFullPath("/agents/foresight-atlas/SKILL.md")}>Agent skill</a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
