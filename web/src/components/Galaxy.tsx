import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { Book } from "../types";

interface Props {
  books: Book[];
  threeD: boolean;
  onSelect: (bookId: string) => void;
}

/**
 * The galaxy: an instanced point cloud of every book, positioned by precomputed
 * UMAP coords. Instancing keeps 10k+ points smooth. Click a point to dive into
 * its constellation. TODO: color by cluster, hover → BookTooltip.
 */
export function Galaxy({ books, threeD, onSelect }: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 40], fov: 60 }}>
      <ambientLight intensity={0.8} />
      <Points books={books} threeD={threeD} onSelect={onSelect} />
      <OrbitControls enableRotate={threeD} />
    </Canvas>
  );
}

function Points({ books, threeD, onSelect }: Props) {
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

  useMemo(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => {
      m.setPosition(p[0], p[1], p[2]);
      ref.current!.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [positions]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, Math.max(books.length, 1)]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId != null) onSelect(books[e.instanceId].id);
      }}
    >
      <sphereGeometry args={[0.15, 8, 8]} />
      <meshStandardMaterial color="#8ab4ff" />
    </instancedMesh>
  );
}
