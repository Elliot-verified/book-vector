"""Pipeline configuration — paths, model names, and constants.

Override via environment variables where noted.
"""

import os
from pathlib import Path

from .facets import FACET_KEYS

# --- paths ---------------------------------------------------------------
PIPELINE_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("BOOKVECTOR_DATA", PIPELINE_ROOT / "data"))

CMU_TARBALL = DATA_DIR / "booksummaries.tar.gz"
BOOKS_JSONL = DATA_DIR / "books.jsonl"        # ingest.py
FACETS_JSONL = DATA_DIR / "facets.jsonl"      # extract.py
VECTORS_NPZ = DATA_DIR / "vectors.npz"        # embed.py
CLUSTERS_JSON = DATA_DIR / "clusters.json"    # cluster.py
COORDS_JSON = DATA_DIR / "coords.json"        # reduce.py  (also copied to web/public/data)
INDEX_SQLITE = DATA_DIR / "index.sqlite"      # index.py

# --- source data ---------------------------------------------------------
# CMU Book Summary Dataset (CC BY-SA, see NOTICE), vendored as a GitHub release
# because the primary host (https://www.cs.cmu.edu/~dbamman/data/booksummaries.tar.gz)
# is blocked by this web env's network policy. Override with BOOKVECTOR_CMU_URL.
CMU_URL = os.environ.get(
    "BOOKVECTOR_CMU_URL",
    "https://github.com/elliot-verified/book-vector/releases/download/cmu-data-v1/booksummaries.tar.gz",
)
# sha256 of the vendored tarball; acquire.py verifies fresh downloads against it.
CMU_SHA256 = "2593556158192774816102d1463565ad0e905e45f339976775fbc858ccf5e764"

# --- models --------------------------------------------------------------
# Extraction: cheap, batched (D6). Embeddings: local, free (D5).
EXTRACTION_MODEL = os.environ.get("BOOKVECTOR_EXTRACT_MODEL", "claude-haiku-4-5-20251001")
EMBEDDING_MODEL = os.environ.get("BOOKVECTOR_EMBED_MODEL", "BAAI/bge-large-en-v1.5")

# --- catalog / knobs -----------------------------------------------------
DEFAULT_CATALOG_LIMIT = 2000   # ~2–3k MVP catalog (D4)
UMAP_N_COMPONENTS = 3          # galaxy is 3D; also emit 2D for comparison
UMAP_N_NEIGHBORS = 15
HDBSCAN_MIN_CLUSTER_SIZE = 8
KNN_DEFAULT = 12               # constellation neighbors

FACETS = FACET_KEYS  # re-export for convenience
