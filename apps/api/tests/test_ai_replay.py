"""Three-way replay preserves corrections or asks a human about a concrete conflict."""

from code_api.studio.ai_replay import replay, resolve


def test_non_overlapping_and_identical_corrections_survive() -> None:
    merged = replay(
        "Three windows. Reads overlap.\n",
        "Two windows. Reads overlap.\n",
        "Three windows. Reads share bases.\n",
    )
    assert merged.conflicts == []
    assert merged.value == "Two windows. Reads share bases.\n"
    again = replay(
        "Three windows. Reads share bases.\n",
        merged.value,
        "Three windows. Reads share bases.\nMore context.\n",
    )
    assert again.conflicts == [] and again.value.startswith("Two windows.")
    assert replay("a", "b", "b").value == "b"


def test_overlap_requires_an_explicit_resolution() -> None:
    merged = replay(
        {"text": "three", "data": [1]}, {"text": "two", "data": [2]}, {"text": "four", "data": [3]}
    )
    assert {c["path"] for c in merged.conflicts} == {"/text", "/data"}
    assert resolve(merged, {"/text": {"choice": "human"}, "/data": {"choice": "model"}}) == {
        "text": "two",
        "data": [3],
    }


def test_ambiguous_repeated_context_does_not_guess() -> None:
    merged = replay("A x A x", "A y A x", "A x A z")
    assert merged.conflicts


def test_choosing_an_absent_base_removes_a_conflicting_new_field() -> None:
    merged = replay({}, {"new": "human"}, {"new": "model"})
    assert resolve(merged, {"/new": {"choice": "base"}}) == {}
