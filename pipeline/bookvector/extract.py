"""Stage 3 — LLM facet extraction (Option B, D6).

Reads each book's plot summary and emits the structured facet fields defined in
`facets.py`, via the Anthropic **Message Batches API** (50% discount; batches
usually complete within an hour). Extraction quality is the #1 risk (PLAN.md) —
keep the schema tight, normalize, and spot-check.

Reads `data/catalog.jsonl` (the curated MVP subset from curate.py), falling
back to `data/books.jsonl` if no catalog exists.

Emits `data/facets.jsonl`:
    {"id", "facets": {"protagonist": "...", "relationship": "...", ...}}

Run:  python -m bookvector.extract            # submit + poll + collect
      python -m bookvector.extract <batch_id> # resume polling an existing batch
"""

from __future__ import annotations

import json
import sys
import time

from . import config
from .facets import FACETS, FACET_KEYS

POLL_SECONDS = 60
MAX_SUMMARY_CHARS = 8000  # ~1500 words; longer summaries are truncated for cost


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
        "short phrase (empty string if genuinely absent). Return ONLY the JSON "
        "object, no prose or code fences.\n\n"
        f"Title: {title}\nAuthor: {author}\nSummary: {summary[:MAX_SUMMARY_CHARS]}"
    )


def _load_books() -> list[dict]:
    src = config.CATALOG_JSONL if config.CATALOG_JSONL.exists() else config.BOOKS_JSONL
    with src.open() as f:
        books = [json.loads(line) for line in f]
    print(f"[extract] {len(books)} books from {src.name}")
    return books


def submit() -> str:
    """Submit one batch covering every catalog book. Returns the batch id."""
    from anthropic import Anthropic
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request

    client = Anthropic()
    requests = [
        Request(
            custom_id=f"book-{b['id']}",
            params=MessageCreateParamsNonStreaming(
                model=config.EXTRACTION_MODEL,
                max_tokens=512,
                messages=[{
                    "role": "user",
                    "content": build_prompt(b["title"], b["author"], b["summary"]),
                }],
            ),
        )
        for b in _load_books()
    ]
    batch = client.messages.batches.create(requests=requests)
    print(f"[extract] submitted batch {batch.id} ({len(requests)} requests)")
    return batch.id


def collect(batch_id: str) -> int:
    """Poll until the batch ends, then write facets.jsonl. Returns count written."""
    from anthropic import Anthropic

    client = Anthropic()
    while True:
        batch = client.messages.batches.retrieve(batch_id)
        if batch.processing_status == "ended":
            break
        c = batch.request_counts
        print(f"[extract] {batch.processing_status}: "
              f"{c.succeeded} ok / {c.errored} err / {c.processing} pending")
        time.sleep(POLL_SECONDS)

    written = failed = 0
    with config.FACETS_JSONL.open("w") as out:
        for result in client.messages.batches.results(batch_id):
            book_id = result.custom_id.removeprefix("book-")
            if result.result.type != "succeeded":
                failed += 1
                continue
            msg = result.result.message
            text = next((b.text for b in msg.content if b.type == "text"), "")
            facets = _parse_facets(text)
            if facets is None:
                failed += 1
                continue
            out.write(json.dumps({"id": book_id, "facets": facets}) + "\n")
            written += 1

    print(f"[extract] wrote {written} facet records ({failed} failed) "
          f"-> {config.FACETS_JSONL}")
    return written


def extract() -> int:
    """Submit + poll + collect in one go."""
    return collect(submit())


def _parse_facets(text: str) -> dict[str, str] | None:
    """Parse + validate the model's JSON, coercing to the known facet keys."""
    text = text.strip()
    if text.startswith("```"):  # tolerate a stray code fence
        text = text.strip("`").removeprefix("json").strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        data = json.loads(text[start:end + 1])
    except ValueError:
        return None
    return {k: str(data.get(k, "")).strip() for k in FACET_KEYS}


if __name__ == "__main__":
    if len(sys.argv) > 1:
        collect(sys.argv[1])
    else:
        extract()
