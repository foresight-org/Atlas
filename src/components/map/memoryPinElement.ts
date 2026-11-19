/**
 * Shared DOM for a node memory pin — globe (MapLibre) and flat (Leaflet).
 *
 * Foresight-managed nodes carry the nanowheel mark. Affiliates are solid black.
 * Conversations stay a pale open ring and are not selectable.
 */

import type { MemoryPlace } from "../../types/nodeMemory";

const KIND_LABEL: Record<MemoryPlace["kind"], string> = {
  node: "Foresight node",
  affiliate: "Affiliate node",
  conversation: "In conversation, not open yet",
};

export function createMemoryPinElement(
  place: MemoryPlace,
  options: { iconUrl: string },
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "atlas-memory-pin";
  button.dataset.kind = place.kind;
  button.dataset.placeId = place.id;
  const selectable = place.kind !== "conversation";
  button.setAttribute(
    "aria-label",
    selectable ? `${place.name}, ${KIND_LABEL[place.kind]}` : `${place.name}, ${KIND_LABEL.conversation}`,
  );
  if (!selectable) {
    button.tabIndex = -1;
    button.setAttribute("aria-disabled", "true");
  } else {
    button.setAttribute("aria-pressed", "false");
  }

  const mark = document.createElement("span");
  mark.className = "atlas-memory-pin__mark";
  mark.setAttribute("aria-hidden", "true");
  if (place.kind === "node") {
    mark.classList.add("atlas-memory-pin__mark--wheel");
    const img = document.createElement("img");
    img.src = options.iconUrl;
    img.alt = "";
    img.className = "atlas-memory-pin__wheel";
    mark.appendChild(img);
  }

  const label = document.createElement("span");
  label.className = "atlas-memory-pin__label";
  label.textContent = place.name;
  button.append(label, mark);
  return button;
}

export { KIND_LABEL };
