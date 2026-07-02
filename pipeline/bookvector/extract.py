"""Stage 3 — LLM facet extraction (Option B, D6).

Reads each book's plot summary and emits the structured facet fields defined in
`facets.py`, via a cheap batched model (Haiku + Batch API). Extraction quality
is the #1 risk (PLAN.md) — keep the schema tight, normalize, and spot-check.

Emits `data/facets.jsonl`:
    {"id", "facets": {"protagonist": "...", "relationship": "...", ...}}
"""

from __future__ import annotations

import json

from . import config
from .facets import FACETS, FACET_KEYS


def build_prompt(title: str, author: str, summary: str) -> str:
    """The extraction prompt. This *is* the product — iterate on it carefully."""
    facet_lines = "\n".join(f"- {f.key}: {f.description} {f.guidance}" for f in FACETS)
    keys = ", ".join(f'"{k}"' for k in FACET_KEYS)
    return (
        "You extract narrative facets from a book's plot summary. Work only from "
        "the summary; do not invent. Be concise and abstract — describe the "
        "narrative shape, not surface details.\n\n"
        f"Facets to extract:\n{facet_lines}\n\n"
        f'Return STRICT JSON with exactly these keys: {{{keys}}}. Each value is a '
        "short phrase (empty string if genuinely absent).\n\n"
        f"Title: {title}\nAuthor: {author}\nSummary: {summary}"
    )


def extract(limit: int | None = None) -> int:
    """Extract facets for every book in books.jsonl. Returns count written.

    TODO: use the Anthropic **Batch API** for the 50% discount rather than
    per-request calls; validate each response against FACET_KEYS and retry on
    schema mismatch; record a small hand-labeled sample for the eval harness.
    """
    from anthropic import Anthropic  # imported lazily so the module loads dep-free

    client = Anthropic()
    written = 0
    with config.BOOKS_JSONL.open() as books, config.FACETS_JSONL.open("w") as out:
        for line in books:
            book = json.loads(line)
            prompt = build_prompt(book["title"], book["author"], book["summary"])
            resp = client.messages.create(
                model=config.EXTRACTION_MODEL,
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            facets = _parse_facets(resp.content[0].text)
            out.write(json.dumps({"id": book["id"], "facets": facets}) + "\n")
            written += 1
            if limit and written >= limit:
                break
    print(f"[extract] wrote {written} facet records -> {config.FACETS_JSONL}")
    return written


def _parse_facets(text: str) -> dict[str, str]:
    """Parse + validate the model's JSON, coercing to the known facet keys."""
    data = json.loads(text)
    return {k: str(data.get(k, "")).strip() for k in FACET_KEYS}


if __name__ == "__main__":
    extract(limit=config.DEFAULT_CATALOG_LIMIT)
