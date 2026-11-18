/**
 * The graph a Node has published. Sample data stays in the panel until
 * this returns something.
 */

import type { NodeGraph } from "../types/nodeMemory";
import { getApiBase } from "./api-base";
import { getIdentity } from "./identity";

export async function fetchNodeMemory(placeId: string): Promise<NodeGraph | null> {
  const token = getIdentity()?.token;
  if (!token) return null;
  try {
    const res = await fetch(`${getApiBase()}/memory?place=${encodeURIComponent(placeId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { graph?: NodeGraph | null };
    if (!body.graph?.topics?.length) return null;
    return body.graph;
  } catch {
    return null;
  }
}
