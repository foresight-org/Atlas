/**
 * Which atlas a Foresight Team member is looking at.
 *
 * The choice is only a request. The server still decides, and a community
 * account cannot ask for the inner atlas. Nodes stay on the inner side.
 */

const STORAGE_KEY = "foresightatlas_team_layer";

export type AtlasLayerChoice = "inner" | "community";

export function getTeamLayerChoice(): AtlasLayerChoice {
  try {
    return localStorage.getItem(STORAGE_KEY) === "community" ? "community" : "inner";
  } catch {
    return "inner";
  }
}

export function setTeamLayerChoice(choice: AtlasLayerChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    /* Private mode can refuse storage. The request still goes out this once. */
  }
}
