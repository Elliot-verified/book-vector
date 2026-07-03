import { useState } from "react";
import type { Book, Cluster, Midpoint } from "../types";
import { midpoint as midpointQuery } from "../lib/api";
import { BookPicker } from "./BookPicker";

interface Props {
  clusters: Cluster[];
  books: Book[];
  booksById: Map<string, Book>;
  activeClusterId?: number;
  onFocusCluster: (c: Cluster) => void;
  onFocusBook: (b: Book) => void;
}

/**
 * Left sidebar: the "hyperniche genres" (emergent cluster themes) as a
 * scrollable, clickable list that flies the galaxy camera to each cluster, plus
 * a midpoint finder that locates the book sitting between two chosen books.
 */
export function Sidebar({
  clusters,
  books,
  booksById,
  activeClusterId,
  onFocusCluster,
  onFocusBook,
}: Props) {
  return (
    <aside style={aside}>
      <Midpoint books={books} booksById={booksById} onFocusBook={onFocusBook} />

      <div style={{ ...sectionTitle, marginTop: 18 }}>
        hyperniche genres <span style={{ opacity: 0.5 }}>({clusters.length})</span>
      </div>
      <ul style={list}>
        {clusters.map((c) => (
          <li
            key={c.id}
            onClick={() => onFocusCluster(c)}
            style={{
              ...row,
              background: c.id === activeClusterId ? "#182138" : "transparent",
              borderColor: c.id === activeClusterId ? "#2b3a6b" : "#171b28",
            }}
          >
            <span
              style={{
                ...swatch,
                background: `hsl(${((c.id * 0.61803398875) % 1) * 360}, 65%, 62%)`,
              }}
            />
            <span style={{ flex: 1 }}>{c.label || `cluster ${c.id}`}</span>
            <span style={{ opacity: 0.45, fontSize: 11 }}>{c.count}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Midpoint({
  books,
  booksById,
  onFocusBook,
}: {
  books: Book[];
  booksById: Map<string, Book>;
  onFocusBook: (b: Book) => void;
}) {
  const [a, setA] = useState<Book | null>(null);
  const [b, setB] = useState<Book | null>(null);
  const [results, setResults] = useState<Midpoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function find() {
    if (!a || !b) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      setResults(await midpointQuery(a.id, b.id, 6));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={sectionTitle}>book in the middle</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <BookPicker books={books} label="book A" selected={a} onSelect={setA} />
        <BookPicker books={books} label="book B" selected={b} onSelect={setB} />
        <button onClick={find} disabled={!a || !b || loading} style={findBtn}>
          {loading ? "finding…" : "find the middle"}
        </button>
      </div>

      {error && <p style={{ color: "#ff8a8a", fontSize: 12 }}>{error}</p>}
      {results && results.length === 0 && (
        <p style={{ fontSize: 12, opacity: 0.6 }}>no book between them</p>
      )}
      {results && results.length > 0 && (
        <ul style={{ ...list, marginTop: 8 }}>
          {results.map((r, i) => {
            const book = booksById.get(r.id);
            return (
              <li
                key={r.id}
                onClick={() => book && onFocusBook(book)}
                style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 4 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>
                    {i === 0 && <span style={{ color: "#9fb4ff" }}>◆ </span>}
                    {book?.title ?? r.id}
                  </strong>
                </div>
                {book?.author && (
                  <div style={{ fontSize: 11, opacity: 0.55 }}>{book.author}</div>
                )}
                <Balance simToA={r.simToA} simToB={r.simToB} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** A little A◄──►B bar showing how the book leans between the two anchors. */
function Balance({ simToA, simToB }: { simToA: number; simToB: number }) {
  const total = simToA + simToB || 1;
  const aPct = (simToA / total) * 100;
  return (
    <div>
      <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${aPct}%`, background: "#5a7cff" }} />
        <div style={{ width: `${100 - aPct}%`, background: "#c56bff" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.5 }}>
        <span>A {simToA.toFixed(2)}</span>
        <span>{simToB.toFixed(2)} B</span>
      </div>
    </div>
  );
}

const aside: React.CSSProperties = {
  width: 300,
  flexShrink: 0,
  height: "100%",
  overflowY: "auto",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRight: "1px solid #171b28",
  background: "#080a12",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  opacity: 0.7,
  marginBottom: 8,
};

const list: React.CSSProperties = { listStyle: "none", padding: 0, margin: 0 };

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 8px",
  fontSize: 13,
  cursor: "pointer",
  borderRadius: 6,
  border: "1px solid #171b28",
  marginBottom: 4,
  lineHeight: 1.3,
};

const swatch: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: "50%",
  flexShrink: 0,
};

const findBtn: React.CSSProperties = {
  padding: "7px 9px",
  background: "#2b3a6b",
  color: "#dde3f5",
  border: "1px solid #3a4d8c",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
};
