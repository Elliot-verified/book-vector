import { useState } from "react";
import type { Book, Cluster, Lens, Midpoint } from "../types";
import { midpoint as midpointQuery, type Store } from "../lib/data";
import { BookPicker } from "./BookPicker";
import { LensToggle } from "./LensToggle";

interface Props {
  store: Store;
  clusters: Cluster[];
  books: Book[];
  booksById: Map<string, Book>;
  lens: Lens;
  onLens: (l: Lens) => void;
  activeClusterId?: number;
  onFocusCluster: (c: Cluster) => void;
  onOpenGenre: (c: Cluster) => void;
  onFocusBook: (b: Book) => void;
  onSearchBook: (b: Book) => void;
  onOpenBook: (bookId: string) => void;
  mobile?: boolean;
}

/**
 * Left sidebar. The lens toggle and the book-in-the-middle finder are pinned to
 * the top; only the hyperniche-genre list scrolls beneath them. Clicking a
 * genre flies the galaxy camera to that cluster (in the active lens's layout).
 */
export function Sidebar({
  store,
  clusters,
  books,
  booksById,
  lens,
  onLens,
  activeClusterId,
  onFocusCluster,
  onOpenGenre,
  onFocusBook,
  onSearchBook,
  onOpenBook,
  mobile = false,
}: Props) {
  return (
    <aside style={mobile ? { ...aside, width: "min(340px, 85vw)" } : aside}>
      <div style={pinned}>
        <div style={sectionTitle}>lens — reshapes the galaxy &amp; neighbors</div>
        <LensToggle lens={lens} onChange={onLens} />
        <div style={{ height: 16 }} />
        <FindBook books={books} onSearchBook={onSearchBook} onOpenBook={onOpenBook} />
        <div style={{ height: 16 }} />
        <Midpoint store={store} books={books} booksById={booksById} onFocusBook={onFocusBook} />
      </div>

      <div style={scroller}>
        <div style={sectionTitle}>
          hyperniche genres <span style={{ opacity: 0.5 }}>({clusters.length})</span>
        </div>
        <ul style={list}>
          {clusters.map((c) => (
            <li
              key={c.id}
              onClick={() => onFocusCluster(c)}
              onDoubleClick={() => onOpenGenre(c)}
              title="click to fly there · double-click to list its books"
              style={{
                ...(mobile ? rowTouch : row),
                background: c.id === activeClusterId ? "#182138" : "transparent",
                borderColor: c.id === activeClusterId ? "#2b3a6b" : "#171b28",
              }}
            >
              <span
                style={{
                  ...swatch,
                  background: `hsl(${((c.id * 0.61803398875) % 1) * 360}, 70%, 66%)`,
                }}
              />
              <span style={{ flex: 1 }}>{c.label || `cluster ${c.id}`}</span>
              <span style={{ opacity: 0.45, fontSize: 11 }}>{c.count}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenGenre(c);
                }}
                title="list the books in this genre"
                style={listBtn}
              >
                books ›
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function FindBook({
  books,
  onSearchBook,
  onOpenBook,
}: {
  books: Book[];
  onSearchBook: (b: Book) => void;
  onOpenBook: (bookId: string) => void;
}) {
  const [book, setBook] = useState<Book | null>(null);

  function select(b: Book | null) {
    setBook(b);
    if (b) onSearchBook(b); // light up the book + its neighbors in the galaxy
  }

  return (
    <div>
      <div style={sectionTitle}>find your book</div>
      <BookPicker books={books} label="search a title…" selected={book} onSelect={select} />
      {book && (
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
          <span style={{ color: "#fff" }}>◍</span> {book.title} and its nearest neighbors are
          highlighted in the galaxy.
          <button onClick={() => onOpenBook(book.id)} style={linkBtn}>
            see the full list ›
          </button>
        </div>
      )}
    </div>
  );
}

function Midpoint({
  store,
  books,
  booksById,
  onFocusBook,
}: {
  store: Store;
  books: Book[];
  booksById: Map<string, Book>;
  onFocusBook: (b: Book) => void;
}) {
  const [a, setA] = useState<Book | null>(null);
  const [b, setB] = useState<Book | null>(null);
  const [results, setResults] = useState<Midpoint[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function find() {
    if (!a || !b) return;
    setLoading(true);
    setResults(null);
    try {
      setResults(await midpointQuery(store, a.id, b.id, 6));
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

      {results && results.length === 0 && (
        <p style={{ fontSize: 12, opacity: 0.6 }}>no book between them</p>
      )}
      {results && results.length > 0 && (
        <ul style={{ ...list, marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
          {results.map((r, i) => {
            const book = booksById.get(r.id);
            return (
              <li
                key={r.id}
                onClick={() => book && onFocusBook(book)}
                style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 4 }}
              >
                <strong style={{ fontSize: 13 }}>
                  {i === 0 && <span style={{ color: "#9fb4ff" }}>◆ </span>}
                  {book?.title ?? r.id}
                </strong>
                {book?.author && <div style={{ fontSize: 11, opacity: 0.55 }}>{book.author}</div>}
                <Balance simToA={r.simToA} simToB={r.simToB} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

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
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxSizing: "border-box",
  borderRight: "1px solid #171b28",
  background: "#080a12",
};
const pinned: React.CSSProperties = {
  flexShrink: 0,
  padding: "12px 14px",
  borderBottom: "1px solid #171b28",
};
const scroller: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "12px 14px",
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
// larger, thumb-friendly tap targets for the genre list on touch devices
const rowTouch: React.CSSProperties = { ...row, padding: "12px 10px", minHeight: 44, fontSize: 14 };
const swatch: React.CSSProperties = { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 };
// explicit "list the books" affordance — so opening a genre doesn't rely on
// double-click/double-tap (which is awkward on touch)
const listBtn: React.CSSProperties = {
  flexShrink: 0,
  padding: "3px 8px",
  fontSize: 11,
  color: "#9fb4ff",
  background: "transparent",
  border: "1px solid #232941",
  borderRadius: 6,
  cursor: "pointer",
};
const linkBtn: React.CSSProperties = {
  display: "block",
  marginTop: 6,
  padding: 0,
  background: "none",
  border: "none",
  color: "#9fb4ff",
  cursor: "pointer",
  fontSize: 12,
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
