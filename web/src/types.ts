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
