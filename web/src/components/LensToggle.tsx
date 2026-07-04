import { LENSES, LENS_LABEL, type Lens } from "../types";

/**
 * Picks the active lens. Switching reshapes the galaxy (each lens is a separate
 * precomputed UMAP layout) and re-ranks a book's neighbors. `all` is every
 * facet weighted equally; the others isolate one narrative axis.
 */
export function LensToggle({
  lens,
  onChange,
}: {
  lens: Lens;
  onChange: (l: Lens) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {LENSES.map((l) => {
        const active = l === lens;
        return (
          <button
            key={l}
            onClick={() => onChange(l)}
            style={{
              padding: "5px 10px",
              fontSize: 12,
              cursor: "pointer",
              borderRadius: 999,
              border: `1px solid ${active ? "#3a4d8c" : "#232941"}`,
              background: active ? "#2b3a6b" : "transparent",
              color: active ? "#dde3f5" : "#8b93ac",
            }}
          >
            {LENS_LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}
