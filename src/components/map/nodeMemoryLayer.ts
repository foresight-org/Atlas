/**
 * Node markers and arcs on the existing globe.
 *
 * People pins stay in their own source. This layer is added only while the
 * Nodes surface is on, and removed entirely when it is not, so the directory
 * map is unchanged on the way back.
 */

import { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import type { MemoryArc, MemoryPlace } from "../../types/nodeMemory";
import { greatCircleSegments } from "./greatCircle";

interface NodeLayerHandlers {
  onSelect: (id: string) => void;
  onClear: () => void;
}

export interface NodeMemoryLayer {
  setSelected: (id: string | null) => void;
  destroy: () => void;
}

const ARC_SOURCE = "atlas-memory-arcs";
const ARC_CASING = "atlas-memory-arc-casing";
const ARC_CORE = "atlas-memory-arc";
const ARC_OPEN = "atlas-memory-arc-open";

const KIND_LABEL: Record<MemoryPlace["kind"], string> = {
  node: "Foresight node",
  affiliate: "Affiliate node",
  conversation: "In conversation, not open yet",
};

function arcCollection(
  arcs: readonly MemoryArc[],
  places: readonly MemoryPlace[],
  selectedId: string | null,
): GeoJSON.FeatureCollection {
  const byId = new Map(places.map((place) => [place.id, place]));
  const features: GeoJSON.Feature[] = [];
  for (const arc of arcs) {
    const from = byId.get(arc.from);
    const to = byId.get(arc.to);
    if (!from || !to) continue;
    const hot = selectedId != null && (arc.from === selectedId || arc.to === selectedId);
    features.push({
      type: "Feature",
      properties: { open: arc.open ? 1 : 0, hot: hot ? 1 : 0 },
      geometry: {
        type: "MultiLineString",
        coordinates: greatCircleSegments([from.lon, from.lat], [to.lon, to.lat]),
      },
    });
  }
  return { type: "FeatureCollection", features };
}

function markerElement(place: MemoryPlace): HTMLButtonElement {
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
  const label = document.createElement("span");
  label.className = "atlas-memory-pin__label";
  label.textContent = place.name;
  button.append(label, mark);
  return button;
}

export function mountNodeMemoryLayer(
  map: MapLibreMap,
  places: readonly MemoryPlace[],
  arcs: readonly MemoryArc[],
  handlers: NodeLayerHandlers,
): NodeMemoryLayer {
  const markers = new Map<string, Marker>();
  let selectedId: string | null = null;
  let swallowClick = false;
  let frame = 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const paintSelection = (id: string | null) => {
    selectedId = id;
    for (const [placeId, marker] of markers) {
      const element = marker.getElement();
      element.classList.toggle("is-selected", placeId === id);
      if (element.getAttribute("aria-disabled") !== "true") {
        element.setAttribute("aria-pressed", placeId === id ? "true" : "false");
      }
    }
    const source = map.getSource(ARC_SOURCE) as GeoJSONSource | undefined;
    if (source && typeof source.setData === "function") {
      source.setData(arcCollection(arcs, places, id));
    }
  };

  for (const place of places) {
    const element = markerElement(place);
    const selectable = place.kind !== "conversation";
    element.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      event.preventDefault();
      /*
       * A marker click can still reach the map as a second click and would
       * close the panel in the same breath it opened. Swallow that one.
       */
      swallowClick = true;
      window.setTimeout(() => {
        swallowClick = false;
      }, 80);
      if (!selectable) return;
      handlers.onSelect(place.id);
    });
    const marker = new Marker({
      element,
      anchor: "bottom",
      opacityWhenCovered: 0,
      subpixelPositioning: true,
    })
      .setLngLat([place.lon, place.lat])
      .addTo(map);
    markers.set(place.id, marker);
  }

  const onMapClick = () => {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    handlers.onClear();
  };
  map.on("click", onMapClick);

  if (!map.getSource(ARC_SOURCE)) {
    map.addSource(ARC_SOURCE, {
      type: "geojson",
      data: arcCollection(arcs, places, null),
    });
    map.addLayer({
      id: ARC_CASING,
      type: "line",
      source: ARC_SOURCE,
      filter: ["==", ["get", "open"], 0],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#f8fafc",
        "line-width": 4.25,
        "line-opacity": 0.92,
      },
    });
    map.addLayer({
      id: ARC_CORE,
      type: "line",
      source: ARC_SOURCE,
      filter: ["==", ["get", "open"], 0],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ["case", ["==", ["get", "hot"], 1], "#0369a1", "#0f766e"],
        "line-width": ["case", ["==", ["get", "hot"], 1], 2.25, 1.6],
        "line-opacity": 0.95,
      },
    });
    map.addLayer({
      id: ARC_OPEN,
      type: "line",
      source: ARC_SOURCE,
      filter: ["==", ["get", "open"], 1],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#e2e8f0",
        "line-width": 1.35,
        "line-opacity": 0.7,
        "line-dasharray": [1.1, 1.7],
      },
    });
  }

  if (!reduceMotion) {
    let last = 0;
    let phase = 0;
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      if (now - last < 90) return;
      last = now;
      phase = (phase + 1) % 12;
      const lead = 0.35 + (phase % 6) * 0.28;
      try {
        map.setPaintProperty(ARC_CORE, "line-dasharray", [lead, 1.15, Math.max(0.4, 2.2 - lead)]);
      } catch {
        /* The layer is gone. The cleanup cancels this frame. */
      }
    };
    frame = requestAnimationFrame(animate);
  }

  return {
    setSelected: paintSelection,
    destroy() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      map.off("click", onMapClick);
      for (const marker of markers.values()) marker.remove();
      markers.clear();
      for (const id of [ARC_OPEN, ARC_CORE, ARC_CASING]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource(ARC_SOURCE)) map.removeSource(ARC_SOURCE);
    },
  };
}
