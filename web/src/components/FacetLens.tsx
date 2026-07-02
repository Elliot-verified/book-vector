import { FACETS, type Facet, type FacetWeights } from "../types";

interface Props {
  weights: FacetWeights;
  onChange: (w: FacetWeights) => void;
}

/**
 * Facet lens: sliders (0..1) to weight how much each facet counts in queries.
 * This is the control that makes "similar in arc, ignore setting" possible.
 */
export function FacetLens({ weights, onChange }: Props) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      {FACETS.map((f: Facet) => (
        <label key={f} style={{ fontSize: 12 }}>
          {f}{" "}
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={weights[f] ?? 0}
            onChange={(e) => onChange({ ...weights, [f]: Number(e.target.value) })}
          />
        </label>
      ))}
    </div>
  );
}
