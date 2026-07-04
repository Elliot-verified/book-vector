import { useEffect, useMemo, useState } from "react";
import { Galaxy } from "./components/Galaxy";
import { Constellation } from "./components/Constellation";
import { Sidebar } from "./components/Sidebar";
import { loadStore, type Store } from "./lib/data";
import type { Book, Cluster, Focus, Lens } from "./types";

type Mode = { view: "galaxy" } | { view: "constellation"; bookId: string };

export function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [mode, setMode] = useState<Mode>({ view: "galaxy" });
  const [threeD, setThreeD] = useState(true);
  const [lens, setLens] = useState<Lens>("all");
  const [focus, setFocus] = useState<Focus | null>(null);

  useEffect(() => {
    loadStore().then(setStore).catch(() => setStore(null));
  }, []);

  const books = store?.data.books ?? [];
  const booksById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);

  // cluster list + member indices (for centroids), lens-independent
  const { clusters, members } = useMemo(() => {
    const members = new Map<number, number[]>();
    books.forEach((b, i) => {
      if (b.cluster < 0) return;
      (members.get(b.cluster) ?? members.set(b.cluster, []).get(b.cluster)!).push(i);
    });
    const clusters: Cluster[] = [...members.entries()]
      .map(([id, idxs]) => ({ id, label: store?.data.clusters[String(id)] ?? "", count: idxs.length }))
      .sort((a, b) => b.count - a.count);
    return { clusters, members };
  }, [books, store]);

  function centroid(idxs: number[]): Focus | null {
    if (!store) return null;
    const layout = store.data.layouts[lens];
    const pts = idxs.map((i) => layout[i]).filter(Boolean) as number[][];
    if (!pts.length) return null;
    const c3: [number, number, number] = [0, 0, 0];
    const c2: [number, number] = [0, 0];
    for (const e of pts) {
      c3[0] += e[0]; c3[1] += e[1]; c3[2] += e[2];
      c2[0] += e[3]; c2[1] += e[4];
    }
    const m = pts.length;
    const center3d: [number, number, number] = [c3[0] / m, c3[1] / m, c3[2] / m];
    const center2d: [number, number] = [c2[0] / m, c2[1] / m];
    let radius = 0;
    for (const e of pts) {
      radius = Math.max(radius, Math.hypot(e[0] - center3d[0], e[1] - center3d[1], e[2] - center3d[2]));
    }
    return { center3d, center2d, radius };
  }

  function focusCluster(c: Cluster) {
    const centre = centroid(members.get(c.id) ?? []);
    if (!centre) return;
    setMode({ view: "galaxy" });
    setFocus({ ...centre, clusterId: c.id });
  }

  function focusBook(b: Book) {
    if (!store) return;
    const i = store.index.get(b.id)!;
    const e = store.data.layouts[lens][i] ?? store.data.layouts.all[i];
    if (!e) return;
    setMode({ view: "galaxy" });
    setFocus({ center3d: [e[0], e[1], e[2]], center2d: [e[3], e[4]], radius: 3, bookId: b.id });
  }

  function changeLens(l: Lens) {
    setLens(l);
    setFocus(null); // centroids differ per layout; reset the view on a lens switch
  }

  if (!store) {
    return (
      <div style={{ padding: 32, fontFamily: "system-ui", background: "#05060d", color: "#dde3f5", height: "100vh" }}>
        <h2>book-vector</h2>
        <p>Loading… (if this never resolves, the pipeline needs to write <code>web/public/data/</code>)</p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        background: "#05060d",
        color: "#dde3f5",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", borderBottom: "1px solid #171b28" }}>
        <strong>book-vector</strong>
        <button onClick={() => setThreeD((v) => !v)}>{threeD ? "3D" : "2D"}</button>
        {mode.view === "constellation" && (
          <button onClick={() => setMode({ view: "galaxy" })}>← galaxy</button>
        )}
        {focus && mode.view === "galaxy" && <button onClick={() => setFocus(null)}>reset view</button>}
        <span style={{ opacity: 0.5, fontSize: 12 }}>
          {mode.view === "galaxy"
            ? "toggle the lens (left) to reshape the galaxy · click a point to dive in · drag to orbit"
            : "switch the lens (left) to re-rank these neighbors"}
        </span>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar
          store={store}
          clusters={clusters}
          books={books}
          booksById={booksById}
          lens={lens}
          onLens={changeLens}
          activeClusterId={focus?.clusterId}
          onFocusCluster={focusCluster}
          onFocusBook={focusBook}
        />
        <main style={{ flex: 1, minWidth: 0, position: "relative" }}>
          {mode.view === "galaxy" ? (
            <Galaxy
              books={books}
              layout={store.data.layouts[lens]}
              lens={lens}
              clusterNames={store.data.clusters}
              threeD={threeD}
              focus={focus}
              onSelect={(bookId) => setMode({ view: "constellation", bookId })}
            />
          ) : (
            <Constellation
              store={store}
              book={booksById.get(mode.bookId)!}
              booksById={booksById}
              lens={lens}
              onSelect={(bookId) => setMode({ view: "constellation", bookId })}
            />
          )}
        </main>
      </div>
    </div>
  );
}
