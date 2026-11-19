/**
 * The text a person pastes into their own agent.
 *
 * It names two connectors and nothing that can mint an account. Sign-in
 * stays in the browser, so a copied prompt is not a credential and cannot
 * be reused to spam the roster.
 */

import { getApiBase } from "./api-base";
import {
  FORESIGHT_FELLOWSHIP_URL,
  FORESIGHT_GRANTS_URL,
  INDEX_MCP_URL,
} from "../constants/foresight";

export function atlasConnectorUrl(): string {
  const base = getApiBase();
  if (base.startsWith("http")) return `${base}/assistant/mcp`;
  if (typeof window === "undefined") return `${base}/assistant/mcp`;
  return `${window.location.origin}${base}/assistant/mcp`;
}

export function agentHandoffPrompt(atlasUrl: string = atlasConnectorUrl()): string {
  const connectors = {
    mcpServers: {
      "foresight-atlas": { url: atlasUrl },
      index: { url: INDEX_MCP_URL },
    },
  };

  return [
    "Help me join the Foresight community.",
    "",
    "Add these connectors. Sign-in opens in the browser. Do not ask me for a password, and do not create an account any other way.",
    "",
    JSON.stringify(connectors, null, 2),
    "",
    "The Atlas account is the wider Foresight community. It does not include fellows, grantees, or nodees.",
    `To apply for those, use ${FORESIGHT_FELLOWSHIP_URL} and ${FORESIGHT_GRANTS_URL}.`,
    "",
    "On Index, join only a Foresight community network, and only after I have a community account. Share intents inside that network. Keep my constraints and this chat private. Ask me before you accept an introduction.",
  ].join("\n");
}
