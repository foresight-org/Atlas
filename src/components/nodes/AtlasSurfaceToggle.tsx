/**
 * People or Nodes, one action each way.
 *
 * Sits on the globe the way the projection switch does: a small white
 * control, not a second navigation. Nodes is a surface of this map.
 */

export type AtlasSurface = "people" | "nodes";

interface AtlasSurfaceToggleProps {
  surface: AtlasSurface;
  onChange: (surface: AtlasSurface) => void;
}

export function AtlasSurfaceToggle({ surface, onChange }: AtlasSurfaceToggleProps) {
  return (
    <div className="atlas-surface-toggle" role="radiogroup" aria-label="Atlas view">
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
