"""Advisory duplicate suggestions; the model cannot change the human queue state."""

import json
from importlib.resources import files
from typing import Literal

from django.db import transaction
from django.utils import timezone
from pydantic import BaseModel, ConfigDict, Field

from code_api.ai import gateway
from code_api.ai.resolve import Refused
from code_api.content.models import Node
from code_api.studio.models import ContentRequest


class GroupSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["request", "node"]
    target: str = Field(max_length=200)
    reason: str = Field(min_length=1, max_length=1000)


class GroupReply(BaseModel):
    model_config = ConfigDict(extra="forbid")
    suggestions: list[GroupSuggestion] = Field(max_length=3)


def enqueue(identity: str) -> None:
    from code_api.studio.tasks import group_request

    group_request.delay(identity)


def schedule(identity: str) -> None:
    def send() -> None:
        try:
            enqueue(identity)
        except Exception:  # noqa: BLE001 — duplicate grouping is advisory, never a queue prerequisite
            ContentRequest.objects.filter(public_id=identity, grouping_state="pending").update(
                grouping_state="unavailable"
            )

    transaction.on_commit(send)


def generate(identity: str) -> None:
    with transaction.atomic():
        source = (
            ContentRequest.objects.select_for_update()
            .filter(
                public_id=identity, grouping_state="pending", state__in=["requested", "snoozed"]
            )
            .first()
        )
        if source is None:
            return
        source.grouping_state = "running"
        source.grouping_started_at = timezone.now()
        source.save(update_fields=["grouping_state", "grouping_started_at"])
    other = {
        str(item.public_id): {"title": item.title, "description": item.description[:600]}
        for item in ContentRequest.objects.filter(
            state__in=["requested", "snoozed", "accepted", "implementing"]
        )
        .exclude(pk=source.pk)
        .order_by("-pk")[:20]
    }
    nodes = {
        node.id: {"title": node.title, "claim": node.claim[:600]}
        for node in Node.objects.order_by("id")[:100]
    }
    prompt = files("code_api.ai.prompts").joinpath("request-grouping.v1.txt").read_text()
    result = gateway.call(
        "request-grouping",
        [
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "request": {
                            "title": source.title,
                            "description": source.description[:1000],
                        },
                        "requests": other,
                        "nodes": nodes,
                    }
                ),
            },
        ],
        by=None,
        prompt_id="request-grouping@1",
        reply=GroupReply,
    )
    suggestions = []
    state = "unavailable"
    if not isinstance(result, Refused) and isinstance(result.value, GroupReply):
        used = set()
        for proposed in result.value.suggestions:
            key = (proposed.kind, proposed.target)
            if (
                proposed.target not in (other if proposed.kind == "request" else nodes)
                or key in used
            ):
                continue
            used.add(key)
            suggestions.append(
                {
                    **proposed.model_dump(),
                    "title": (other if proposed.kind == "request" else nodes)[proposed.target][
                        "title"
                    ],
                }
            )
        state = "ready"
    ContentRequest.objects.filter(
        pk=source.pk, version=source.version, state__in=["requested", "snoozed"]
    ).update(suggestions=suggestions, grouping_state=state)
