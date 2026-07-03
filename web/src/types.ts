// Shared types. FACETS mirrors pipeline/bookvector/facets.py — keep in sync.
export const FACETS = [
  "protagonist",
  "relationship",
  "arc",
  "setting_as_device",
] as const;

export type Facet = (typeof FACETS)[number];

export interface BookCoords {
  xyz: [number, number, number];
  xy: [number, number];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  genres: string[];
  coords: BookCoords;
  cluster: number; // -1 == noise / unclustered
  facets: Partial<Record<Facet, string>>;
}

/** Shape of the pipeline's exported web/public/data/galaxy.json. */
export interface GalaxyData {
  facets: Facet[];
  clusters: Record<string, string>; // cluster id -> LLM theme label
  books: Book[];
}

/** A composable lens: how strongly each facet counts in a query (0 = ignore). */
export type FacetWeights = Partial<Record<Facet, number>>;

export interface Neighbor {
  id: string;
  similarity: number;
  sharedFacets: Facet[];
  /** per-facet cosine similarity, for the "why" display */
  facetSims: Partial<Record<Facet, number>>;
}

/** A book sitting between two others: similar to both A and B. */
export interface Midpoint {
  id: string;
  similarity: number; // mean of simToA / simToB
  simToA: number;
  simToB: number;
}

/** A derived cluster ("hyperniche genre") with its centroid in both layouts. */
export interface Cluster {
  id: number;
  label: string;
  count: number;
  center3d: [number, number, number];
  center2d: [number, number];
  radius: number; // max distance of a member from the 3D centroid, for framing
}

/** Where the camera should fly, and what to highlight. */
export interface Focus {
  center3d: [number, number, number];
  center2d: [number, number];
  radius: number;
  clusterId?: number; // highlight a whole cluster
  bookId?: string; // highlight a single book
}
