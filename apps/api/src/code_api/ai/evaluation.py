"""Versioned, closed rubrics for Studio proposal evaluation (M5.3, T8.2)."""

import json
from dataclasses import dataclass
from importlib.resources import files
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class PartScore(BaseModel):
    model_config = ConfigDict(extra="forbid")
    score: int = Field(ge=1, le=5)
    reason: str = Field(min_length=1, max_length=1200)


class EvaluationAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    parts: dict[str, PartScore]
    overall: int = Field(ge=1, le=5)


@dataclass(frozen=True)
class Rubric:
    kind: Literal["block", "resource", "figure"]
    version: str
    parts: tuple[tuple[str, str], ...]


RUBRICS: dict[str, Rubric] = {
    "block": Rubric(
        "block",
        "block@1",
        (
            ("accuracy", "Accurate to the supplied public sources and the node claim"),
            ("clarity", "Clear at the node's stated level"),
            ("purpose", "Serves the node claim without unsupported detail"),
        ),
    ),
    "resource": Rubric(
        "resource",
        "resource@1",
        (
            ("relevance", "Relevant to the node claim"),
            ("level", "Suitable for the node's stated level"),
            ("record", "The title, provider, URL, coverage and licence are complete"),
        ),
    ),
    "figure": Rubric(
        "figure",
        "figure@1",
        (
            ("correctness", "The supplied data is internally correct"),
            ("claim", "The figure helps explain the node claim"),
            ("description", "The figure description is clear and accessible"),
        ),
    ),
}


PROMPT_ID = "block-evaluation@1"


def messages(
    *,
    rubric: Rubric,
    title: str,
    claim: str,
    level: str,
    candidate: dict[str, Any],
    public_sources: list[dict[str, str]],
) -> list[dict[str, str]]:
    prompt = (
        files("code_api.ai.prompts").joinpath("evaluate-block.v1.txt").read_text(encoding="utf-8")
    )
    context = {
        "rubric": {
            "version": rubric.version,
            "parts": [
                {"name": name, "description": description} for name, description in rubric.parts
            ],
        },
        "node": {"title": title, "claim": claim, "level": level},
        "candidate": candidate,
        "public_sources": public_sources,
        "required_reply": {
            "parts": {
                name: {"score": "integer 1–5", "reason": "string"} for name, _ in rubric.parts
            },
            "overall": "integer 1–5",
        },
        "rules": [
            "Score only the candidate and the supplied public sources.",
            "Do not infer missing evidence or reward length.",
            "Use a fresh evaluation; you have no drafting conversation.",
            "Return exactly the named parts and the required JSON shape.",
        ],
    }
    return [
        {
            "role": "system",
            "content": prompt,
        },
        {"role": "user", "content": json.dumps(context, ensure_ascii=False, allow_nan=False)},
    ]


def checked(answer: EvaluationAnswer, rubric: Rubric) -> dict[str, Any]:
    expected = {name for name, _ in rubric.parts}
    if set(answer.parts) != expected:
        raise ValueError("The judge returned a different set of rubric parts.")
    return {
        "version": rubric.version,
        "overall": answer.overall,
        "parts": {name: score.model_dump() for name, score in answer.parts.items()},
    }
