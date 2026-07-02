import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Book } from "../types";
import { BookTooltip } from "./BookTooltip";

interface Props {
  books: Book[];
  clusterNames: Record<string, string>;
  threeD: boolean;
  onSelect: (bookId: string) => void;
}

/** Deterministic, well-spread cluster colors; noise (-1) is dim gray. */
function clusterColor(cluster: number): THREE.Color {
  if (cluster < 0) return new THREE.Color("#3a3f52");
  const hue = (cluster * 0.61803398875) % 1; // golden-ratio hop around the wheel
  return new THREE.Color().setHSL(hue, 0.65, 0.62);
}

/**
 * The galaxy: an instanced point cloud of every book, positioned by precomputed
 * UMAP coords and colored by emergent cluster. Click a point to dive into its
 * constellation; hover shows the book + its cluster's theme label.
 */
export function Galaxy({ books, clusterNames, threeD, onSelect }: Props) {
  const [hover, setHover] = useState<{ book: Book; x: number; y: number } | null>(null);

  return (
    <>
      <Canvas camera={{ position: [0, 0, 40], fov: 60 }}>
        <ambientLight intensity={1.2} />
        <Points
          books={books}
          threeD={threeD}
          onSelect={onSelect}
          onHover={(book, x, y) => setHover(book ? { book, x, y } : null)}
        />
        <OrbitControls enableRotate={threeD} />
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

function Points({
  books,
  threeD,
  onSelect,
  onHover,
}: {
  books: Book[];
  threeD: boolean;
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
      ref.current!.setColorAt(i, clusterColor(books[i].cluster));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [positions, books]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, Math.max(books.length, 1)]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId != null) onSelect(books[e.instanceId].id);
      }}
      onPointerMove={(e) => {
        if (e.instanceId != null) {
          onHover(books[e.instanceId], e.clientX, e.clientY);
        }
      }}
      onPointerOut={() => onHover(null, 0, 0)}
    >
      <sphereGeometry args={[0.16, 8, 8]} />
      <meshStandardMaterial />
    </instancedMesh>
  );
}
