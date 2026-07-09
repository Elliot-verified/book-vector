import { useEffect, useMemo, useState } from "react";
import { Galaxy } from "./components/Galaxy";
import { Constellation } from "./components/Constellation";
import { GenreList } from "./components/GenreList";
import { Sidebar } from "./components/Sidebar";
import { loadStore, type Store } from "./lib/data";
import { useIsMobile } from "./lib/useMediaQuery";
import type { Book, Cluster, Focus, Lens } from "./types";

type Mode =
  | { view: "galaxy" }
  | { view: "constellation"; bookId: string }
  | { view: "genre"; clusterId: number };

export function App() {
  const [store, setStore] = useState<Store | null>(null);
  const [mode, setMode] = useState<Mode>({ view: "galaxy" });
  const [threeD, setThreeD] = useState(true);
  const [lens, setLens] = useState<Lens>("all");
  const [focus, setFocus] = useState<Focus | null>(null);
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
    setDrawerOpen(false); // on mobile, close the drawer so the galaxy is visible
  }

  function openGenre(c: Cluster) {
    setMode({ view: "genre", clusterId: c.id });
    setFocus({ ...(centroid(members.get(c.id) ?? []) ?? { center3d: [0, 0, 0], center2d: [0, 0], radius: 3 }), clusterId: c.id });
    setDrawerOpen(false);
  }

  function focusBook(b: Book) {
    if (!store) return;
    const i = store.index.get(b.id)!;
    const e = store.data.layouts[lens][i] ?? store.data.layouts.all[i];
    if (!e) return;
    setMode({ view: "galaxy" });
    setFocus({ center3d: [e[0], e[1], e[2]], center2d: [e[3], e[4]], radius: 3, bookId: b.id });
    setDrawerOpen(false);
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

  const sidebar = (
    <Sidebar
      store={store}
      clusters={clusters}
      books={books}
      booksById={booksById}
      lens={lens}
      onLens={changeLens}
      activeClusterId={focus?.clusterId}
      onFocusCluster={focusCluster}
      onOpenGenre={openGenre}
      onFocusBook={focusBook}
      mobile={isMobile}
    />
  );

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
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", borderBottom: "1px solid #171b28" }}>
        {isMobile && (
          <button onClick={() => setDrawerOpen((v) => !v)} style={menuBtn} aria-label="toggle menu">
            ☰ genres
          </button>
        )}
        <strong>book-vector</strong>
        {mode.view === "galaxy" && (
          <button onClick={() => setThreeD((v) => !v)} style={topBtn}>{threeD ? "3D" : "2D"}</button>
        )}
        {mode.view !== "galaxy" && (
          <button onClick={() => setMode({ view: "galaxy" })} style={topBtn}>← galaxy</button>
        )}
        {focus && mode.view === "galaxy" && <button onClick={() => setFocus(null)} style={topBtn}>reset view</button>}
        {!isMobile && (
          <span style={{ opacity: 0.5, fontSize: 12 }}>
            {mode.view === "galaxy"
              ? "toggle a lens (left) to reshape the galaxy · click a genre to fly there, double-click to list its books · drag to orbit"
              : mode.view === "genre"
              ? "click a book to see its constellation of neighbors"
              : "switch the lens (left) to re-rank these neighbors"}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0, position: "relative" }}>
        {/* Desktop: sidebar inline. Mobile: sidebar as a slide-over drawer. */}
        {!isMobile && sidebar}
        {isMobile && drawerOpen && (
          <>
            <div onClick={() => setDrawerOpen(false)} style={backdrop} />
            <div style={drawer}>{sidebar}</div>
          </>
        )}

        <main style={{ flex: 1, minWidth: 0, position: "relative" }}>
          {mode.view === "galaxy" && (
            <Galaxy
              books={books}
              layout={store.data.layouts[lens]}
              lens={lens}
              clusterNames={store.data.clusters}
              threeD={threeD}
              focus={focus}
              onSelect={(bookId) => setMode({ view: "constellation", bookId })}
            />
          )}
          {mode.view === "genre" && (
            <GenreList
              label={store.data.clusters[String(mode.clusterId)] ?? ""}
              clusterId={mode.clusterId}
              books={(members.get(mode.clusterId) ?? []).map((i) => books[i])}
              onSelect={(bookId) => setMode({ view: "constellation", bookId })}
            />
          )}
          {mode.view === "constellation" && (
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

const topBtn: React.CSSProperties = {
  minHeight: 40,
  padding: "6px 12px",
  background: "#141a2c",
  color: "#dde3f5",
  border: "1px solid #232941",
  borderRadius: 7,
  cursor: "pointer",
  fontSize: 14,
};
const menuBtn: React.CSSProperties = { ...topBtn, background: "#1d2740", borderColor: "#2b3a6b" };

const backdrop: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(3,4,10,0.55)",
  zIndex: 20,
};
const drawer: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  bottom: 0,
  zIndex: 21,
  boxShadow: "2px 0 24px rgba(0,0,0,0.5)",
};
