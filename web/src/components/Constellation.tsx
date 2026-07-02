import { useEffect, useState } from "react";
import { neighbors } from "../lib/api";
import type { FacetWeights, Neighbor } from "../types";

interface Props {
  bookId: string;
  weights: FacetWeights;
  threeD: boolean;
}

/**
 * Constellation: the K nearest neighbors of `bookId` under the current facet
 * weights, with the *why* (which facets match) surfaced. This is where
 * disentangled similarity shows — change the weights, the neighbors change.
 * TODO: render as a force-directed 3D graph in a Canvas; this is a list stub.
 */
export function Constellation({ bookId, weights }: Props) {
  const [items, setItems] = useState<Neighbor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(null);
    setError(null);
    neighbors(bookId, weights)
      .then(setItems)
      .catch((e) => setError(String(e)));
  }, [bookId, weights]);

  return (
    <div style={{ padding: 24, paddingTop: 64 }}>
      <h2>Neighbors of {bookId}</h2>
      {error && <p style={{ color: "#ff8a8a" }}>{error} (is the query fn running?)</p>}
      {!items && !error && <p>loading…</p>}
      <ul>
        {items?.map((n) => (
          <li key={n.id}>
            {n.id} — {n.similarity.toFixed(3)} · shares: {n.sharedFacets.join(", ") || "—"}
          </li>
        ))}
      </ul>
    </div>
  );
}
