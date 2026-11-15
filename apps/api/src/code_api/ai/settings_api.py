"""Studio's AI routes (M5.1 spec, M5G.7), operators only. Every write answers the page's whole
state, so a save needs no second read."""

import re
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
from django.conf import settings
from django.db.models import Count, Q, Sum
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router, Status

from code_api.accounts.access import studio
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.ai import chatgpt, gateway, secrets
from code_api.ai.models import AICall, Connection, SiteSetting
from code_api.ai.resolve import (
    CHATGPT_PREFIX,
    ENV_NAME,
    Refused,
    Route,
    env_route,
    resolve,
    route_for,
)
from code_api.ai.schemas import (
    AISettingsOut,
    CallOut,
    ConnectionChangeIn,
    ConnectionIn,
    ConnectionOut,
    PersonUsageOut,
    SignInOut,
    SignInStateOut,
    SiteIn,
    SiteOut,
    SiteUsageOut,
    UsageOut,
)
from code_api.ai.sites import SITES, site
from code_api.content.schemas import Message

router = Router(tags=["studio"], auth=studio(Role.OPERATOR))

PROVIDER_MODEL = re.compile(r"^[a-z0-9_-]+/.+$")
TEST_TIMEOUT = 20
TEST_ASK = [{"role": "user", "content": "say ok"}]


def _shown_key(last4: str) -> str:
    return f"set ····{last4}"


def _status(connection: Connection) -> str:
    if connection.kind == "chatgpt" and connection.ran_out:
        return "ran out"
    return connection.test_outcome or "untested"


def _connection_out(connection: Connection) -> ConnectionOut:
    return ConnectionOut(
        id=connection.pk,
        name=connection.name,
        kind=connection.kind,  # type: ignore[arg-type]
        endpoint=connection.endpoint,
        key=_shown_key(connection.key_last4) if connection.key_sealed is not None else None,
        status=_status(connection),
        tested_at=connection.tested_at,
        models=list(connection.models_listed),
        locked=False,
    )


def _env_out() -> ConnectionOut | None:
    route = env_route()
    if route is None:
        return None
    key = None if route.api_key is None else _shown_key(route.api_key.reveal()[-4:])
    return ConnectionOut(
        id=0,
        name=ENV_NAME,
        kind="env",
        endpoint=route.api_base or "",
        key=key,
        status="set in .env",
        tested_at=None,
        models=[route.model],
        locked=True,
    )


def _site_out(key: str, rows: dict[str, SiteSetting], env_locked: bool) -> SiteOut:
    declared = site(key)
    row = rows.get(key)
    routed = resolve(key)
    locked = key == "default" and env_locked
    model = row.model if row is not None else ""
    if locked and isinstance(routed, Route):
        model = routed.model
    return SiteOut(
        key=key,
        label=declared.label,
        who=declared.who,
        refused=declared.refused,
        wired=declared.wired,
        same_as_default=key != "default" and (row is None or row.same_as_default),
        connection=None if row is None else row.connection_id,
        model=model,
        cap=None if row is None else row.cap,
        default_cap=declared.default_cap,
        temperature=None if row is None else row.temperature,
        reasoning_effort="" if row is None else row.reasoning_effort,
        timeout=None if row is None else row.timeout,
        locked=locked,
        problem=routed.sentence if isinstance(routed, Refused) else None,
    )


def state() -> AISettingsOut:
    env = _env_out()
    rows = {row.site: row for row in SiteSetting.objects.all()}
    connections = [_connection_out(c) for c in Connection.objects.order_by("pk")]
    return AISettingsOut(
        connections=([env] if env is not None else []) + connections,
        sites=[_site_out(s.key, rows, env is not None) for s in SITES],
        chatgpt_ready=settings.CODE_AI_CHATGPT_DIR is not None,
        settings_key_ready=settings.CODE_SETTINGS_KEY is not None,
    )


def _refused(status: int, refusal: Refused) -> Status[Message]:
    return Status(status, Message(detail=refusal.sentence, code=refusal.code))


def _v1(endpoint: str) -> str:
    """An OpenAI-compatible base ends in /v1, where LiteLLM's openai/ provider asks."""
    endpoint = endpoint.strip().rstrip("/")
    return endpoint if endpoint.endswith("/v1") else f"{endpoint}/v1"


def listed_models(endpoint: str) -> list[str]:
    """The model ids a self-hosted server lists at /v1/models (Ollama, vLLM)."""
    answer = httpx.get(f"{endpoint}/models", timeout=TEST_TIMEOUT)
    answer.raise_for_status()
    return sorted(str(item["id"]) for item in answer.json().get("data", []))


