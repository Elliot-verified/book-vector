import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Book, Focus, LayoutEntry, Lens } from "../types";
import { BookTooltip } from "./BookTooltip";

interface Props {
  books: Book[];
  layout: LayoutEntry[]; // active lens, aligned to books
  lens: Lens;
  clusterNames: Record<string, string>;
  threeD: boolean;
  focus: Focus | null;
  onSelect: (bookId: string) => void;
}

function clusterColor(cluster: number): THREE.Color {
  if (cluster < 0) return new THREE.Color("#7b83a0");
  const hue = (cluster * 0.61803398875) % 1;
  return new THREE.Color().setHSL(hue, 0.7, 0.66);
}
const HILITE = new THREE.Color("#ffffff");
// when a cluster/book is focused, everyone else recedes to this muted slate —
// still visible as context, but the focused points clearly stand out
const MUTED = new THREE.Color("#363c4c");

/**
 * The galaxy: an instanced point cloud positioned by the *active lens* layout.
 * Switching lenses (or 2D/3D) animates the points to their new positions;
 * points absent from a lens fade out (scale 0). Unlit material so nothing
 * renders dark. Focusing a cluster/book flies the camera and swells those
 * points while the rest stay visible.
 */
export function Galaxy({ books, layout, lens, clusterNames, threeD, focus, onSelect }: Props) {
  const [hover, setHover] = useState<{ book: Book; x: number; y: number } | null>(null);
  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 32], fov: 60 }}
        dpr={[1, 1.5]} // cap pixel ratio so retina phones don't render at 3× (big GPU win)
        style={{ touchAction: "none" }} // let OrbitControls own touch gestures; don't scroll the page
      >
        <Points
          books={books}
          layout={layout}
          lens={lens}
          threeD={threeD}
          focus={focus}
          onSelect={onSelect}
          onHover={(b, x, y) => setHover(b ? { book: b, x, y } : null)}
        />
        <OrbitControls makeDefault enableRotate={threeD} />
        <CameraRig focus={focus} threeD={threeD} />
      </Canvas>
      {hover && (
        <BookTooltip
          book={hover.book}
          clusterName={clusterNames[String(hover.book.cluster)]}
          x={hover.x}
          y={hover.y}
        />
      )}
    </>
  );
}

function CameraRig({ focus, threeD }: { focus: Focus | null; threeD: boolean }) {
  const controls = useThree((s) => s.controls) as any;
  const { camera } = useThree();
  const target = useRef<THREE.Vector3 | null>(null);
  const camDest = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!focus || !controls) return;
    const c = threeD
      ? focus.center3d
      : ([focus.center2d[0], focus.center2d[1], 0] as [number, number, number]);
    target.current = new THREE.Vector3(c[0], c[1], c[2]);
    const dist = Math.max(focus.radius * 2.4, focus.bookId ? 7 : 14);
    camDest.current = new THREE.Vector3(c[0], c[1], c[2] + dist);
  }, [focus, threeD, controls]);

  useFrame(() => {
    if (!target.current || !camDest.current || !controls) return;
    controls.target.lerp(target.current, 0.12);
    camera.position.lerp(camDest.current, 0.12);
    controls.update();
    if (camera.position.distanceTo(camDest.current) < 0.08) {
      target.current = null;
      camDest.current = null;
    }
  });
  return null;
}

function Points({
  books,
  layout,
  lens,
  threeD,
  focus,
  onSelect,
  onHover,
}: {
  books: Book[];
  layout: LayoutEntry[];
  lens: Lens;
  threeD: boolean;
  focus: Focus | null;
  onSelect: (bookId: string) => void;
  onHover: (book: Book | null, x: number, y: number) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = books.length;

  // target position + visibility for the active lens / dimension
  const { targets, visible } = useMemo(() => {
    const targets = new Float32Array(n * 3);
    const visible = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const e = layout[i];
      if (!e) continue; // absent in this lens → hidden
      visible[i] = 1;
      targets[i * 3] = threeD ? e[0] : e[3];
      targets[i * 3 + 1] = threeD ? e[1] : e[4];
      targets[i * 3 + 2] = threeD ? e[2] : 0;
    }
    return { targets, visible };
  }, [layout, threeD, n]);

  const current = useRef<Float32Array>(new Float32Array(n * 3));
  const inited = useRef(false);
  const animating = useRef(false);

  // on lens/dimension/focus change, (re)start the transition
  useEffect(() => {
    if (!inited.current) {
      current.current.set(targets); // first paint: snap into place
      inited.current = true;
    }
    animating.current = true;
  }, [targets, focus]);

  // is anything focused, and is book i part of that focus?
  const focusing = focus != null && (focus.bookId != null || focus.clusterId != null);
  const inFocus = (i: number): boolean =>
    (focus?.bookId != null && books[i].id === focus.bookId) ||
    (focus?.clusterId != null && books[i].cluster === focus.clusterId);

  const scaleFor = (i: number): number => {
    if (!visible[i]) return 0;
    if (focus?.bookId && books[i].id === focus.bookId) return 2.6;
    if (focus?.clusterId != null && books[i].cluster === focus.clusterId) return 2.4;
    return focusing ? 0.42 : 1; // shrink the rest so the focused set shows through
  };

  useFrame(() => {
    if (!ref.current || !animating.current) return;
    const cur = current.current;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    let moving = 0;
    for (let i = 0; i < n; i++) {
      for (let a = 0; a < 3; a++) {
        const k = i * 3 + a;
        const d = targets[k] - cur[k];
        if (Math.abs(d) > 0.01) moving++;
        cur[k] += d * 0.16;
      }
      const s = scaleFor(i);
      pos.set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]);
      scl.set(s, s, s);
      m.compose(pos, quat, scl);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (moving === 0) animating.current = false;
  });

  // colors (no animation): the focused book is white, the focused set keeps its
  // bright cluster color, and — when something is focused — everyone else recedes
  // to a muted slate so the focused cluster/book clearly stands out.
  useEffect(() => {
    if (!ref.current) return;
    for (let i = 0; i < n; i++) {
      let c: THREE.Color;
      if (focus?.bookId && books[i].id === focus.bookId) c = HILITE;
      else if (focusing && !inFocus(i)) c = MUTED;
      else c = clusterColor(books[i].cluster);
      ref.current.setColorAt(i, c);
    }
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [books, focus, n, lens]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, Math.max(n, 1)]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId != null && visible[e.instanceId]) onSelect(books[e.instanceId].id);
      }}
      onPointerMove={(e) => {
        if (e.instanceId != null && visible[e.instanceId]) onHover(books[e.instanceId], e.clientX, e.clientY);
      }}
      onPointerOut={() => onHover(null, 0, 0)}
    >
      <sphereGeometry args={[0.16, 6, 6]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
