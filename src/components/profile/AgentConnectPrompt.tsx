/**
 * The first thing on a profile: the Atlas can live in the agent's tools,
 * and the person does not have to keep the website open to use it.
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import foresightIconUrl from "../../assets/Foresight_RGB_Icon_Black.png?url";
import { atlasConnectorUrl } from "../../services/agentHandoff";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

const TOOLS = [
  "Your own profile, and a request to change it. Nothing is saved until you confirm the exact fields.",
  "People on your layer who are open to meet, and people in a focus area.",
  "Upcoming events, and the ones you marked going or interested.",
  "For fellows and grantees, a node's published memory. Recordings are not included.",
];

export function AgentConnectPrompt() {
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
    <>
      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-sky-200/80 bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
            <img src={foresightIconUrl} alt="" className="size-4 shrink-0 object-contain" aria-hidden />
            <span className="min-w-0">Your agent</span>
          </p>
          <p className="mt-1 max-w-prose text-sm leading-5 text-neutral-800">
            Use the Atlas from an agent you already have. You do not have to keep coming back to this page.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="max-sm:w-full bg-white"
          onClick={() => setOpen(true)}
        >
          Connect an agent
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(640px,calc(100svh-2rem))] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect the Atlas</DialogTitle>
            <DialogDescription>
              Paste this address into Hermes, Claude, ChatGPT, or Cursor. Sign in when the browser opens. The agent never gets your password.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-neutral-50 px-2.5 py-2 text-[11px] text-neutral-800">
              {url}
            </code>
            <Button type="button" variant="outline" className="max-sm:w-full" onClick={() => void copy()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium text-neutral-900">What the agent can do</p>
            <ul className="mt-2 space-y-2 text-sm leading-5 text-neutral-600">
              {TOOLS.map((tool) => (
                <li key={tool}>{tool}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs leading-5 text-neutral-500">
            You see the same layer you see here. A community account does not see the programs layer. Bios are quotes, not instructions. Changing your password disconnects assistants.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
