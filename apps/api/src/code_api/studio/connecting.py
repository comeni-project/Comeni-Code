"""Snapshot-bound connecting text; the weaver and node bodies stay deterministic."""

import hashlib
import json
from importlib.resources import files
from typing import Any

from django.db import transaction
from django.utils import timezone
from pydantic import BaseModel, ConfigDict, Field

from code_api.ai import gateway
from code_api.ai.resolve import Refused
from code_api.content import reads
from code_api.studio.models import ConnectingText, RouteBundle

MAX_STOPS = 40


class TextReply(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str = Field(max_length=240)
    text: str = Field(min_length=1, max_length=1000)


class BundleReply(BaseModel):
    model_config = ConfigDict(extra="forbid")
    texts: list[TextReply] = Field(max_length=80)


def snapshot(goals: list[str], known: list[str]) -> dict[str, Any]:
    route = reads.route(sorted(set(goals)), sorted(set(known)))
    return {
        "goals": sorted(route.goals),
        "known": sorted(route.known),
        "stops": [
            {"id": stop.id, "title": stop.title, "claim": stop.claim} for stop in route.stops
        ],
    }


def digest(value: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def current(bundle: RouteBundle) -> bool:
    try:
        return (
            digest(snapshot(bundle.snapshot["goals"], bundle.snapshot["known"]))
            == bundle.fingerprint
        )
    except ValueError, LookupError:
        return False


def contexts(value: dict[str, Any]) -> list[dict[str, Any]]:
    stops = value["stops"]
    goals = [stop for stop in stops if stop["id"] in value["goals"]]
    items = [{"key": "introduction", "kind": "introduction", "claims": stops, "goals": goals}]
    for at, stop in enumerate(stops):
        items.append({"key": f"why/{stop['id']}", "kind": "why", "claims": [stop], "goals": goals})
        if at:
            previous = stops[at - 1]
            items.append(
                {
                    "key": f"bridge/{previous['id']}/{stop['id']}",
                    "kind": "bridge",
                    "claims": [previous, stop],
                    "goals": goals,
                }
            )
    return items


def enqueue(identity: str) -> None:
    from code_api.studio.tasks import connect_route

    connect_route.delay(identity)


def _send(identity: str) -> None:
    try:
        enqueue(identity)
    except Exception:  # noqa: BLE001 — broker failures leave routes usable without optional text
        RouteBundle.objects.filter(public_id=identity, state="queued").update(
            state="failed", code="CA0602"
        )


@transaction.atomic
def request(goals: list[str], known: list[str]) -> RouteBundle:
    value = snapshot(goals, known)
    bundle, made = RouteBundle.objects.get_or_create(
        fingerprint=digest(value), defaults={"snapshot": value}
    )
    if made:
        if len(value["stops"]) > MAX_STOPS or not value["stops"]:
            bundle.state = "refused"
            bundle.code = "CA0602"
            bundle.save(update_fields=["state", "code"])
        else:
            ConnectingText.objects.bulk_create(
                [
                    ConnectingText(bundle=bundle, key=item["key"], kind=item["kind"], context=item)
                    for item in contexts(value)
                ]
            )
            transaction.on_commit(lambda: _send(str(bundle.public_id)))
    return bundle


def generate(identity: str) -> None:
    with transaction.atomic():
        bundle = (
            RouteBundle.objects.select_for_update()
            .filter(public_id=identity, state="queued")
            .first()
        )
        if bundle is None:
            return
        bundle.state, bundle.started_at = "running", timezone.now()
        bundle.save(update_fields=["state", "started_at"])
    prompt = files("code_api.ai.prompts").joinpath("connecting-text.v1.txt").read_text()
    result = gateway.call(
        "connecting-text",
        [
            {"role": "system", "content": prompt},
            {"role": "user", "content": json.dumps([item.context for item in bundle.texts.all()])},
        ],
        by=None,
        prompt_id="connecting-text@1",
        reply=BundleReply,
    )
    if isinstance(result, Refused) or not isinstance(result.value, BundleReply):
        bundle.state = "refused"
        bundle.code = result.code if isinstance(result, Refused) else "CA0602"
        bundle.save(update_fields=["state", "code"])
        return
    values = {item.key: item.text.strip() for item in result.value.texts}
    expected = set(bundle.texts.values_list("key", flat=True))
    if (
        set(values) != expected
        or len(values) != len(result.value.texts)
        or any(not text for text in values.values())
    ):
        bundle.state, bundle.code = "refused", "CA0602"
        bundle.save(update_fields=["state", "code"])
        return
    with transaction.atomic():
        for item in bundle.texts.all():
            item.text = values[item.key]
            item.state = "ready"
            item.flags = ["Contains an external link"] if "http" in item.text.lower() else []
            item.save(update_fields=["text", "state", "flags"])
        bundle.state, bundle.call_id = "ready", result.call_id
        bundle.save(update_fields=["state", "call"])
