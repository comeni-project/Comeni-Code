"""Bounded outline proposals and human mapping into Requests, never directly into content."""

import json
from importlib.resources import files
from typing import Any, Literal
from urllib.parse import urlparse
from uuid import UUID

from django.db import transaction
from django.utils import timezone
from pydantic import BaseModel, ConfigDict, Field

from code_api.accounts.models import User
from code_api.ai import gateway
from code_api.ai.evaluation import PartScore
from code_api.ai.resolve import Refused
from code_api.content.models import Node, Region
from code_api.studio.implementing import actor
from code_api.studio.models import ContentRequest, SkeletonImport
from code_api.studio.requests import RequestError
from code_schema import Level

SOURCES = {
    "college-board": ("apcentral.collegeboard.org",),
    "openstax": ("openstax.org",),
    "galaxy-training": ("training.galaxyproject.org",),
    "carpentries": (
        "carpentries.org",
        "swcarpentry.github.io",
        "datacarpentry.github.io",
        "librarycarpentry.org",
    ),
}


class NeedProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target: str = Field(min_length=1, max_length=200)
    reason: str = Field(min_length=1, max_length=1000)


class StubProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)
    title: str = Field(min_length=1, max_length=240)
    claim: str = Field(min_length=1, max_length=1000)
    region: str = Field(min_length=1, max_length=100)
    level: Level
    needs: list[NeedProposal] = Field(default_factory=list, max_length=4)


class SkeletonReply(BaseModel):
    model_config = ConfigDict(extra="forbid")
    stubs: list[StubProposal] = Field(min_length=1, max_length=20)


class StubScore(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: str = Field(max_length=240)
    score: int = Field(ge=1, le=5)
    parts: dict[str, PartScore]
    reason: str = Field(min_length=1, max_length=1000)


class SkeletonScores(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scores: list[StubScore] = Field(max_length=100)


class StubMapping(BaseModel):
    action: Literal["new", "existing", "merge"]
    target: str = Field(default="", max_length=100)


def enqueue(identity: str) -> None:
    from code_api.studio.tasks import draft_skeleton

    draft_skeleton.delay(identity)


def _send(identity: str) -> None:
    try:
        enqueue(identity)
    except Exception:  # noqa: BLE001 — retain the private import when the broker is down
        SkeletonImport.objects.filter(public_id=identity, state="queued").update(
            state="failed", code="CA0603"
        )


@transaction.atomic
def create(
    *, by: User, kind: str, url: str, version: str, licence: str, outline: str, rights: bool
) -> SkeletonImport:
    user = actor(by)
    parsed = urlparse(url)
    if (
        kind not in SOURCES
        or parsed.scheme != "https"
        or parsed.hostname not in SOURCES[kind]
        or parsed.username
        or parsed.password
        or not rights
    ):
        raise RequestError("Use an allowed outline source and confirm permission to use it.")
    if not version.strip() or len(version) > 240 or not licence.strip() or len(licence) > 240:
        raise RequestError("Record the source version and licence (at most 240 characters each).")
    if not outline.strip() or len(outline) > 16000:
        raise RequestError("Paste an outline of 1–16,000 characters.")
    context = {
        "nodes": {
            node.id: {"title": node.title, "claim": node.claim[:600]}
            for node in Node.objects.order_by("id")[:100]
        },
        "regions": list(Region.objects.order_by("position").values_list("id", flat=True)),
    }
    made = SkeletonImport.objects.create(
        owner=user,
        source_kind=kind,
        source_url=url,
        source_version=version.strip(),
        licence=licence.strip(),
        outline=outline.strip(),
        candidates=context,
    )
    transaction.on_commit(lambda: _send(str(made.public_id)))
    return made


def validate(reply: SkeletonReply, context: dict[str, Any]) -> None:
    ids = {stub.id for stub in reply.stubs}
    if len(ids) != len(reply.stubs):
        raise RequestError("The proposal repeats a stub id.")
    edges: dict[str, list[str]] = {}
    for stub in reply.stubs:
        if (
            stub.region not in context["regions"]
            or not stub.title.strip()
            or not stub.claim.strip()
        ):
            raise RequestError("A stub needs a registered region, title and claim.")
        targets = [need.target for need in stub.needs]
        if len(set(targets)) != len(targets) or any(not need.reason.strip() for need in stub.needs):
            raise RequestError("Needs must be distinct and have reasons.")
        for target in targets:
            if target.startswith("stub/") and target[5:] in ids and target[5:] != stub.id:
                continue
            if target.startswith("node/") and target[5:] in context["nodes"]:
                continue
            raise RequestError("A proposed need names an unknown or self target.")
        edges[stub.id] = [target[5:] for target in targets if target.startswith("stub/")]
    visited: set[str] = set()

    def visit(node: str, stack: set[str]) -> None:
        if node in stack:
            raise RequestError("The proposed needs contain a cycle.")
        if node in visited:
            return
        for target in edges[node]:
            visit(target, stack | {node})
        visited.add(node)

    for identity in ids:
        visit(identity, set())


def score_keys(reply: SkeletonReply) -> set[str]:
    return {f"stub/{stub.id}" for stub in reply.stubs} | {
        f"need/{stub.id}/{need.target}" for stub in reply.stubs for need in stub.needs
    }


def generate(identity: str) -> None:
    with transaction.atomic():
        made = (
            SkeletonImport.objects.select_for_update()
            .filter(public_id=identity, state="queued")
            .first()
        )
        if made is None:
            return
        made.state, made.started_at = "running", timezone.now()
        made.save(update_fields=["state", "started_at"])
    prompts = files("code_api.ai.prompts")
    draft_prompt = prompts.joinpath("skeleton-drafting.v1.txt").read_text()
    judge_prompt = prompts.joinpath("skeleton-evaluation.v1.txt").read_text()
    context = {
        "source": {"url": made.source_url, "version": made.source_version, "licence": made.licence},
        "outline": made.outline,
        "graph": made.candidates,
    }
    previous: SkeletonReply | None = None
    scores: list[dict[str, Any]] = []
    calls: list[int] = []
    code = ""
    for attempt in range(2):
        result = gateway.call(
            "skeleton-drafting",
            [
                {"role": "system", "content": draft_prompt},
                {"role": "user", "content": json.dumps({**context, "feedback": scores})},
            ],
            by=made.owner,
            prompt_id="skeleton-drafting@1",
            reply=SkeletonReply,
        )
        if isinstance(result, Refused) or not isinstance(result.value, SkeletonReply):
            code = result.code if isinstance(result, Refused) else "CA0603"
            break
        calls.append(result.call_id)
        try:
            validate(result.value, made.candidates)
        except RequestError:
            code = "CA0603"
            break
        proposed = result.value
        judge = gateway.call(
            "block-evaluation",
            [
                {"role": "system", "content": judge_prompt},
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            **context,
                            "proposal": proposed.model_dump(mode="json"),
                            "expected_keys": sorted(score_keys(proposed)),
                        }
                    ),
                },
            ],
            by=made.owner,
            prompt_id="skeleton-evaluation@1",
            reply=SkeletonScores,
        )
        previous = proposed
        scores = []
        if isinstance(judge, Refused) or not isinstance(judge.value, SkeletonScores):
            code = judge.code if isinstance(judge, Refused) else "CA0603"
            break
        calls.append(judge.call_id)
        keys = [score.key for score in judge.value.scores]
        if len(set(keys)) != len(keys) or set(keys) != score_keys(proposed):
            code = "CA0603"
            break
        if any(
            set(score.parts)
            != (
                {"accuracy", "scope", "level"}
                if score.key.startswith("stub/")
                else {"necessity", "reason"}
            )
            for score in judge.value.scores
        ):
            code = "CA0603"
            break
        scores = [{**score.model_dump(), "rubric": "skeleton@1"} for score in judge.value.scores]
        if all(score["score"] >= 4 for score in scores) or attempt == 1:
            break
    made.result = {} if previous is None else previous.model_dump(mode="json")
    made.scores, made.calls, made.code = scores, calls, code
    made.state = "ready" if previous is not None else "refused"
    made.save(update_fields=["result", "scores", "calls", "code", "state"])


