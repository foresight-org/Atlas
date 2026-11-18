/**
 * Open Connections on the From Nodes tab without a full reload.
 */

import { buildFullPath } from "../utils/router";

export function openNodeRecommendations(): void {
  window.history.pushState({}, "", buildFullPath("/connections?from=nodes"));
  window.dispatchEvent(new PopStateEvent("popstate"));
}