def _seal(key: str) -> tuple[bytes, str] | Refused:
    try:
        return secrets.seal(key), key[-4:]
    except secrets.NoSettingsKey:
        return Refused("CA0402", "Keeping a key needs CODE_SETTINGS_KEY in .env.")


@router.get("/settings", response=AISettingsOut, summary="The AI page's state")
def read_settings(request: HttpRequest) -> AISettingsOut:
    return state()


@router.post(
    "/connections", response={200: AISettingsOut, 422: Message}, summary="Add a connection"
)
def add_connection(request: HttpRequest, body: ConnectionIn) -> AISettingsOut | Status[Message]:
    row = Connection(name=body.name.strip(), kind=body.kind)
    if body.kind == "self-hosted":
        row.endpoint = _v1(body.endpoint)
    if body.key:
        sealed = _seal(body.key)
        if isinstance(sealed, Refused):
            return _refused(422, sealed)
        row.key_sealed, row.key_last4 = sealed
    row.save()
    return state()


@router.put(
    "/connections/{connection_id}",
    response={200: AISettingsOut, 422: Message},
    summary="Change a connection",
)
def change_connection(
    request: HttpRequest, connection_id: int, body: ConnectionChangeIn
) -> AISettingsOut | Status[Message]:
    row = get_object_or_404(Connection, pk=connection_id)
    if body.name is not None:
        row.name = body.name.strip()
    if body.endpoint is not None and row.kind == "self-hosted":
        row.endpoint = _v1(body.endpoint)
    if body.key:
        sealed = _seal(body.key)
        if isinstance(sealed, Refused):
            return _refused(422, sealed)
        row.key_sealed, row.key_last4 = sealed
    row.test_outcome = ""
    row.save()
    return state()


@router.delete(
    "/connections/{connection_id}", response=AISettingsOut, summary="Remove a connection"
)
def remove_connection(request: HttpRequest, connection_id: int) -> AISettingsOut:
    get_object_or_404(Connection, pk=connection_id).delete()
    return state()


@router.post(
    "/connections/{connection_id}/test", response=AISettingsOut, summary="Test a connection"
)
def test_connection(request: HttpRequest, connection_id: int) -> AISettingsOut:
    """One short call through the connection's first model, recorded (M5G.3)."""
    row = get_object_or_404(Connection, pk=connection_id)
    outcome = "ok"
    try:
        if row.kind == "self-hosted":
            row.models_listed = [f"openai/{m}" for m in listed_models(row.endpoint)]
        # A hosted provider lists no models: try the one a site chose on it (#456).
        chosen = (
            SiteSetting.objects.filter(connection=row).exclude(model="").order_by("site").first()
        )
        model = row.models_listed[0] if row.models_listed else chosen.model if chosen else ""
        if row.kind == "chatgpt" and not model:
            model = chatgpt.MODEL
        if not model:
            outcome = "no model to try: choose one for a call site"
        else:
            outcome = _try(row, model, request)
    except httpx.HTTPError as error:
        outcome = f"not answering: {error}"[:300]
    row.tested_at = timezone.now()
    row.test_outcome = outcome
    row.save()
    return state()


def _try(row: Connection, model: str, request: HttpRequest) -> str:
    by = request.user
    assert isinstance(by, User)  # `studio` let only a signed-in operator through
    route = route_for(row, model)
    if isinstance(route, Refused):
        return route.sentence
    route = replace(route, timeout=TEST_TIMEOUT)
    if route.model.startswith(CHATGPT_PREFIX):
        token = chatgpt.fresh_token()
        if isinstance(token, Refused):
            return token.sentence
    started = datetime.now(UTC)
    try:
        done = gateway.transport(route, TEST_ASK)
    except Exception as error:  # noqa: BLE001 — the provider's words
        AICall.objects.create(
            site="default",
            user=by,
            connection_name=row.name,
            model=model,
            prompt_id="connection-test",
            outcome="failed",
            code="CA0405",
        )
        return str(error)[:300] or type(error).__name__
    took = round((datetime.now(UTC) - started).total_seconds() * 1000)
    AICall.objects.create(
        site="default",
        user=by,
        connection_name=row.name,
        model=model,
        prompt_id="connection-test",
        outcome="answered",
        tokens_in=done.tokens_in,
        tokens_out=done.tokens_out,
        cost=done.cost,
        duration_ms=took,
    )
    if row.kind == "chatgpt" and not row.models_listed:
        row.models_listed = [model]
    return "ok"


