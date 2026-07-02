import { useEffect, useState } from "react";
import { Galaxy } from "./components/Galaxy";
import { Constellation } from "./components/Constellation";
import { FacetLens } from "./components/FacetLens";
import type { Book, FacetWeights } from "./types";

type Mode = { view: "galaxy" } | { view: "constellation"; bookId: string };

export function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [mode, setMode] = useState<Mode>({ view: "galaxy" });
  const [threeD, setThreeD] = useState(true);
  const [weights, setWeights] = useState<FacetWeights>({ arc: 1 });

  useEffect(() => {
    // Precomputed galaxy coords from the pipeline (PLAN.md D9).
    fetch("/data/coords.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((coords: Record<string, Book["coords"]>) =>
        setBooks(
          Object.entries(coords).map(([id, c]) => ({
            id,
            title: id, // TODO: join titles/authors from books metadata
            author: "",
            coords: c,
          })),
        ),
      )
      .catch(() => setBooks([]));
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <div style={{ position: "absolute", zIndex: 10, padding: 12, display: "flex", gap: 8 }}>
        <button onClick={() => setThreeD((v) => !v)}>{threeD ? "3D" : "2D"}</button>
        {mode.view === "constellation" && (
          <button onClick={() => setMode({ view: "galaxy" })}>← galaxy</button>
        )}
        <FacetLens weights={weights} onChange={setWeights} />
      </div>

      {mode.view === "galaxy" ? (
        <Galaxy
          books={books}
          threeD={threeD}
          onSelect={(bookId) => setMode({ view: "constellation", bookId })}
        />
      ) : (
        <Constellation bookId={mode.bookId} weights={weights} threeD={threeD} />
      )}
    </div>
  );
}
