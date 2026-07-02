"""Sanity tests for the facet taxonomy and extraction prompt scaffolding."""

from bookvector.extract import _parse_facets, build_prompt
from bookvector.facets import FACET_KEYS, FACETS, get_facet


def test_facet_keys_unique_and_nonempty():
    assert len(FACET_KEYS) == len(set(FACET_KEYS))
    assert all(k and k.islower() for k in FACET_KEYS)


def test_get_facet_roundtrip():
    for f in FACETS:
        assert get_facet(f.key) is f


def test_prompt_mentions_every_facet():
    prompt = build_prompt("A Title", "An Author", "A summary.")
    for k in FACET_KEYS:
        assert k in prompt


def test_parse_facets_coerces_to_known_keys():
    parsed = _parse_facets('{"protagonist": "x", "unknown": "y"}')
    assert set(parsed) == set(FACET_KEYS)
    assert parsed["protagonist"] == "x"
    assert "unknown" not in parsed
