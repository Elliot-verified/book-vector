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
COORDS_JSON = DATA_DIR / "coords.json"        # reduce.py

# --- web artifacts (export.py) -------------------------------------------
# Client-served: the galaxy (coords + metadata + cluster labels).
WEB_PUBLIC_DATA = PIPELINE_ROOT.parent / "web" / "public" / "data"
GALAXY_JSON = WEB_PUBLIC_DATA / "galaxy.json"
# Function-side (not shipped to the browser): int8-quantized per-facet vectors
# the query function brute-forces over. Pure data — no native modules (D10).
WEB_FN_DATA = PIPELINE_ROOT.parent / "web" / "data"
VECTORS_BIN = WEB_FN_DATA / "vectors.bin"
VECTORS_META = WEB_FN_DATA / "vectors.meta.json"

# --- source data ---------------------------------------------------------
# CMU Book Summary Dataset (CC BY-SA). See PLAN.md "Dataset status & access".
# NOTE: this web env's network policy may block cs.cmu.edu; vendor via a GitHub
# release mirror or widen the policy. Override with BOOKVECTOR_CMU_URL.
CMU_URL = os.environ.get(
    "BOOKVECTOR_CMU_URL",
    "https://www.cs.cmu.edu/~dbamman/data/booksummaries.tar.gz",
)

# --- models --------------------------------------------------------------
# Extraction + labels: cheap (D6/D8). Embeddings: local, free (D5).
EXTRACTION_MODEL = os.environ.get("BOOKVECTOR_EXTRACT_MODEL", "claude-haiku-4-5-20251001")
LABEL_MODEL = os.environ.get("BOOKVECTOR_LABEL_MODEL", EXTRACTION_MODEL)
# bge-base via fastembed's GCS mirror: this env's network policy blocks
# huggingface.co, and storage.googleapis.com only hosts base/small. On a
# machine with HF access, set BOOKVECTOR_EMBED_BACKEND=sentence-transformers
# and BOOKVECTOR_EMBED_MODEL=BAAI/bge-large-en-v1.5 for the D5 default.
EMBEDDING_MODEL = os.environ.get("BOOKVECTOR_EMBED_MODEL", "BAAI/bge-base-en-v1.5")
EMBED_BACKEND = os.environ.get("BOOKVECTOR_EMBED_BACKEND", "fastembed")

# --- catalog / knobs -----------------------------------------------------
DEFAULT_CATALOG_LIMIT = 2000   # ~2–3k MVP catalog (D4)
GALAXY_SPACE = "concat"        # space for the galaxy layout + emergent clusters
UMAP_N_COMPONENTS = 3          # galaxy is 3D; also emit 2D for comparison
UMAP_N_NEIGHBORS = 15
CLUSTER_UMAP_DIMS = 20         # HDBSCAN runs on a UMAP reduction, not raw 1024-d
HDBSCAN_MIN_CLUSTER_SIZE = 8
KNN_DEFAULT = 12               # constellation neighbors

FACETS = FACET_KEYS  # re-export for convenience
