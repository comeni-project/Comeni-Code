"""Closed drafting input/output shapes; they grant no tool or publication authority."""

from typing import Any, Literal
from uuid import UUID

from ninja import Schema
from pydantic import BaseModel, ConfigDict, Field


class DraftingError(Exception):
    def __init__(
        self, code: str, detail: str, findings: list[dict[str, Any]] | None = None
    ) -> None:
        self.code, self.detail, self.findings = code, detail, findings or []
        super().__init__(detail)


class SourceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_-]+$")
    title: str = Field(min_length=1, max_length=200)
    url: str = Field(default="", max_length=2000)
    licence: str = Field(min_length=1, max_length=200)
    excerpt: str = Field(min_length=1, max_length=12000)
    public: bool = False


class DraftAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: dict[str, Any]
    source_ids: list[str] = Field(default_factory=list, max_length=20)


class CreateProposalIn(Schema):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    based_on: int = Field(ge=1)
    kind: Literal["block", "resource", "figure"]
    target: str = Field(max_length=200)
    instruction: str = Field(min_length=1, max_length=4000)
    sources: list[SourceIn] = Field(default_factory=list, max_length=6)
    candidates: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    copy_text: str | None = Field(default=None, max_length=100000)
    copy_digest: str = Field(default="", max_length=64)


class AcceptProposalIn(Schema):
    based_on: int = Field(ge=1)
    resolutions: dict[str, Any] = Field(default_factory=dict)
