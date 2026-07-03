import { useEffect, useState } from "react";
import { neighbors } from "../lib/api";
import type { Book, FacetWeights, Neighbor } from "../types";

interface Props {
  book: Book;
  booksById: Map<string, Book>;
  weights: FacetWeights;
  onSelect: (bookId: string) => void;
}

/**
 * Constellation: the K nearest neighbors of a book under the current facet
 * weights (set via the lens in the sidebar), with the *why* (which facets
 * match, and how strongly) surfaced. This is where disentangled similarity
 * shows — slide the facets, the neighbors re-rank.
 */
export function Constellation({ book, booksById, weights, onSelect }: Props) {
  const [items, setItems] = useState<Neighbor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    setError(null);
    neighbors(book.id, weights)
      .then(setItems)
      .catch((e) => setError(String(e)));
  }, [book.id, weights]);

  return (
    <div style={{ padding: 24, paddingTop: 20, overflow: "auto", height: "100%", boxSizing: "border-box" }}>
      <h2 style={{ margin: "0 0 4px" }}>{book.title}</h2>
      <div style={{ opacity: 0.7, marginBottom: 8 }}>{book.author}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", fontSize: 13, opacity: 0.85 }}>
        {Object.entries(book.facets)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <li key={k}>
              <span style={{ color: "#9fb4ff" }}>{k}</span>: {v}
            </li>
          ))}
      </ul>

      <h3 style={{ marginBottom: 8 }}>nearest by current lens</h3>
      {error && <p style={{ color: "#ff8a8a" }}>{error} (is the query fn running?)</p>}
      {!items && !error && <p>loading…</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 720 }}>
        {items?.map((n) => {
          const b = booksById.get(n.id);
          return (
            <div
              key={n.id}
              onClick={() => onSelect(n.id)}
              style={{
                cursor: "pointer",
                border: "1px solid #232941",
                borderRadius: 8,
                padding: "10px 14px",
                background: "rgba(20,24,40,0.6)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <strong>{b?.title ?? n.id}</strong>
                <span style={{ opacity: 0.6 }}>{n.similarity.toFixed(3)}</span>
              </div>
              {b?.author && <div style={{ opacity: 0.6, fontSize: 13 }}>{b.author}</div>}
              <div style={{ marginTop: 6, fontSize: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {Object.entries(n.facetSims)
                  .sort(([, a], [, s]) => (s ?? 0) - (a ?? 0))
                  .map(([f, sim]) => (
                    <span
                      key={f}
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: (sim ?? 0) >= 0.6 ? "#2b3a6b" : "#1a1f33",
                        color: (sim ?? 0) >= 0.6 ? "#bcd0ff" : "#7d86a8",
                      }}
                    >
                      {f} {(sim ?? 0).toFixed(2)}
                    </span>
                  ))}
              </div>
              {b?.facets && n.sharedFacets[0] && b.facets[n.sharedFacets[0]] && (
                <div style={{ marginTop: 6, fontSize: 12, fontStyle: "italic", opacity: 0.75 }}>
                  {n.sharedFacets[0]}: {b.facets[n.sharedFacets[0]]}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
