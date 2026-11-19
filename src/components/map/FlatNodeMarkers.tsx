/**
 * Node pins on the Leaflet flat map — same marks as the globe layer.
 *
 * Selection must beat Leaflet’s map click. DomEvent.stop on the marker
 * keeps the pulse from clearing before the sidebar can open.
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
  const selectedIdRef = useRef(selectedId);
  onSelectRef.current = onSelect;
  onClearRef.current = onClear;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const markers = new Map<string, L.Marker>();
    let ignoreMapClick = false;

    for (const place of places) {
      const element = createMemoryPinElement(place, { iconUrl });
      const selectable = place.kind !== "conversation";

      const icon = L.divIcon({
        className: "atlas-memory-leaflet-icon",
        html: "",
        iconSize: [40, 48],
        iconAnchor: [20, 48],
      });
      const marker = L.marker([place.lat, place.lon], {
        icon,
        interactive: true,
        keyboard: selectable,
        zIndexOffset: place.kind === "conversation" ? 0 : 200,
      });

      marker.on("add", () => {
        const host = marker.getElement();
        if (!host) return;
        host.replaceChildren(element);
      });

      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        L.DomEvent.preventDefault(event);
        ignoreMapClick = true;
        window.setTimeout(() => {
          ignoreMapClick = false;
        }, 0);
        if (!selectable) return;
        onSelectRef.current(place.id);
      });

      marker.addTo(map);
      markers.set(place.id, marker);
    }

    const onMapClick = () => {
      if (ignoreMapClick) {
        ignoreMapClick = false;
        return;
      }
      if (!selectedIdRef.current) return;
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
