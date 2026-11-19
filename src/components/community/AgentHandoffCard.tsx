/**
 * AgentHandoffCard — one paste for the person's own agent.
 *
 * The prompt carries connector addresses and the privacy boundary. It does
 * not carry a password, an API key, or a way to create accounts in bulk.
 * Index stays opt-in and limited to the community network.
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "../ui/button";
import { INDEX_HOME_URL } from "../../constants/foresight";
import { agentHandoffPrompt } from "../../services/agentHandoff";

export function AgentHandoffCard() {
  const prompt = agentHandoffPrompt();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow sm:p-5">
      <h2 className="text-base font-semibold text-gray-900">Give this to your agent</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        Paste it into Claude, ChatGPT, or another agent. Sign-in opens in the browser,
        so the agent never receives your password. It can see only the Foresight community,
        and on{" "}
        <a
          href={INDEX_HOME_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gray-900 underline underline-offset-2"
        >
          Index
        </a>{" "}
        it joins only that community. An introduction still waits for a yes from both people.
      </p>
      <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-gray-50 px-3 py-3 text-left font-mono text-[11px] leading-relaxed text-gray-800">
        {prompt}
      </pre>
      <Button type="button" variant="outline" className="mt-3 min-h-[44px] w-full sm:w-auto" onClick={() => void copy()}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy for your agent"}
      </Button>
    </section>
  );
}
