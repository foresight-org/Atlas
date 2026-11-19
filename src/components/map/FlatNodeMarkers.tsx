/**
 * Node pins on the Leaflet flat map — same marks as the globe layer.
 */

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { MemoryPlace } from "../../types/nodeMemory";
import { createMemoryPinElement } from "./memoryPinElement";

interface FlatNodeMarkersProps {
  places: readonly MemoryPlace[];
  iconUrl: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}

export function FlatNodeMarkers({
  places,
  iconUrl,
  selectedId,
  onSelect,
  onClear,
}: FlatNodeMarkersProps) {
  const map = useMap();
  const onSelectRef = useRef(onSelect);
  const onClearRef = useRef(onClear);
  onSelectRef.current = onSelect;
  onClearRef.current = onClear;

  useEffect(() => {
    const markers = new Map<string, L.Marker>();
    let swallowClick = false;

    for (const place of places) {
      const element = createMemoryPinElement(place, { iconUrl });
      const selectable = place.kind !== "conversation";
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        event.preventDefault();
        swallowClick = true;
        window.setTimeout(() => {
          swallowClick = false;
        }, 80);
        if (!selectable) return;
        onSelectRef.current(place.id);
      });

      const icon = L.divIcon({
        className: "atlas-memory-leaflet-icon",
        html: "",
        iconSize: [1, 1],
        iconAnchor: [0, 0],
      });
      const marker = L.marker([place.lat, place.lon], {
        icon,
        interactive: true,
        keyboard: selectable,
        zIndexOffset: place.kind === "conversation" ? 0 : 40,
      });
      marker.on("add", () => {
        const host = marker.getElement();
        if (!host) return;
        host.replaceChildren(element);
      });
      marker.addTo(map);
      markers.set(place.id, marker);
    }

    const onMapClick = () => {
      if (swallowClick) {
        swallowClick = false;
        return;
      }
      onClearRef.current();
    };
    map.on("click", onMapClick);

    return () => {
      map.off("click", onMapClick);
      for (const marker of markers.values()) marker.remove();
      markers.clear();
    };
  }, [map, places, iconUrl]);

  useEffect(() => {
    for (const place of places) {
      const host = document.querySelector<HTMLElement>(
        `.atlas-memory-pin[data-place-id="${CSS.escape(place.id)}"]`,
      );
      if (!host) continue;
      host.classList.toggle("is-selected", place.id === selectedId);
      if (host.getAttribute("aria-disabled") !== "true") {
        host.setAttribute("aria-pressed", place.id === selectedId ? "true" : "false");
      }
    }
  }, [places, selectedId]);

  return null;
}
