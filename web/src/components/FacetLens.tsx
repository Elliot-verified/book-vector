import { FACETS, type Facet, type FacetWeights } from "../types";

interface Props {
  weights: FacetWeights;
  onChange: (w: FacetWeights) => void;
}

/**
 * Facet lens: sliders (0..1) to weight how much each facet counts in queries.
 * This is the control that makes "similar in arc, ignore setting" possible.
 * Laid out as a vertical stack to sit in the (narrow) sidebar.
 */
export function FacetLens({ weights, onChange }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {FACETS.map((f: Facet) => (
        <label
          key={f}
          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
        >
          <span style={{ width: 118, flexShrink: 0, opacity: 0.8 }}>{f}</span>
          <input
            style={{ flex: 1, minWidth: 0 }}
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={weights[f] ?? 0}
            onChange={(e) => onChange({ ...weights, [f]: Number(e.target.value) })}
          />
          <span style={{ width: 22, textAlign: "right", opacity: 0.5 }}>
            {(weights[f] ?? 0).toFixed(1)}
          </span>
        </label>
      ))}
    </div>
  );
}
