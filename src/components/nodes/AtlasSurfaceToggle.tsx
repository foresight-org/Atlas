/**
 * People or Nodes, one action each way.
 *
 * Must sit above Leaflet panes (markers ~600). Without an explicit stack
 * value the flat map paints pins over this control.
 */

import { Z_INDEX_MAP_CONTROLS } from "../../constants/zIndex";

export type AtlasSurface = "people" | "nodes";

interface AtlasSurfaceToggleProps {
  surface: AtlasSurface;
  onChange: (surface: AtlasSurface) => void;
}

export function AtlasSurfaceToggle({ surface, onChange }: AtlasSurfaceToggleProps) {
  return (
    <div
      className="atlas-surface-toggle"
      role="radiogroup"
      aria-label="Atlas view"
      style={{ zIndex: Z_INDEX_MAP_CONTROLS }}
    >
      <button
        type="button"
        role="radio"
        aria-checked={surface === "people"}
        className={surface === "people" ? "is-active" : undefined}
        onClick={() => onChange("people")}
      >
        People
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={surface === "nodes"}
        className={surface === "nodes" ? "is-active" : undefined}
        onClick={() => onChange("nodes")}
      >
        Nodes
      </button>
    </div>
  );
}
