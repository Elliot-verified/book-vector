import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Book, Focus } from "../types";
import { BookTooltip } from "./BookTooltip";

interface Props {
  books: Book[];
  clusterNames: Record<string, string>;
  threeD: boolean;
  focus: Focus | null;
  onSelect: (bookId: string) => void;
}

/** Deterministic, well-spread cluster colors; noise (-1) is dim gray. */
function clusterColor(cluster: number): THREE.Color {
  if (cluster < 0) return new THREE.Color("#3a3f52");
  const hue = (cluster * 0.61803398875) % 1; // golden-ratio hop around the wheel
  return new THREE.Color().setHSL(hue, 0.65, 0.62);
}

const DIM = new THREE.Color("#20242f");
const HILITE = new THREE.Color("#ffffff");

/**
 * The galaxy: an instanced point cloud of every book, positioned by precomputed
 * UMAP coords and colored by emergent cluster. Click a point to dive into its
 * constellation; hover shows the book + its cluster's theme label. When `focus`
 * is set (from the sidebar), the camera flies to that cluster/book and the rest
 * of the cloud dims.
 */
export function Galaxy({ books, clusterNames, threeD, focus, onSelect }: Props) {
  const [hover, setHover] = useState<{ book: Book; x: number; y: number } | null>(null);

  return (
    <>
      <Canvas camera={{ position: [0, 0, 45], fov: 60 }}>
        <ambientLight intensity={1.2} />
        <Points
          books={books}
          threeD={threeD}
          focus={focus}
          onSelect={onSelect}
          onHover={(book, x, y) => setHover(book ? { book, x, y } : null)}
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

/** Smoothly flies the OrbitControls target + camera to the focused center. */
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
    const dist = Math.max(focus.radius * 2.6, focus.bookId ? 6 : 12);
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
  threeD,
  focus,
  onSelect,
  onHover,
}: {
  books: Book[];
  threeD: boolean;
  focus: Focus | null;
  onSelect: (bookId: string) => void;
  onHover: (book: Book | null, x: number, y: number) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const positions = useMemo(
    () =>
      books.map((b) => {
        const [x, y] = b.coords.xy;
        const [X, Y, Z] = b.coords.xyz;
        return threeD ? ([X, Y, Z] as const) : ([x, y, 0] as const);
      }),
    [books, threeD],
  );

  useEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => {
      m.setPosition(p[0], p[1], p[2]);
      ref.current!.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  // color / highlight pass — re-runs when focus changes
  useEffect(() => {
    if (!ref.current) return;
    books.forEach((b, i) => {
      let c: THREE.Color;
      if (focus?.bookId && b.id === focus.bookId) c = HILITE;
      else if (focus?.clusterId != null && b.cluster === focus.clusterId)
        c = clusterColor(b.cluster);
      else if (focus?.bookId != null || focus?.clusterId != null) c = DIM;
      else c = clusterColor(b.cluster);
      ref.current!.setColorAt(i, c);
    });
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [books, focus]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, Math.max(books.length, 1)]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId != null) onSelect(books[e.instanceId].id);
      }}
      onPointerMove={(e) => {
        if (e.instanceId != null) onHover(books[e.instanceId], e.clientX, e.clientY);
      }}
      onPointerOut={() => onHover(null, 0, 0)}
    >
      <sphereGeometry args={[0.16, 8, 8]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}
