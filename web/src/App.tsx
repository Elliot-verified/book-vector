import { useEffect, useMemo, useState } from "react";
import { Galaxy } from "./components/Galaxy";
import { Constellation } from "./components/Constellation";
import { Sidebar } from "./components/Sidebar";
import type { Book, Cluster, FacetWeights, Focus, GalaxyData } from "./types";

type Mode = { view: "galaxy" } | { view: "constellation"; bookId: string };

export function App() {
  const [data, setData] = useState<GalaxyData | null>(null);
  const [mode, setMode] = useState<Mode>({ view: "galaxy" });
  const [threeD, setThreeD] = useState(true);
  const [weights, setWeights] = useState<FacetWeights>({ arc: 1 });
  const [focus, setFocus] = useState<Focus | null>(null);

  useEffect(() => {
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

  // "hyperniche genres": one entry per emergent cluster, with its centroid and
  // extent in both layouts, sorted largest-first. Noise (-1) is excluded.
  const clusters = useMemo<Cluster[]>(() => {
    if (!data) return [];
    const groups = new Map<number, Book[]>();
    for (const b of data.books) {
      if (b.cluster < 0) continue;
      (groups.get(b.cluster) ?? groups.set(b.cluster, []).get(b.cluster)!).push(b);
    }
    const out: Cluster[] = [];
    for (const [id, members] of groups) {
      const c3: [number, number, number] = [0, 0, 0];
      const c2: [number, number] = [0, 0];
      for (const b of members) {
        c3[0] += b.coords.xyz[0]; c3[1] += b.coords.xyz[1]; c3[2] += b.coords.xyz[2];
        c2[0] += b.coords.xy[0]; c2[1] += b.coords.xy[1];
      }
      const n = members.length;
      const center3d: [number, number, number] = [c3[0] / n, c3[1] / n, c3[2] / n];
      const center2d: [number, number] = [c2[0] / n, c2[1] / n];
      let radius = 0;
      for (const b of members) {
        const dx = b.coords.xyz[0] - center3d[0];
        const dy = b.coords.xyz[1] - center3d[1];
        const dz = b.coords.xyz[2] - center3d[2];
        radius = Math.max(radius, Math.hypot(dx, dy, dz));
      }
      out.push({ id, label: data.clusters[String(id)] ?? "", count: n, center3d, center2d, radius });
    }
    return out.sort((a, b) => b.count - a.count);
  }, [data]);

  function focusCluster(c: Cluster) {
    setMode({ view: "galaxy" });
    setFocus({ center3d: c.center3d, center2d: c.center2d, radius: c.radius, clusterId: c.id });
  }

  function focusBook(b: Book) {
    setMode({ view: "galaxy" });
    setFocus({ center3d: b.coords.xyz, center2d: b.coords.xy, radius: 3, bookId: b.id });
  }

  if (!data) {
    return (
      <div style={{ padding: 32, fontFamily: "system-ui", background: "#05060d", color: "#dde3f5", height: "100vh" }}>
        <h2>book-vector</h2>
        <p>
          Loading galaxy… (if this never resolves, run the pipeline: it writes{" "}
          <code>web/public/data/galaxy.json</code>)
        </p>
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
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "10px 14px",
          borderBottom: "1px solid #171b28",
        }}
      >
        <strong>book-vector</strong>
        <button onClick={() => setThreeD((v) => !v)}>{threeD ? "3D" : "2D"}</button>
        {mode.view === "constellation" && (
          <button onClick={() => setMode({ view: "galaxy" })}>← galaxy</button>
        )}
        {focus && mode.view === "galaxy" && (
          <button onClick={() => setFocus(null)}>reset view</button>
        )}
        <span style={{ opacity: 0.5, fontSize: 12 }}>
          {mode.view === "galaxy"
            ? "click a point to dive into its constellation · drag to orbit"
            : "adjust the facet lens in the sidebar to re-rank neighbors"}
        </span>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar
          clusters={clusters}
          books={data.books}
          booksById={booksById}
          weights={weights}
          onWeights={setWeights}
          activeClusterId={focus?.clusterId}
          onFocusCluster={focusCluster}
          onFocusBook={focusBook}
        />
        <main style={{ flex: 1, minWidth: 0, position: "relative" }}>
          {mode.view === "galaxy" ? (
            <Galaxy
              books={data.books}
              clusterNames={data.clusters}
              threeD={threeD}
              focus={focus}
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
        </main>
      </div>
    </div>
  );
}
