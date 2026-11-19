/**
 * Atlas MCP address for agents that accept remote connectors.
 *
 * Sign-in stays in the browser. The address alone is not a credential.
 */

import { getApiBase } from "./api-base";

export function atlasConnectorUrl(): string {
  const base = getApiBase();
  if (base.startsWith("http")) return `${base}/assistant/mcp`;
  if (typeof window === "undefined") return `${base}/assistant/mcp`;
  return `${window.location.origin}${base}/assistant/mcp`;
}
