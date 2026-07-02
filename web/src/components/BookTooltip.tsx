import type { Book } from "../types";

/** Hover card for a book in the galaxy. Positioned by the caller. */
export function BookTooltip({ book, x, y }: { book: Book; x: number; y: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x + 12,
        top: y + 12,
        pointerEvents: "none",
        background: "rgba(10,12,20,0.9)",
        border: "1px solid #2a2f45",
        borderRadius: 6,
        padding: "6px 10px",
        fontSize: 13,
        maxWidth: 260,
      }}
    >
      <strong>{book.title}</strong>
      {book.author && <div style={{ opacity: 0.7 }}>{book.author}</div>}
    </div>
  );
}
