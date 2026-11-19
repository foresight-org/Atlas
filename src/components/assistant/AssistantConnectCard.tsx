/**
 * AssistantConnectCard — where a member finds the connector address.
 *
 * Kept out of the profile header on purpose. It is a setup detail, not a
 * reminder, and the whole feature leaves with this folder: delete the
 * component and the one place ProfilePage renders it.
 */

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "../ui/button";
import { atlasConnectorUrl } from "../../services/agentHandoff";

export function AssistantConnectCard() {
  const url = atlasConnectorUrl();
  const [copied, setCopied] = useState(false);

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
    <section className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow sm:p-5 lg:p-6">
      <h2 className="text-base font-semibold text-gray-900">Add to Claude or ChatGPT</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">
        Add this address as a custom connector in Claude or ChatGPT, then choose sign-in.
        Your assistant sees the same people you see on this atlas, and nothing past that.
        Installing the connector does not open the fellow or grantee network.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 break-all rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-800">
          {url}
        </code>
        <Button type="button" variant="outline" className="min-h-[44px] shrink-0" onClick={() => void copy()}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy address"}
        </Button>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-gray-500">
        In Claude: Settings → Connectors → Add custom connector. In ChatGPT: Settings → Apps
        → Advanced → Developer mode, then create a connector. Paste the address and choose
        sign-in. Updating your password disconnects every assistant.
      </p>
    </section>
  );
}
