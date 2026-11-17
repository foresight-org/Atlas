/**
 * Sample introductions a Node can prove without handing over the conversation.
 *
 * The names are fictional. A signed-in member sees the person. The transcript
 * stays on the Node that heard it. Nothing here is a real proof or a real member.
 */

import { buildFullPath } from "../utils/router";

export interface NodeRecommendation {
  id: string;
  name: string;
  role: string;
  /** Where the conversation happened. */
  nodeId: string;
  /** The Node whose memory surfaces this person. */
  surfacedAt: string;
  problem: string;
  line: string;
}

export const NODE_RECOMMENDATIONS: NodeRecommendation[] = [
  {
    id: "leah-okonkwo",
    name: "Leah Okonkwo",
    role: "Cryptographer",
    nodeId: "sf",
    surfacedAt: "berlin",
    problem: "Confidential inference",
    line: "From a conversation you were in on confidential inference. She is on it in San Francisco.",
  },
  {
    id: "jonas-keller",
    name: "Jonas Keller",
    role: "Biologist",
    nodeId: "berlin",
    surfacedAt: "sf",
    problem: "Neurotech readouts",
    line: "From a conversation you were in on neurotech readouts. He is on it in Berlin.",
  },
  {
    id: "amira-hassan",
    name: "Amira Hassan",
    role: "Systems engineer",
    nodeId: "berlin",
    surfacedAt: "cape-town",
    problem: "Water and compute",
    line: "From a conversation you were in on water and compute. She is on it in Berlin.",
  },
];

export function recommendationForNode(placeId: string): NodeRecommendation | undefined {
  return NODE_RECOMMENDATIONS.find((entry) => entry.surfacedAt === placeId);
}

/** Open Connections on the From nodes tab without a full reload. */
export function openNodeRecommendations(): void {
  window.history.pushState({}, "", buildFullPath("/connections?from=nodes"));
  window.dispatchEvent(new PopStateEvent("popstate"));
}
