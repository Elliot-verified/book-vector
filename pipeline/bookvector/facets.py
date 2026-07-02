"""Facet taxonomy — the single source of truth for book-vector.

The extraction schema *is* the product (PLAN.md, D6/D7). Each book's plot
summary is decomposed by an LLM into these facets; each facet field is then
embedded separately so similarity can operate one narrative axis at a time
("similar arc, ignore setting").

Keep this list tight and the guidance concrete — extraction quality flows
straight into the vectors (the #1 risk). Normalize toward a controlled
vocabulary where possible to keep each facet space clean.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Facet:
    key: str          # stable id, used as vector namespace and JSON key
    title: str        # human label for the UI
    description: str  # what this facet captures
    guidance: str     # instruction shown to the extraction LLM


FACETS: tuple[Facet, ...] = (
    Facet(
        key="protagonist",
        title="Protagonist",
        description="Archetype and defining attributes of the central character.",
        guidance=(
            "Capture role, life-stage, and defining traits (e.g. 'aging widower', "
            "'orphaned teenage girl on the cusp of adulthood'). Describe who they "
            "are, not what happens to them."
        ),
    ),
    Facet(
        key="relationship",
        title="Central relationship",
        description="The core relational dynamic that drives the story.",
        guidance=(
            "Name the single most central bond and its nature (e.g. 'second-wind "
            "late-life romance', 'estranged siblings forced to reconcile'). One "
            "relationship only."
        ),
    ),
    Facet(
        key="arc",
        title="Character arc",
        description="The internal transformation the protagonist undergoes.",
        guidance=(
            "Describe the change from beginning to end (e.g. 'coming-of-age "
            "realization', 'fall from idealism into cynicism'). Focus on internal "
            "movement, not external events."
        ),
    ),
    Facet(
        key="setting_as_device",
        title="Setting as device",
        description="How the setting functions narratively, not merely where it is.",
        guidance=(
            "Describe the setting's narrative role (e.g. 'displacement abroad forces "
            "self-confrontation', 'closed-room isolation breeds paranoia'). Not a "
            "place name on its own."
        ),
    ),
    Facet(
        key="twist",
        title="Structural / moral turn",
        description="The pivotal structural or moral turn, spoilers included.",
        guidance=(
            "Name the key turn using the spoiler-complete summary (e.g. 'antagonist "
            "revealed as the moral center', 'narrator revealed unreliable'). Return "
            "an empty string if there is no meaningful turn."
        ),
    ),
)

FACET_KEYS: tuple[str, ...] = tuple(f.key for f in FACETS)


def get_facet(key: str) -> Facet:
    for f in FACETS:
        if f.key == key:
            return f
    raise KeyError(f"unknown facet: {key!r} (known: {', '.join(FACET_KEYS)})")
