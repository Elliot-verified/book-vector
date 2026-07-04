// Shared types. FACETS mirrors pipeline/bookvector/facets.py — keep in sync.
export const FACETS = [
  "protagonist",
  "relationship",
  "arc",
  "setting_as_device",
] as const;
export type Facet = (typeof FACETS)[number];

// A "lens" reshapes the galaxy and re-ranks neighbors: one per facet, plus
// `all` (every facet, equal weight). Mirrors reduce.LENSES.
export const LENSES = ["all", ...FACETS] as const;
export type Lens = (typeof LENSES)[number];

export const LENS_LABEL: Record<Lens, string> = {
  all: "all facets",
  protagonist: "protagonist",
  relationship: "relationship",
  arc: "arc",
  setting_as_device: "setting",
};

export interface Book {
  id: string;
  title: string;
  author: string;
  genres: string[];
  cluster: number; // -1 == noise / unclustered
  facets: Partial<Record<Facet, string>>;
}

/** A book's position in one lens: [x,y,z, x2,y2] or null if absent from it. */
export type LayoutEntry = [number, number, number, number, number] | null;

/** Shape of web/public/data/galaxy.json (metadata + per-lens layouts). */
export interface GalaxyData {
  facets: Facet[];
  lenses: Lens[];
  k: number;
  midDim: number;
  clusters: Record<string, string>; // cluster id -> theme label
  books: Book[];
  layouts: Record<Lens, LayoutEntry[]>; // aligned to books order
}

export interface Neighbor {
  id: string;
  similarity: number;
}

/** A book sitting between two others (client-side, over the reduced concat). */
export interface Midpoint {
  id: string;
  similarity: number;
  simToA: number;
  simToB: number;
}

/** A derived cluster ("hyperniche genre"). Centroids are computed per lens. */
export interface Cluster {
  id: number;
  label: string;
  count: number;
}

/** Where the camera should fly, and what to highlight. */
export interface Focus {
  center3d: [number, number, number];
  center2d: [number, number];
  radius: number;
  clusterId?: number;
  bookId?: string;
}
