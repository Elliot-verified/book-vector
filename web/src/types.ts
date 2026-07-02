// Shared types. FACETS mirrors pipeline/bookvector/facets.py — keep in sync.
export const FACETS = [
  "protagonist",
  "relationship",
  "arc",
  "setting_as_device",
  "twist",
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
  coords: BookCoords;
  cluster?: number;
}

/** A composable lens: how strongly each facet counts in a query (0 = ignore). */
export type FacetWeights = Partial<Record<Facet, number>>;

export interface Neighbor {
  id: string;
  similarity: number;
  sharedFacets: Facet[];
}
