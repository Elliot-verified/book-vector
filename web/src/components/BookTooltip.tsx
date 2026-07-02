import type { Book } from "../types";

/** Hover card for a book in the galaxy. Positioned by the caller. */
export function BookTooltip({
  book,
  clusterName,
  x,
  y,
}: {
  book: Book;
  clusterName?: string;
  x: number;
  y: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x + 12,
        top: y + 12,
        pointerEvents: "none",
        background: "rgba(10,12,20,0.92)",
        border: "1px solid #2a2f45",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: 13,
        maxWidth: 280,
        zIndex: 20,
      }}
    >
      <strong>{book.title}</strong>
      {book.author && <div style={{ opacity: 0.7 }}>{book.author}</div>}
      {clusterName && (
        <div style={{ marginTop: 4, color: "#9fb4ff" }}>✦ {clusterName}</div>
      )}
      {book.facets.arc && (
        <div style={{ marginTop: 4, opacity: 0.8, fontStyle: "italic" }}>
          arc: {book.facets.arc}
        </div>
      )}
    </div>
  );
}
