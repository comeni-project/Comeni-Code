"""The judge receives one restricted, versioned request and must return exact rubric parts."""

import json

import pytest

from code_api.ai.evaluation import RUBRICS, EvaluationAnswer, checked, messages


@pytest.mark.parametrize("kind", ["block", "resource", "figure"])
def test_rubric_parts_are_closed_and_versioned(kind: str) -> None:
    rubric = RUBRICS[kind]
    answer = EvaluationAnswer.model_validate(
        {
            "overall": 4,
            "parts": {
                name: {"score": 4, "reason": "Evidence supports this."} for name, _ in rubric.parts
            },
        }
    )
    assert checked(answer, rubric)["version"] == rubric.version
    with pytest.raises(ValueError, match="different set"):
        checked(EvaluationAnswer(overall=4, parts={}), rubric)


def test_judge_messages_contain_only_the_candidate_public_sources_and_rubric() -> None:
    built = messages(
        rubric=RUBRICS["block"],
        title="Gene expression",
        claim="Expression measures RNA abundance.",
        level="introductory",
        candidate={"kind": "text", "markdown": "A transcript is copied from DNA."},
        public_sources=[
            {"title": "Public paper", "url": "https://example.org/paper", "licence": "CC BY"}
        ],
    )
    assert len(built) == 2
    content = json.loads(built[1]["content"])
    assert content["node"]["claim"] == "Expression measures RNA abundance."
    assert content["public_sources"][0]["title"] == "Public paper"
    assert "instruction" not in content and "conversation" not in content
    assert "PRIVATE EXCERPT" not in built[1]["content"]
