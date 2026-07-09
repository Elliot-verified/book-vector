import { useMemo } from "react";
import type { Book } from "../types";

interface Props {
  label: string;
  clusterId: number;
  books: Book[]; // all books in this cluster
  onSelect: (bookId: string) => void;
}

/**
 * The full reading list for one hyperniche genre (cluster), opened by
 * double-clicking a genre in the sidebar. Each book is clickable to dive into
 * its constellation of nearest neighbors.
 */
export function GenreList({ label, clusterId, books, onSelect }: Props) {
  const sorted = useMemo(
    () => [...books].sort((a, b) => a.title.localeCompare(b.title)),
    [books],
  );
  const swatch = `hsl(${((clusterId * 0.61803398875) % 1) * 360}, 70%, 66%)`;

  return (
    <div style={{ padding: 24, paddingTop: 20, overflow: "auto", height: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: swatch, flexShrink: 0 }} />
        <h2 style={{ margin: 0 }}>{label || `cluster ${clusterId}`}</h2>
      </div>
      <div style={{ opacity: 0.6, marginBottom: 16, fontSize: 13 }}>
        {sorted.length} {sorted.length === 1 ? "book" : "books"} in this hyperniche · click one to see its neighbors
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 760 }}>
        {sorted.map((b) => (
          <div
            key={b.id}
            onClick={() => onSelect(b.id)}
            style={{
              cursor: "pointer",
              border: "1px solid #232941",
              borderRadius: 8,
              padding: "10px 14px",
              background: "rgba(20,24,40,0.6)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <strong>{b.title}</strong>
              {b.author && <span style={{ opacity: 0.55, fontSize: 13, whiteSpace: "nowrap" }}>{b.author}</span>}
            </div>
            {b.facets?.protagonist && (
              <div style={{ marginTop: 6, fontSize: 12, fontStyle: "italic", opacity: 0.72 }}>
                {b.facets.protagonist}
              </div>
            )}
            {b.genres?.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {b.genres.slice(0, 4).map((g) => (
                  <span key={g} style={tag}>{g}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const tag: React.CSSProperties = {
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#171d2e",
  border: "1px solid #232941",
  opacity: 0.85,
};
