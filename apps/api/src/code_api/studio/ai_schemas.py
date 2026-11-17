"""Closed drafting input/output shapes; they grant no tool or publication authority."""

from datetime import datetime
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


class AssistantActionReply(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target: str = Field(min_length=1, max_length=200)
    instruction: str = Field(min_length=1, max_length=1000)


class AssistantReply(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: str = Field(max_length=2000)
    actions: list[AssistantActionReply] = Field(default_factory=list, max_length=3)


class FigureAssociationIn(Schema):
    model_config = ConfigDict(extra="forbid")
    proposal_id: UUID
    copy_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    resolutions: dict[str, Any] = Field(default_factory=dict)


class CreateProposalIn(Schema):
    model_config = ConfigDict(extra="forbid")
    request_id: UUID
    based_on: int = Field(ge=1)
    kind: Literal["block", "resource", "figure"]
    target: str = Field(max_length=200)
    instruction: str = Field(min_length=1, max_length=4000)
    sources: list[SourceIn] = Field(default_factory=list, max_length=6)
    candidates: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    figure_at: int | None = Field(default=None, ge=0)
    figure_question: str | None = None
    copy_text: str | None = Field(default=None, max_length=100000)
    copy_digest: str = Field(default="", max_length=64)


class AcceptProposalIn(Schema):
    based_on: int = Field(ge=1)
    resolutions: dict[str, Any] = Field(default_factory=dict)


class EvaluationPartOut(Schema):
    score: int
    reason: str


class EvaluationScoreOut(Schema):
    overall: int
    version: str
    parts: dict[str, EvaluationPartOut]


class EvaluationOut(Schema):
    number: int
    candidate: dict[str, Any]
    score_value: dict[str, Any]
    draft_call_id: int
    judge_call_id: int | None
    score: EvaluationScoreOut | None
    detail: str
    judge_model: str | None = None
    judge_settings: dict[str, Any] | None = None


class ProposalOut(Schema):
    public_id: UUID
    kind: Literal["block", "resource", "figure"]
    target: str
    base_revision: int
    state: Literal["queued", "running", "ready", "refused", "failed", "accepted", "discarded"]
    instruction: str
    current: dict[str, Any]
    raw: dict[str, Any] | None
    candidate: dict[str, Any] | None
    sources: list[dict[str, Any]]
    candidates: list[dict[str, Any]]
    conflicts: list[dict[str, Any]]
    findings: list[dict[str, Any]]
    code: str
    detail: str
    receipt: dict[str, Any] | None
    copy_digest: str
    accepted_revision: int | None
    evaluations: list[EvaluationOut]
    created_at: datetime


class AssistantSessionCreateIn(Schema):
    draft_id: UUID


class AssistantTurnIn(Schema):
    request_id: UUID
    text: str = Field(min_length=1, max_length=4000)


class AssistantActionOut(Schema):
    number: int
    target: str
    instruction: str
    proposal_id: UUID | None
    proposal_state: str | None
    code: str
    detail: str


class AssistantTurnOut(Schema):
    number: int
    request_id: UUID
    user_text: str
    answer: str
    state: Literal["running", "ready", "refused", "failed"]
    code: str
    created_at: datetime
    actions: list[AssistantActionOut]


class AssistantSessionOut(Schema):
    public_id: UUID
    draft_id: UUID
    node_id: str
    revision: int
    created_at: datetime
    turns: list[AssistantTurnOut]


class AssistantSessionListOut(Schema):
    public_id: UUID
    draft_id: UUID
    node_id: str
    created_at: datetime
    updated_at: datetime
    turn_count: int


class AssistantFailure(Schema):
    code: str
    detail: str


class DraftingFailure(Schema):
    detail: str
    code: str
    findings: list[dict[str, Any]] = Field(default_factory=list)