@transaction.atomic
def send(
    identity: UUID, version: int, mappings: dict[str, StubMapping], *, by: User, note: str
) -> SkeletonImport:
    user = actor(by)
    made = SkeletonImport.objects.select_for_update().filter(public_id=identity).first()
    if made is None or made.state != "ready" or made.version != version:
        raise RequestError("This outline changed or is not ready; reload first.")
    if not note.strip() or len(note) > 4000:
        raise RequestError("Record a review note before sending to Requests.")
    reply = SkeletonReply.model_validate(made.result)
    stubs = {stub.id: stub for stub in reply.stubs}
    if not mappings or set(mappings) - set(stubs):
        raise RequestError("Choose existing proposed stubs.")
    combined = {**made.mappings, **{key: value.model_dump() for key, value in mappings.items()}}
    for key, mapping in mappings.items():
        if key in made.sent:
            if made.mappings.get(key) != mapping.model_dump():
                raise RequestError("A sent stub cannot be remapped.")
            continue
        if mapping.action != "new" and not Node.objects.filter(id=mapping.target).exists():
            raise RequestError("An existing/merge mapping must name a current indexed node.")
        if mapping.action == "new":
            for need in stubs[key].needs:
                if need.target.startswith("node/"):
                    if not Node.objects.filter(id=need.target[5:]).exists():
                        raise RequestError("A prerequisite left the index; remap it.")
                else:
                    target = need.target[5:]
                    mapped = combined.get(target)
                    if mapped is None or (
                        mapped["action"] == "new"
                        and target not in mappings
                        and target not in made.sent
                    ):
                        raise RequestError(
                            "Select each new prerequisite or map it to an existing node."
                        )
                    if (
                        mapped["action"] != "new"
                        and not Node.objects.filter(id=mapped["target"]).exists()
                    ):
                        raise RequestError("A mapped prerequisite left the index; remap it.")
    for key, mapping in mappings.items():
        if key in made.sent:
            continue
        if mapping.action == "new":
            stub = stubs[key]
            item = ContentRequest.objects.create(
                title=stub.title,
                description=stub.claim,
                created_by=user,
                proposal={
                    "stub": stub.model_dump(mode="json"),
                    "source": {
                        "url": made.source_url,
                        "version": made.source_version,
                        "licence": made.licence,
                    },
                    "scores": made.scores,
                    "mappings": combined,
                    "review_note": note.strip(),
                    "skeleton": str(made.public_id),
                },
            )
            made.sent[key] = str(item.public_id)
    made.mappings = combined
    made.version += 1
    made.save(update_fields=["sent", "mappings", "version"])
    return made
