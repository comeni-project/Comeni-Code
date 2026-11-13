"""What the AI page reads and writes (M5.1 spec, M5G.7). A key is never in any of these: it is
`set ····7f2a`, or nothing."""

from datetime import datetime
from typing import Literal

from ninja import Schema


class ConnectionOut(Schema):
    id: int  # 0 for .env's, which is not a row
    name: str
    kind: Literal["chatgpt", "self-hosted", "hosted", "env"]
    endpoint: str
    key: str | None  # "set ····7f2a"
    status: str  # "untested", "ok", "ran out", or the last refusal's words
    tested_at: datetime | None
    models: list[str]
    locked: bool


class SiteOut(Schema):
    key: str
    label: str
    who: str
    refused: str
    wired: Literal["M5", "M7"]
    same_as_default: bool
    connection: int | None
    model: str
    cap: int | None
    default_cap: int | None
    temperature: float | None
    reasoning_effort: str
    timeout: int | None
    locked: bool
    problem: str | None  # why the site has no model, in the page's words


class AISettingsOut(Schema):
    connections: list[ConnectionOut]
    sites: list[SiteOut]
    chatgpt_ready: bool  # CODE_AI_CHATGPT_DIR is set
    settings_key_ready: bool  # CODE_SETTINGS_KEY is set


class ConnectionIn(Schema):
    name: str
    kind: Literal["self-hosted", "hosted"]
    endpoint: str = ""
    key: str | None = None


class ConnectionChangeIn(Schema):
    name: str | None = None
    endpoint: str | None = None
    key: str | None = None


class SiteIn(Schema):
    same_as_default: bool = True
    connection: int | None = None
    model: str = ""
    cap: int | None = None
    temperature: float | None = None
    reasoning_effort: str = ""
    timeout: int | None = None


class SignInOut(Schema):
    user_code: str
    link: str
    expires_at: float


class SignInStateOut(Schema):
    state: Literal["waiting", "signed-in"]


class SiteUsageOut(Schema):
    site: str
    label: str
    calls: int
    cost: str | None


class PersonUsageOut(Schema):
    name: str
    calls: int


class CallOut(Schema):
    at: datetime
    site: str
    who: str
    model: str
    tokens: int
    duration_ms: int
    outcome: str
    code: str


class UsageOut(Schema):
    range: Literal["today", "week", "month"]
    calls: int
    tokens: int
    cost: str | None
    plan_calls: int
    refused: int
    by_site: list[SiteUsageOut]
    by_person: list[PersonUsageOut]
    recent: list[CallOut]
