"""Review locks text, publication locks the bundle, and catalogue reads recheck the graph."""

import json
import re
from importlib.resources import files
from typing import Any
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from code_api.accounts.models import User
from code_api.accounts.roles import Role, can_act_as
from code_api.ai import gateway
from code_api.ai.resolve import Refused
from code_api.studio import connecting
from code_api.studio.models import ConnectingText, NamedTrack, RouteBundle, TextReviewEvent
from code_api.studio.requests import RequestError


def reviewer(by: User) -> User:
    user = User.objects.filter(pk=by.pk, is_active=True).first()
    if user is None or not can_act_as(user.role, Role.REVIEWER):
        raise RequestError("An active reviewer must decide connecting text.")
    return user


def flags(text: str, context: dict[str, Any]) -> list[str]:
    findings = []
    if "http" in text.lower():
        findings.append("Contains an external link")
    numbers = set(re.findall(r"\b\d+(?:\.\d+)?\b", text))
    if numbers - set(re.findall(r"\b\d+(?:\.\d+)?\b", json.dumps(context))):
        findings.append("Contains numbers absent from the permitted claims")
    if len(text.split()) < 5:
        findings.append("Very short connecting text")
    return findings


@transaction.atomic
def review(
    identity: UUID, key: str, version: int, action: str, *, by: User, text: str = "", note: str = ""
) -> ConnectingText:
    user = reviewer(by)
    bundle = RouteBundle.objects.select_for_update().filter(public_id=identity).first()
    if bundle is None or not connecting.current(bundle):
        raise RequestError("This route changed; generate a fresh bundle before reviewing.")
    if bundle.state in {"queued", "running"}:
        raise RequestError("Wait for generation before editing or approving.")
    item = bundle.texts.select_for_update().filter(key=key).first()
    if item is None or item.version != version:
        raise RequestError("This text changed; reload before reviewing.")
    if len(note) > 4000:
        raise RequestError("Keep the note within 4,000 characters.")
    if action == "edit":
        text = text.strip()
        if not text or len(text) > 1000:
            raise RequestError("Connecting text needs 1–1,000 characters.")
        item.text, item.state = text, "ready"
        item.flags = flags(text, item.context)
    elif action == "approve":
        if item.state not in {"ready", "approved"} or not item.text:
            raise RequestError("Write or generate text before approving.")
        item.flags = flags(item.text, item.context)
        if item.flags and not note.strip():
            raise RequestError("Approving flagged text needs a note.")
        item.state = "approved"
    else:
        raise RequestError("Unknown review action.")
    item.version += 1
    item.save(update_fields=["text", "state", "version", "flags"])
    TextReviewEvent.objects.create(
        text=item,
        actor=user,
        action=action,
        version=item.version,
        note=note.strip(),
        body=item.text,
    )
    # A refused model does not prevent a reviewer from writing every item by hand.
    if bundle.state != "ready":
        bundle.state = "ready"
        bundle.save(update_fields=["state"])
    return item


def rewrite(identity: UUID, key: str, version: int, *, by: User, note: str) -> ConnectingText:
    user = reviewer(by)
    with transaction.atomic():
        bundle = RouteBundle.objects.select_for_update().get(public_id=identity)
        item = bundle.texts.select_for_update().get(key=key)
        if (
            not connecting.current(bundle)
            or item.version != version
            or bundle.state in {"queued", "running"}
        ):
            raise RequestError("This route or text changed; reload first.")
        item.version += 1
        item.state = "rewriting"
        item.save(update_fields=["version", "state"])
        reserved = item.version
        TextReviewEvent.objects.create(
            text=item, actor=user, action="rewrite", version=reserved, note=note, body=item.text
        )
    prompt = files("code_api.ai.prompts").joinpath("connecting-text.v1.txt").read_text()
    result = gateway.call(
        "connecting-text",
        [
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": json.dumps({"items": [item.context], "reviewer_note": note}),
            },
        ],
        by=user,
        prompt_id="connecting-text@1",
        reply=connecting.BundleReply,
    )
    with transaction.atomic():
        RouteBundle.objects.select_for_update().get(pk=bundle.pk)
        item.refresh_from_db()
        if item.version != reserved:
            raise RequestError("A newer edit replaced this rewrite.")
        failed = (
            isinstance(result, Refused)
            or not isinstance(result.value, connecting.BundleReply)
            or len(result.value.texts) != 1
            or result.value.texts[0].key != key
        )
        if failed:
            item.state = "ready" if item.text else "pending"
            item.save(update_fields=["state"])
        else:
            assert not isinstance(result, Refused) and isinstance(
                result.value, connecting.BundleReply
            )
            item.text, item.state = result.value.texts[0].text.strip(), "ready"
            item.flags = flags(item.text, item.context)
            item.version += 1
            item.save(update_fields=["text", "state", "version", "flags"])
            TextReviewEvent.objects.create(
                text=item,
                actor=user,
                action="rewritten",
                version=item.version,
                note=note,
                body=item.text,
            )
    if failed:
        raise RequestError("The rewrite was unavailable; the previous text is preserved.")
    return item


def eligible(bundle: RouteBundle) -> bool:
    items = list(bundle.texts.all())
    expected = {item["key"] for item in connecting.contexts(bundle.snapshot)}
    return (
        bundle.state == "ready"
        and not bundle.snapshot["known"]
        and connecting.current(bundle)
        and {item.key for item in items} == expected
        and all(item.state == "approved" and item.text for item in items)
    )


@transaction.atomic
def publish(identity: UUID, name: str, *, by: User) -> NamedTrack:
    user = reviewer(by)
    bundle = RouteBundle.objects.select_for_update().filter(public_id=identity).first()
    if bundle is None or not eligible(bundle):
        raise RequestError("Review every text on a current full route before publishing.")
    name = name.strip()
    if not name or len(name) > 120:
        raise RequestError("A track name needs 1–120 characters.")
    target_key = connecting.digest({"goals": sorted(bundle.snapshot["goals"])})
    track, _ = NamedTrack.objects.update_or_create(
        target_key=target_key,
        defaults={
            "name": name,
            "bundle": bundle,
            "published_by": user,
            "published_at": timezone.now(),
        },
    )
    return track