@router.put(
    "/sites/{key}",
    response={200: AISettingsOut, 404: Message, 409: Message, 422: Message},
    summary="Set a call site's model, cap and call settings",
)
def set_site(request: HttpRequest, key: str, body: SiteIn) -> AISettingsOut | Status[Message]:
    try:
        site(key)
    except KeyError:
        return Status(404, Message(detail=f"{key} is not a call site.", code="CA0400"))
    if key == "default" and env_route() is not None:
        return _refused(409, Refused("CA0407", "The default model is set in .env."))
    connection = None
    if not body.same_as_default or key == "default":
        if body.connection is not None:
            connection = get_object_or_404(Connection, pk=body.connection)
        hosted = connection is not None and connection.kind == "hosted"
        if hosted and not PROVIDER_MODEL.match(body.model):
            return _refused(
                422, Refused("CA0401", f"{body.model} is not written as provider/model.")
            )
        if connection is not None and connection.kind == "chatgpt":
            refused = route_for(connection, body.model)
            if isinstance(refused, Refused):
                return _refused(422, refused)
    SiteSetting.objects.update_or_create(
        site=key,
        defaults={
            "same_as_default": body.same_as_default and key != "default",
            "connection": connection,
            "model": body.model,
            "cap": body.cap,
            "temperature": body.temperature,
            "reasoning_effort": body.reasoning_effort,
            "timeout": body.timeout,
        },
    )
    return state()


@router.post(
    "/chatgpt/sign-in", response={200: SignInOut, 422: Message}, summary="Start a ChatGPT sign-in"
)
def start_sign_in(request: HttpRequest) -> SignInOut | Status[Message]:
    started = chatgpt.start()
    if isinstance(started, Refused):
        return _refused(422, started)
    return SignInOut(user_code=started.user_code, link=started.link, expires_at=started.expires_at)


@router.get(
    "/chatgpt/sign-in",
    response={200: SignInStateOut, 409: Message},
    summary="Ask once whether the code was approved",
)
def poll_sign_in(request: HttpRequest) -> SignInStateOut | Status[Message]:
    polled = chatgpt.poll()
    if isinstance(polled, Refused):
        return _refused(409, polled)
    return SignInStateOut(state=polled)


RANGES = {"today": 1, "week": 7, "month": 30}


@router.get("/usage", response=UsageOut, summary="What the call sites used")
def usage(request: HttpRequest, range: str = "month") -> UsageOut:  # noqa: A002
    days = RANGES.get(range, 30)
    since = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(
        days=days - 1
    )
    calls = AICall.objects.filter(at__gte=since)
    totals = calls.aggregate(
        tokens_in=Sum("tokens_in"), tokens_out=Sum("tokens_out"), cost=Sum("cost")
    )
    cost: Decimal | None = totals["cost"]
    by_site = [
        SiteUsageOut(
            site=row["site"],
            label=site(row["site"]).label if row["site"] in {s.key for s in SITES} else row["site"],
            calls=row["n"],
            cost=None if row["cost"] is None else f"{row['cost']:.2f}",
            priced="billed" if row["cost"] is not None else "plan" if row["plan"] else "local",
        )
        for row in calls.values("site")
        .annotate(
            n=Count("id"),
            cost=Sum("cost"),
            plan=Count("id", filter=Q(model__startswith="chatgpt/")),
        )
        .order_by("-n")
    ]
    by_person = [
        PersonUsageOut(
            name="learners, together" if row["user__email"] is None else row["user__email"],
            calls=row["n"],
        )
        for row in calls.values("user__email").annotate(n=Count("id")).order_by("-n")
    ]
    recent = [
        CallOut(
            at=call.at,
            site=call.site,
            who="a learner" if call.user is None else call.user.email,
            model=call.model,
            tokens=call.tokens_in + call.tokens_out,
            duration_ms=call.duration_ms,
            outcome=call.outcome,
            code=call.code,
        )
        for call in calls.select_related("user").order_by("-at", "-id")[:20]
    ]
    return UsageOut(
        range=range if range in RANGES else "month",  # type: ignore[arg-type]
        calls=calls.count(),
        tokens=(totals["tokens_in"] or 0) + (totals["tokens_out"] or 0),
        cost=None if cost is None else f"{cost:.2f}",
        plan_calls=calls.filter(model__startswith="chatgpt/").count(),
        refused=calls.exclude(outcome="answered").count(),
        by_site=by_site,
        by_person=by_person,
        recent=recent,
    )
