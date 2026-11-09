"""The 20-seed self-test (M6.7 spec, M6PR.4): params fit, cost before running, the answer
accepted, each mapped mistake caught, and answers that differ between learners."""

from dataclasses import replace
from typing import Any

import pytest
from code_problems import KITS, registry, self_test
from code_problems.self_test import SAMPLE_BYTES

PARAMS: dict[str, Any] = {"k": 3, "genome": 400, "read": 40, "coverage": 10, "errors": 0}
SAMPLE: dict[str, Any] = {
    "seed": 1,
    "params": {"k": 3, "genome": 7, "read": 5, "coverage": 2, "errors": 0},
}


def codes(found: Any) -> list[str]:
    return [f.code for f in found.findings]


def test_the_spec_example_passes_and_gives_its_sample() -> None:
    result = self_test("de-bruijn-edges", PARAMS, SAMPLE, ["duplicates"])
    assert codes(result) == []
    assert result.sample is not None and result.sample.dataset.text.startswith("3\n")


def test_params_off_the_schema() -> None:
    found = self_test("de-bruijn-edges", {**PARAMS, "k": 2}, SAMPLE, [])
    assert [(f.code, f.path) for f in found.findings] == [("CS1101", "params.k")]
    sample = {"seed": 1, "params": {**SAMPLE["params"], "read": 3}}
    assert codes(self_test("de-bruijn-edges", PARAMS, sample, [])) == ["CS1101"]


def test_cost_is_checked_before_generating(monkeypatch: pytest.MonkeyPatch) -> None:
    """Review Focus 3: a cost past the limit is refused and nothing is generated."""
    kit = KITS["de-bruijn-edges"]

    def never(*_: object) -> object:
        raise AssertionError("generated")

    monkeypatch.setitem(registry.KITS, kit.name, replace(kit, generate=never))  # type: ignore[arg-type]
    big = {"k": 12, "genome": 5000, "read": 150, "coverage": 30, "errors": 0}
    assert codes(self_test(kit.name, big, SAMPLE, [])) == ["CS1102"]


def test_an_answer_the_checker_refuses(monkeypatch: pytest.MonkeyPatch) -> None:
    kit = KITS["de-bruijn-edges"]
    from code_problems.kit import Verdict

    refusing = replace(kit, check=lambda case, given: Verdict(False, (), "no"))
    monkeypatch.setitem(registry.KITS, kit.name, refusing)
    found = self_test(kit.name, PARAMS, SAMPLE, [])
    assert codes(found)[0] == "CS1103" and "seed" in found.findings[0].message


def test_a_mapped_mistake_not_caught(monkeypatch: pytest.MonkeyPatch) -> None:
    kit = KITS["de-bruijn-edges"]
    blind = replace(kit, mistakes={**kit.mistakes, "duplicates": lambda case: case.answer})
    monkeypatch.setitem(registry.KITS, kit.name, blind)
    assert "CS1104" in codes(self_test(kit.name, PARAMS, SAMPLE, ["duplicates"]))


def test_answers_alike_between_learners() -> None:
    # k = 8: a 3-mer count saturates at 64, so every large genome would answer alike.
    fixed = {"k": 8, "genome": [400, 400], "read": 40, "coverage": 10, "errors": 0}
    sample = {"seed": 1, "params": {**fixed, "genome": [20, 20], "read": 10}}
    assert codes(self_test("count-kmers", fixed, sample, [])) == ["CS1105"]
    ranged = {**fixed, "genome": [200, 2000]}
    assert codes(self_test("count-kmers", ranged, sample, [])) == []


def test_an_unknown_kit_raises_for_the_caller() -> None:
    with pytest.raises(KeyError):
        self_test("no-such-kit", PARAMS, SAMPLE, [])


def test_extra_is_made_when_every_self_loop_is_an_edge() -> None:
    """#417: at k = 3 a long genome holds AAAA, CCCC, GGGG and TTTT; extra must still be made."""
    big = {"k": 3, "genome": 3000, "read": 100, "coverage": 5, "errors": 0}
    assert codes(self_test("de-bruijn-edges", big, SAMPLE, ["extra"])) in ([], ["CS1105"])


def test_a_kit_that_raises_is_a_finding(monkeypatch: pytest.MonkeyPatch) -> None:
    """#417: a kit's bug never escapes the self-test; it is CS1103 for that seed."""
    kit = KITS["de-bruijn-edges"]

    def broken(case: object) -> str:
        raise ValueError("a kit's bug")

    monkeypatch.setitem(registry.KITS, kit.name, replace(kit, solve=broken))
    found = self_test(kit.name, PARAMS, SAMPLE, [])
    assert codes(found)[0] == "CS1103" and "a kit's bug" in found.findings[0].message


def test_a_sample_over_two_thousand_bytes_is_cs1102() -> None:
    """M6LP.6: a sample is drawn on the page, so its cost is at most 2,000 bytes."""
    big: dict[str, Any] = {"seed": 1, "params": dict(PARAMS)}
    assert 2_000 < KITS["de-bruijn-edges"].cost(big["params"]) <= KITS["de-bruijn-edges"].max_bytes
    found = self_test("de-bruijn-edges", PARAMS, big, [])
    assert [(f.code, f.path) for f in found.findings] == [("CS1102", "sample.params")]
    assert "2,000" in found.findings[0].message


def test_the_fixtures_sample_fits() -> None:
    assert KITS["de-bruijn-edges"].cost(SAMPLE["params"]) <= SAMPLE_BYTES
