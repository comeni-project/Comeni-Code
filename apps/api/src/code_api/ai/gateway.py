"""The one door to models (M5.1 spec, M5G.1). `call` resolves the site, checks its cap, calls
LiteLLM through `transport` (which tests replace), records the call without its text, and answers
a `Reply` or a `Refused`; a failure is never an exception the caller must know about."""

import json
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ValidationError

from code_api.accounts.models import User
from code_api.ai import chatgpt
from code_api.ai.models import AICall
from code_api.ai.resolve import Refused, Route, cap_of, resolve

DEFAULT_TIMEOUT = 60
# LiteLLM fills a missing key from the host (`api_key or … get_secret("OPENAI_API_KEY")`), so a
# route without one is given this placeholder: a self-hosted server ignores it, and no host key
# is ever sent anywhere (M5G.1). A ChatGPT plan answers by its token and takes none.
NO_KEY = "none"
_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.S)


@dataclass(frozen=True)
class Completion:
    text: str
    tokens_in: int
    tokens_out: int
    cost: Decimal | None


@dataclass(frozen=True)
class Reply:
    text: str
    value: BaseModel | None
    call_id: int


Transport = Callable[[Route, list[dict[str, str]]], Completion]


def litellm_transport(route: Route, messages: list[dict[str, str]]) -> Completion:
    """LiteLLM, always told the key and endpoint, so it never reads them from the host (M5G.1)."""
    import litellm

    asked: dict[str, Any] = {
        "model": route.model,
        "messages": messages,
        "api_key": (
            route.api_key.reveal()
            if route.api_key is not None
            else None
            if route.kind == "chatgpt"
            else NO_KEY
        ),
        "api_base": route.api_base,
        "timeout": route.timeout or DEFAULT_TIMEOUT,
    }
    if route.temperature is not None:
        asked["temperature"] = route.temperature
    if route.reasoning_effort:
        asked["reasoning_effort"] = route.reasoning_effort
    answer = litellm.completion(**asked)
    usage = getattr(answer, "usage", None)
    try:
        cost = litellm.completion_cost(completion_response=answer)
    except Exception:  # noqa: BLE001 — a plan or a local server has no price
        cost = None
    return Completion(
        text=answer.choices[0].message.content or "",
        tokens_in=getattr(usage, "prompt_tokens", 0) or 0,
        tokens_out=getattr(usage, "completion_tokens", 0) or 0,
        cost=Decimal(str(cost)) if cost else None,
    )


transport: Transport = litellm_transport


def _today() -> datetime:
    now = datetime.now(UTC)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _record(site: str, by: User | None, route: Route, prompt_id: str, **fields: Any) -> AICall:
    return AICall.objects.create(
        site=site,
        user=by,
        connection_name=route.connection_name,
        model=route.model,
        prompt_id=prompt_id,
        **fields,
    )


def _parsed(text: str, reply: type[BaseModel]) -> BaseModel | None:
    fenced = _FENCE.search(text)
    body = fenced.group(1) if fenced else text
    try:
        return reply.model_validate(json.loads(body))
    except ValueError, ValidationError:
        return None


def call(
    site: str,
    messages: list[dict[str, str]],
    *,
    by: User | None,
    prompt_id: str,
    reply: type[BaseModel] | None = None,
    draft: UUID | None = None,
) -> Reply | Refused:
    route = resolve(site)
    if isinstance(route, Refused):
        return route
    cap = cap_of(site)
    if cap is not None:
        used = AICall.objects.filter(site=site, outcome="answered", at__gte=_today()).count()
        if used >= cap:
            _record(site, by, route, prompt_id, outcome="capped", code="CA0404", draft=draft)
            calls = "call" if cap == 1 else "calls"
            return Refused("CA0404", f"{site} reached its cap of {cap} {calls} today.")
    if route.kind == "chatgpt" or route.model.startswith("chatgpt/"):
        # The gateway owns the plan's token, so LiteLLM never signs in inside a call (M5G.4).
        token = chatgpt.fresh_token()
        if isinstance(token, Refused):
            _record(site, by, route, prompt_id, outcome="refused", code=token.code, draft=draft)
            return token
    started = time.monotonic()
    try:
        done = transport(route, messages)
    except Exception as error:  # noqa: BLE001 — the provider's refusal, in its words
        took = round((time.monotonic() - started) * 1000)
        said = str(error)[:500] or type(error).__name__
        _record(
            site,
            by,
            route,
            prompt_id,
            outcome="failed",
            code="CA0405",
            duration_ms=took,
            draft=draft,
        )
        return Refused("CA0405", said)
    took = round((time.monotonic() - started) * 1000)
    value = None
    if reply is not None:
        value = _parsed(done.text, reply)
        if value is None:
            _record(
                site,
                by,
                route,
                prompt_id,
                outcome="refused",
                code="CA0406",
                duration_ms=took,
                tokens_in=done.tokens_in,
                tokens_out=done.tokens_out,
                cost=done.cost,
                draft=draft,
            )
            return Refused("CA0406", "The reply was not in the shape asked for.")
    record = _record(
        site,
        by,
        route,
        prompt_id,
        outcome="answered",
        duration_ms=took,
        tokens_in=done.tokens_in,
        tokens_out=done.tokens_out,
        cost=done.cost,
        draft=draft,
    )
    return Reply(done.text, value, record.pk)
