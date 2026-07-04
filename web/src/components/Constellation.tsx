import { useMemo } from "react";
import type { Book, Facet, Lens } from "../types";
import { neighborsOf, type Store } from "../lib/data";

interface Props {
  store: Store;
  book: Book;
  booksById: Map<string, Book>;
  lens: Lens;
  onSelect: (bookId: string) => void;
}

/**
 * Constellation: a book's nearest neighbors under the active lens, looked up
 * instantly from the precomputed table (no network). Switch the lens (sidebar)
 * and the neighbors re-rank. The "why" shows each neighbor's text for the lens
 * facet, so you can see what they share.
 */
export function Constellation({ store, book, booksById, lens, onSelect }: Props) {
  const items = useMemo(() => neighborsOf(store, book.id, lens, 15), [store, book.id, lens]);
  const whyFacet: Facet = lens === "all" ? "arc" : lens;

  return (
    <div style={{ padding: 24, paddingTop: 20, overflow: "auto", height: "100%", boxSizing: "border-box" }}>
      <h2 style={{ margin: "0 0 4px" }}>{book.title}</h2>
      <div style={{ opacity: 0.7, marginBottom: 8 }}>{book.author}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", fontSize: 13, opacity: 0.85 }}>
        {Object.entries(book.facets)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <li key={k}>
              <span style={{ color: k === whyFacet ? "#bcd0ff" : "#9fb4ff" }}>{k}</span>: {v}
            </li>
          ))}
      </ul>

      <h3 style={{ marginBottom: 8 }}>
        nearest by <span style={{ color: "#9fb4ff" }}>{lens === "all" ? "all facets" : lens}</span>
      </h3>
      {items.length === 0 && <p style={{ opacity: 0.6 }}>no neighbors in this lens</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 720 }}>
        {items.map((n) => {
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
              {b?.facets?.[whyFacet] && (
                <div style={{ marginTop: 6, fontSize: 12, fontStyle: "italic", opacity: 0.78 }}>
                  {whyFacet}: {b.facets[whyFacet]}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
