"""Stage 3 — LLM facet extraction (Option B, D6).

Reads each book's plot summary and emits the structured facet fields defined in
`facets.py`, via Haiku on the **Batch API** (50% discount; the whole MVP catalog
is a single batch). Structured outputs (`output_config.format`) guarantee the
response is valid JSON matching the facet schema, so extraction quality — the
#1 risk (PLAN.md) — reduces to *content* quality, which the pilot + eval passes
police.

Emits `data/facets.jsonl`:
    {"id", "facets": {"protagonist": "...", "relationship": "...", ...}}

The in-flight batch id is persisted to `data/batch_id.txt`, so an interrupted
run resumes polling the same batch instead of paying for a new one.
"""

from __future__ import annotations

import json
import time

from . import config
from .facets import FACETS, FACET_KEYS

FACET_SCHEMA = {
    "type": "object",
    "properties": {k: {"type": "string"} for k in FACET_KEYS},
    "required": list(FACET_KEYS),
    "additionalProperties": False,
}

BATCH_ID_FILE = config.DATA_DIR / "batch_id.txt"


def build_prompt(title: str, author: str, summary: str) -> str:
    """The extraction prompt. This *is* the product — iterate on it carefully."""
    facet_lines = "\n".join(f"- {f.key}: {f.description} {f.guidance}" for f in FACETS)
    return (
        "You extract narrative facets from a book's plot summary. Work only from "
        "the summary; do not invent or use outside knowledge of the book. Be "
        "concise and abstract — describe the narrative *shape*, not surface "
        "details. Never mention character names, place names, or invented terms "
        "from the book: a reader who hasn't read it must understand each phrase, "
        "and books that share a shape must produce similar phrases.\n\n"
        f"Facets to extract:\n{facet_lines}\n\n"
        "Each value is one short phrase (under ~15 words), lowercase, no trailing "
        "period. Use an empty string only if the facet is genuinely absent from "
        "the summary.\n\n"
        f"Title: {title}\nAuthor: {author}\nSummary: {summary}"
    )


def _request_params(book: dict) -> dict:
    return {
        "model": config.EXTRACTION_MODEL,
        "max_tokens": 512,
        "output_config": {"format": {"type": "json_schema", "schema": FACET_SCHEMA}},
        "messages": [{
            "role": "user",
            "content": build_prompt(book["title"], book["author"], book["summary"]),
        }],
    }


def extract_direct(books: list[dict]) -> dict[str, dict]:
    """Extract facets with regular (non-batch) API calls. Used for the pilot
    (milestone 2) and to retry stragglers that errored inside a batch."""
    from anthropic import Anthropic

    client = Anthropic()
    out: dict[str, dict] = {}
    for book in books:
        resp = client.messages.create(**_request_params(book))
        out[book["id"]] = _parse_facets(_first_text(resp))
    return out


def extract(limit: int | None = None, poll_seconds: int = 30) -> int:
    """Batch-extract facets for every book in books.jsonl. Returns count written.

    Submits one Message Batch (or resumes the one recorded in batch_id.txt),
    polls until it ends, validates every result, and retries errored requests
    with direct calls.
    """
    from anthropic import Anthropic

    books = _load_books(limit)
    by_id = {b["id"]: b for b in books}
    client = Anthropic()

    batch_id = _pending_batch_id()
    if batch_id:
        print(f"[extract] resuming batch {batch_id}")
    else:
        batch = client.messages.batches.create(requests=[
            {"custom_id": f"book-{b['id']}", "params": _request_params(b)}
            for b in books
        ])
        batch_id = batch.id
        BATCH_ID_FILE.write_text(batch_id)
        print(f"[extract] submitted batch {batch_id} ({len(books)} requests)")

    while True:
        batch = client.messages.batches.retrieve(batch_id)
        if batch.processing_status == "ended":
            break
        c = batch.request_counts
        print(f"[extract] {batch.processing_status}: {c.succeeded} ok / "
              f"{c.errored} err / {c.processing} processing", flush=True)
        time.sleep(poll_seconds)

    facets: dict[str, dict] = {}
    failed: list[str] = []
    for result in client.messages.batches.results(batch_id):
        book_id = result.custom_id.removeprefix("book-")
        if result.result.type == "succeeded":
            try:
                facets[book_id] = _parse_facets(_first_text(result.result.message))
            except ValueError:
                failed.append(book_id)
        else:
            failed.append(book_id)

    if failed:
        retryable = [by_id[i] for i in failed if i in by_id]
        print(f"[extract] retrying {len(retryable)} failed requests directly")
        facets.update(extract_direct(retryable))

    written = skipped = 0
    with config.FACETS_JSONL.open("w") as out:
        for book in books:  # preserve catalog order
            f = facets.get(book["id"])
            if f is None:
                continue
            # mostly-empty facets = non-narrative work (essays, treatises,
            # reference) — no shape to embed, drop from the catalog
            if sum(1 for v in f.values() if v) < 3:
                skipped += 1
                continue
            out.write(json.dumps({"id": book["id"], "facets": f}) + "\n")
            written += 1
    BATCH_ID_FILE.unlink(missing_ok=True)
    print(f"[extract] wrote {written}/{len(books)} facet records "
          f"({skipped} non-narrative skipped) -> {config.FACETS_JSONL}")
    return written


def _load_books(limit: int | None) -> list[dict]:
    books = []
    with config.BOOKS_JSONL.open() as fh:
        for line in fh:
            books.append(json.loads(line))
            if limit and len(books) >= limit:
                break
    return books


def _pending_batch_id() -> str | None:
    if BATCH_ID_FILE.exists():
        return BATCH_ID_FILE.read_text().strip() or None
    return None


def _first_text(message) -> str:
    for block in message.content:
        if block.type == "text":
            return block.text
    raise ValueError(f"no text block in response (stop_reason={message.stop_reason})")


def _parse_facets(text: str) -> dict[str, str]:
    """Parse + validate the model's JSON, coercing to the known facet keys."""
    data = json.loads(text)
    return {k: str(data.get(k, "")).strip() for k in FACET_KEYS}


if __name__ == "__main__":
    extract(limit=config.DEFAULT_CATALOG_LIMIT)
