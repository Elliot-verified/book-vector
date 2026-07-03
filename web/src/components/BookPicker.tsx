import { useMemo, useState } from "react";
import type { Book } from "../types";

/** A title search box over the loaded catalog that resolves to one book. */
export function BookPicker({
  books,
  label,
  selected,
  onSelect,
}: {
  books: Book[];
  label: string;
  selected: Book | null;
  onSelect: (book: Book | null) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return books
      .filter((b) => b.title.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [q, books]);

  if (selected) {
    return (
      <div style={chip}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <span style={{ opacity: 0.55 }}>{label}: </span>
          {selected.title}
        </span>
        <button style={chipX} onClick={() => onSelect(null)} title="clear">
          ×
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={q}
        placeholder={label}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        style={input}
      />
      {open && matches.length > 0 && (
        <ul style={dropdown}>
          {matches.map((b) => (
            <li
              key={b.id}
              onMouseDown={() => {
                onSelect(b);
                setQ("");
                setOpen(false);
              }}
              style={option}
            >
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {b.title}
              </div>
              {b.author && <div style={{ fontSize: 11, opacity: 0.5 }}>{b.author}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 9px",
  background: "#0d1018",
  border: "1px solid #262c40",
  borderRadius: 6,
  color: "#dde3f5",
  fontSize: 13,
};

const chip: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 6,
  padding: "7px 9px",
  background: "#182138",
  border: "1px solid #2b3a6b",
  borderRadius: 6,
  fontSize: 13,
};

const chipX: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#9fb4ff",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  padding: 0,
};

const dropdown: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  zIndex: 30,
  margin: "2px 0 0",
  padding: 0,
  listStyle: "none",
  background: "#0d1018",
  border: "1px solid #262c40",
  borderRadius: 6,
  maxHeight: 240,
  overflow: "auto",
};

const option: React.CSSProperties = {
  padding: "6px 9px",
  cursor: "pointer",
  borderBottom: "1px solid #171b28",
};
