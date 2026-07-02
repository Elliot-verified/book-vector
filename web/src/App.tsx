import { useEffect, useMemo, useState } from "react";
import { Galaxy } from "./components/Galaxy";
import { Constellation } from "./components/Constellation";
import { FacetLens } from "./components/FacetLens";
import type { Book, FacetWeights, GalaxyData } from "./types";

type Mode = { view: "galaxy" } | { view: "constellation"; bookId: string };

export function App() {
  const [data, setData] = useState<GalaxyData | null>(null);
  const [mode, setMode] = useState<Mode>({ view: "galaxy" });
  const [threeD, setThreeD] = useState(true);
  const [weights, setWeights] = useState<FacetWeights>({ arc: 1 });

  useEffect(() => {
    // Precomputed galaxy (coords + metadata + cluster labels) from the pipeline (D9).
    fetch("/data/galaxy.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const booksById = useMemo(() => {
    const m = new Map<string, Book>();
    data?.books.forEach((b) => m.set(b.id, b));
    return m;
  }, [data]);

  if (!data) {
    return (
      <div style={{ padding: 32, fontFamily: "system-ui" }}>
        <h2>book-vector</h2>
        <p>
          Loading galaxy… (if this never resolves, run the pipeline: it writes{" "}
          <code>web/public/data/galaxy.json</code>)
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#05060d", color: "#dde3f5" }}>
      <div
        style={{
          position: "absolute",
          zIndex: 10,
          padding: 12,
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <strong>book-vector</strong>
        <button onClick={() => setThreeD((v) => !v)}>{threeD ? "3D" : "2D"}</button>
        {mode.view === "constellation" && (
          <button onClick={() => setMode({ view: "galaxy" })}>← galaxy</button>
        )}
        <FacetLens weights={weights} onChange={setWeights} />
      </div>

      {mode.view === "galaxy" ? (
        <Galaxy
          books={data.books}
          clusterNames={data.clusters}
          threeD={threeD}
          onSelect={(bookId) => setMode({ view: "constellation", bookId })}
        />
      ) : (
        <Constellation
          book={booksById.get(mode.bookId)!}
          booksById={booksById}
          weights={weights}
          onSelect={(bookId) => setMode({ view: "constellation", bookId })}
        />
      )}
    </div>
  );
}
