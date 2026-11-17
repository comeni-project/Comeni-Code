"""Private proposals: one claimed call, explicit acceptance, normal transactional draft saves."""

import hashlib
from datetime import timedelta
from typing import Any
from urllib.parse import urlsplit

import yaml
from django.db import transaction
from django.utils import timezone

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.ai import gateway
from code_api.ai.evaluation import (
    RUBRICS,
    EvaluationAnswer,
)
from code_api.ai.evaluation import (
    checked as checked_score,
)
from code_api.ai.evaluation import (
    messages as evaluation_messages,
)
from code_api.ai.models import AICall, SiteSetting
from code_api.ai.resolve import Refused
from code_api.ai.resolve import resolve as route_for
from code_api.content.models import Resource as IndexedResource
from code_api.studio import drafts
from code_api.studio.ai_context import build_messages
from code_api.studio.ai_edits import add_candidate, apply_candidate, checked, figure_text, payload
from code_api.studio.ai_replay import Replay, replay, resolve
from code_api.studio.ai_schemas import CreateProposalIn, DraftAnswer, DraftingError
from code_api.studio.edit_inputs import ResourceIn
from code_api.studio.models import Draft, DraftProposal, DraftScore, Revision
from code_schema import Node
from code_schema.edits import EditError
from code_schema.provenance import attach, digest

SITES = {"block": "page-drafting", "resource": "resource-suggestion", "figure": "figure-data"}
PROMPTS = {"block": "draft-block@1", "resource": "suggest-resource@1", "figure": "draft-figure@1"}
EVALUATION_PROMPT = "block-evaluation@1"


def text_digest(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _author(by: User) -> None:
    if not by.is_active or not by.can_act_as(Role.AUTHOR):
        raise DraftingError("CA0102", "An active author is needed for drafting.")


def _node(draft: Draft, revision: Revision) -> Node:
    node, findings = drafts.node_of(draft, revision)
    if node is None:
        raise DraftingError("CA0502", "This draft no longer validates.", _findings(findings))
    return node


def _findings(findings: Any) -> list[dict[str, Any]]:
    return [{"code": p.code, "message": p.message, "file": p.file} for p in findings]


def validate(draft: Draft, base: Revision, node: Node) -> Node:
    node_yaml, body, exam = drafts._files(node)
    again, findings = drafts._read(
        draft.node_id,
        draft.folder,
        node_yaml,
        body,
        exam,
        drafts.images_of(base),
        {f.name: f.text for f in node.figures},
        "" if node.problem is None else node.problem.text,
        node.provenance,
    )
    if again is None or again != node:
        raise DraftingError(
            "CA0502", "The proposed content does not validate or round-trip.", _findings(findings)
        )
    return again


def enqueue(identity: str) -> None:
    from code_api.studio.tasks import draft_with_ai

    draft_with_ai.delay(identity)


def _send(identity: str) -> None:
    try:
        enqueue(identity)
    except Exception:
        DraftProposal.objects.filter(public_id=identity, state="queued").update(
            state="failed",
            code="CA0505",
            detail="Drafting could not be queued. Ask again when the worker is available.",
        )


def _sources(body: CreateProposalIn) -> list[dict[str, Any]]:
    sources = [s.model_dump() for s in body.sources]
    if len({s["id"] for s in sources}) != len(sources):
        raise DraftingError("CA0501", "Each source needs its own id.")
    for source in sources:
        url = urlsplit(source["url"])
        if source["url"] and (
            url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password
        ):
            raise DraftingError(
                "CA0501", "A source link must be an HTTP(S) URL without credentials."
            )
        if any(
            (url.hostname or "") == domain or (url.hostname or "").endswith("." + domain)
            for domain in ("khanacademy.org", "khanacademy.com")
        ):
            raise DraftingError(
                "CA0501", "Khan Academy can be linked, but its material is not sent to a model."
            )
    return sources


def _candidates(
    body: CreateProposalIn, node: Node, draft: Draft, base: Revision
) -> list[dict[str, Any]]:
    given = body.candidates
    if not given:
        fields = list(ResourceIn.model_fields)
        taken = {r.url for r in node.resources}
        given = [
            {"id": f"indexed-{row['id']}", **{k: row[k] for k in fields}}
            for row in IndexedResource.objects.exclude(url__in=taken).values(
                "id", *["provider_id" if k == "provider" else k for k in fields]
            )[:30]
            for row in [{**row, "provider": row["provider_id"]}]
        ]
    captured = []
    for at, entry in enumerate(given):
        identity = str(entry.get("id", f"candidate-{at}"))
        resource = checked(ResourceIn, {k: v for k, v in entry.items() if k != "id"}).model_dump(
            mode="json"
        )
        url = urlsplit(resource["url"])
        if url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password:
            raise DraftingError("CA0501", "A candidate needs an HTTP(S) URL without credentials.")
        validate(draft, base, add_candidate(node, resource))
        captured.append({"id": identity, **resource})
    if not captured or len({c["id"] for c in captured}) != len(captured):
        raise DraftingError(
            "CA0501", "Supply distinct resource candidates, or index resources first."
        )
    return captured


def create(draft: Draft, body: CreateProposalIn, *, by: User) -> DraftProposal:
    _author(by)
    existing = DraftProposal.objects.filter(draft=draft, request_id=body.request_id).first()
    if existing is not None:
        if (
            existing.requested_by_id != by.pk
            or existing.kind != body.kind
            or existing.target != body.target
            or existing.context.get("request_hash") != digest(body.model_dump(mode="json"))
        ):
            raise DraftingError("CA0507", "This request id already names a different proposal.")
        return existing
    route = route_for(SITES[body.kind])
    if isinstance(route, Refused):
        raise DraftingError(route.code, route.sentence)
    with transaction.atomic():
        locked = Draft.objects.select_for_update().get(pk=draft.pk)
        if locked.state != Draft.State.OPEN:
            raise drafts.NotOpen(locked.public_id, locked.state)
        duplicate = DraftProposal.objects.filter(draft=locked, request_id=body.request_id).first()
        if duplicate is not None:
            return create(locked, body, by=by)
        base = drafts.latest(locked)
        if base.number != body.based_on:
            raise drafts.Stale(base)
        node = _node(locked, base)
        sources = _sources(body)
        candidates = _candidates(body, node, locked, base) if body.kind == "resource" else []
        if body.kind == "resource":
            if body.target != "resources":
                raise DraftingError("CA0500", "Resource suggestions belong to Resources.")
            current: dict[str, Any] = {}
        elif body.kind == "figure":
            if not body.target.startswith("figure/"):
                raise DraftingError("CA0500", "Choose a figure target.")
            if body.target != "figure/new":
                payload(node, body.target)
            if body.copy_text is None or body.copy_digest != text_digest(body.copy_text):
                raise DraftingError("CA0506", "The figure working copy changed before asking.")
            try:
                current = yaml.safe_load(body.copy_text)
            except yaml.YAMLError:
                raise DraftingError(
                    "CA0502", "The figure working copy is not valid YAML."
                ) from None
            if not isinstance(current, dict) or "component" not in current:
                raise DraftingError("CA0500", "Choose a figure component first.")
        else:
            if body.target.startswith("figure/"):
                raise DraftingError("CA0500", "Use the figure composer's Ask.")
            current = payload(node, body.target)
        prompt_id = PROMPTS[body.kind]
        messages = build_messages(
            prompt_id, node, body.target, body.instruction, sources, candidates, current
        )
        proposal = DraftProposal.objects.create(
            draft=locked,
            base_revision=base,
            requested_by=by,
            request_id=body.request_id,
            kind=body.kind,
            target=body.target,
            instruction=body.instruction,
            prompt_id=prompt_id,
            sources=sources,
            candidates=candidates,
            copy_digest=body.copy_digest,
            context={
                "current": current,
                "messages": messages,
                "request_hash": digest(body.model_dump(mode="json")),
                "figure_at": body.figure_at,
                "figure_question": body.figure_question,
            },
        )
        transaction.on_commit(lambda: _send(str(proposal.public_id)))
    return proposal


def _candidate_node(proposal: DraftProposal, node: Node, value: dict[str, Any]) -> Node:
    if proposal.kind == "resource":
        if set(value) != {"candidate_id"}:
            raise DraftingError("CA0501", "Select a declared candidate id.")
        candidate = next((c for c in proposal.candidates if c["id"] == value["candidate_id"]), None)
        if candidate is None:
            raise DraftingError("CA0501", "The resource was not among this request's candidates.")
        return add_candidate(node, {k: v for k, v in candidate.items() if k != "id"})
    return apply_candidate(node, proposal.target, value)


def replayed(proposal: DraftProposal, node: Node, value: dict[str, Any]) -> Replay:
    current = proposal.context["current"]
    binding = (proposal.base_revision.provenance or {}).get("items", {}).get(proposal.target)
    if proposal.kind == "resource" or not binding:
        return Replay(value, [])
    identity = binding.get(
        "baseline", binding["receipts"][-1] if len(binding["receipts"]) == 1 else None
    )
    parent = (
        DraftProposal.objects.filter(public_id=identity, state="accepted").first()
        if identity
        else None
    )
    if (
        parent is None
        or parent.raw is None
        or parent.draft.node_id != proposal.draft.node_id
        or parent.kind != proposal.kind
    ):
        return Replay(
            current,
            [
                {
                    "path": "",
                    "base": None,
                    "human": current,
                    "model": value,
                    "base_present": False,
                    "human_present": True,
                    "model_present": True,
                    "reason": "The AI baseline is unavailable or combines several origins.",
                    "code": "CA0504",
                }
            ],
        )
    return replay(parent.raw["value"], current, value)


def _fail(proposal: DraftProposal, error: DraftingError, *, state: str = "refused") -> None:
    DraftProposal.objects.filter(pk=proposal.pk, state__in=["queued", "running"]).update(
        state=state, code=error.code, detail=error.detail, findings=error.findings
    )


def _evaluate(
    proposal: DraftProposal, node: Node, candidate: dict[str, Any], *, by: User
) -> tuple[dict[str, Any] | None, int | None, str]:
    rubric = RUBRICS[proposal.kind]
    public_sources = [
        {key: source[key] for key in ("title", "url", "licence") if source.get(key)}
        for source in proposal.sources
        if source.get("public")
    ]
    if proposal.kind == "resource" and candidate.get("candidate_id"):
        found = next(
            (item for item in proposal.candidates if item["id"] == candidate["candidate_id"]), None
        )
        if found is None:
            return None, None, "The selected resource is not in this proposal."
        candidate = {key: value for key, value in found.items() if key != "id"}
        public_sources.append(
            {key: candidate[key] for key in ("title", "url", "licence") if candidate.get(key)}
        )
    messages = evaluation_messages(
        rubric=rubric,
        title=node.title,
        claim=node.claim,
        level=node.level.value,
        candidate=candidate,
        public_sources=public_sources,
    )
    reply = gateway.call(
        "block-evaluation",
        messages,
        by=by,
        prompt_id=EVALUATION_PROMPT,
        reply=EvaluationAnswer,
        draft=proposal.draft.public_id,
    )
    if isinstance(reply, Refused):
        return None, reply.call_id, reply.sentence
    assert isinstance(reply.value, EvaluationAnswer)
    try:
        return checked_score(reply.value, rubric), reply.call_id, ""
    except ValueError as error:
        return None, reply.call_id, str(error)


def _draft_again(
    proposal: DraftProposal, *, by: User, critique: str
) -> tuple[DraftAnswer | None, int | None, str]:
    import json

    messages = [dict(message) for message in proposal.context["messages"]]
    user_message = json.loads(messages[-1]["content"])
    user_message["judge_feedback"] = critique
    messages[-1]["content"] = json.dumps(user_message, ensure_ascii=False, allow_nan=False)
    reply = gateway.call(
        SITES[proposal.kind],
        messages,
        by=by,
        prompt_id=proposal.prompt_id,
        reply=DraftAnswer,
        draft=proposal.draft.public_id,
    )
    if isinstance(reply, Refused):
        return None, reply.call_id, reply.sentence
    assert isinstance(reply.value, DraftAnswer)
    return reply.value, reply.call_id, ""


def _save_score(proposal: DraftProposal, revision: Revision, target: str) -> None:
    final = next(
        (attempt for attempt in reversed(proposal.evaluations) if attempt.get("score")), None
    )
    if final is None:
        return
    call_id = final.get("judge_call_id")
    call = AICall.objects.filter(pk=call_id).first()
    if call is None:
        return
    DraftScore.objects.update_or_create(
        proposal=proposal,
        defaults={
            "draft": proposal.draft,
            "revision": revision,
            "call": call,
            "target": target,
            "content_digest": digest(final["score_value"]),
            "rubric_version": final["score"]["version"],
            "overall": final["score"]["overall"],
            "parts": final["score"]["parts"],
            "judge_model": call.model,
            "judge_settings": call.call_settings,
        },
    )


def run(identity: str) -> None:
    with transaction.atomic():
        proposal = DraftProposal.objects.select_for_update().filter(public_id=identity).first()
        if proposal is None or proposal.state != "queued":
            return
        if (
            proposal.requested_by is None
            or not proposal.requested_by.is_active
            or not proposal.requested_by.can_act_as(Role.AUTHOR)
            or proposal.draft.state != Draft.State.OPEN
        ):
            _fail(
                proposal, DraftingError("CA0507", "The requester or draft is no longer available.")
            )
            return
        route = route_for(SITES[proposal.kind])
        if isinstance(route, Refused):
            _fail(proposal, DraftingError(route.code, route.sentence))
            return
        proposal.state, proposal.started_at = "running", timezone.now()
        setting = SiteSetting.objects.filter(site="block-evaluation").first()
        rounds = 1 if setting is None else setting.max_redrafts
        proposal.deadline_at = proposal.started_at + timedelta(
            seconds=(route.timeout or gateway.DEFAULT_TIMEOUT) * (2 * rounds + 2) + 60
        )
        proposal.save(update_fields=["state", "started_at", "deadline_at"])
    try:
        node = _node(proposal.draft, proposal.base_revision)
        reply = gateway.call(
            SITES[proposal.kind],
            proposal.context["messages"],
            by=proposal.requested_by,
            prompt_id=proposal.prompt_id,
            reply=DraftAnswer,
            draft=proposal.draft.public_id,
        )
        if isinstance(reply, Refused):
            if reply.call_id is not None:
                DraftProposal.objects.filter(pk=proposal.pk).update(call_id=reply.call_id)
            _fail(proposal, DraftingError(reply.code, reply.sentence))
            return
        assert isinstance(reply.value, DraftAnswer)
        proposal.call_id = reply.call_id
        allowed = {s["id"] for s in proposal.sources}
        attempts: list[dict[str, Any]] = []
        setting = SiteSetting.objects.filter(site="block-evaluation").first()
        minimum = 3 if setting is None else setting.minimum_score
        max_redrafts = 1 if setting is None else setting.max_redrafts
        current_answer = reply.value
        current_call_id = reply.call_id
        stop_detail = ""
        for attempt_number in range(max_redrafts + 1):
            if not set(current_answer.source_ids) <= allowed:
                raise DraftingError("CA0501", "The reply cited a source outside this request.")
            value = current_answer.value
            score_value = value
            if proposal.kind == "figure":
                figure_text(value, proposal.context["current"]["component"])
                source = value.get("source")
                if (
                    source
                    and source != proposal.context["current"].get("source")
                    and source.get("url")
                    not in {s["url"] for s in proposal.sources if s.get("public")}
                ):
                    raise DraftingError("CA0501", "The figure cited an unseen source.")
                if proposal.target != "figure/new":
                    score_value = payload(_candidate_node(proposal, node, value), proposal.target)
            else:
                candidate_node = _candidate_node(proposal, node, value)
                validate(proposal.draft, proposal.base_revision, candidate_node)
                if proposal.kind == "resource":
                    resource = next(
                        (
                            item
                            for item in proposal.candidates
                            if item["id"] == value["candidate_id"]
                        ),
                        None,
                    )
                    score_value = (
                        {}
                        if resource is None
                        else {key: field for key, field in resource.items() if key != "id"}
                    )
                else:
                    score_value = payload(candidate_node, proposal.target)
            score, judge_call_id, judge_detail = _evaluate(
                proposal, node, score_value, by=proposal.requested_by
            )
            attempt_record: dict[str, Any] = {
                "number": attempt_number + 1,
                "candidate": value,
                "score_value": score_value,
                "draft_call_id": current_call_id,
                "judge_call_id": judge_call_id,
                "score": score,
                "detail": judge_detail,
            }
            if score is not None and judge_call_id is not None:
                judge_call = AICall.objects.get(pk=judge_call_id)
                attempt_record["judge_model"] = judge_call.model
                attempt_record["judge_settings"] = judge_call.call_settings
            attempts.append(attempt_record)
            proposal.call_id = current_call_id
            proposal.raw = current_answer.model_dump()
            if score is None:
                stop_detail = "The draft is ready, but judging stopped: " + judge_detail
                break
            if score["overall"] >= minimum or attempt_number >= max_redrafts:
                break
            critique = "\n".join(
                f"{name} ({part['score']}/5): {part['reason']}"
                for name, part in score["parts"].items()
            )
            next_reply, call_id, detail = _draft_again(
                proposal,
                by=proposal.requested_by,
                critique=(
                    f"Overall score {score['overall']}/5; improve these rubric parts:\n{critique}"
                ),
            )
            if next_reply is None:
                stop_detail = "The last valid draft is ready; redrafting stopped: " + detail
                break
            assert call_id is not None
            current_answer, current_call_id = next_reply, call_id
        proposal.evaluations = attempts
        merged = replayed(proposal, node, value)
        if not merged.conflicts and proposal.kind != "figure":
            validate(
                proposal.draft,
                proposal.base_revision,
                _candidate_node(proposal, node, merged.value),
            )
        with transaction.atomic():
            held = DraftProposal.objects.select_for_update().get(pk=proposal.pk)
            if held.state != "running":
                if held.call_id is None:
                    held.call_id = reply.call_id
                    held.save(update_fields=["call"])
                return
            held.call_id, held.raw = proposal.call_id, proposal.raw
            held.evaluations = attempts
            held.candidate, held.conflicts, held.state = merged.value, merged.conflicts, "ready"
            held.code = merged.conflicts[0].get("code", "CA0503") if merged.conflicts else ""
            held.detail = (
                "Resolve the human-edit conflicts before applying. " if merged.conflicts else ""
            ) + stop_detail
            held.save(
                update_fields=[
                    "call",
                    "raw",
                    "candidate",
                    "conflicts",
                    "state",
                    "code",
                    "detail",
                    "evaluations",
                ]
            )
    except DraftingError as error:
        if proposal.call_id:
            DraftProposal.objects.filter(pk=proposal.pk).update(call_id=proposal.call_id)
        _fail(proposal, error)
    except (ValueError, TypeError, KeyError, IndexError, StopIteration, EditError) as error:
        if proposal.call_id:
            DraftProposal.objects.filter(pk=proposal.pk).update(call_id=proposal.call_id)
        _fail(proposal, DraftingError("CA0502", f"The proposed edit was invalid: {error}"[:500]))


def public_receipt(proposal: DraftProposal) -> dict[str, Any]:
    assert proposal.call is not None
    sources = []
    for source in proposal.sources:
        reference = {"hash": digest(source)}
        if source.get("public"):
            reference.update({k: source[k] for k in ("title", "url", "licence") if source.get(k)})
        sources.append(reference)
    if proposal.kind == "resource" and proposal.raw is not None:
        selected = proposal.raw["value"].get("candidate_id")
        for candidate in proposal.candidates:
            if candidate["id"] == selected:
                sources.append({"hash": digest(candidate)})
    return {
        "model": proposal.call.model,
        "prompt_id": proposal.prompt_id,
        "settings": proposal.call.call_settings,
        "sources": sources,
    }


def chosen(proposal: DraftProposal, resolutions: dict[str, Any]) -> dict[str, Any]:
    if proposal.state != "ready" or proposal.call is None:
        raise DraftingError("CA0507", "This proposal is not ready to apply.")
    try:
        value = resolve(Replay(proposal.candidate, proposal.conflicts), resolutions)
    except ValueError as error:
        raise DraftingError("CA0503", str(error)) from None
    if not isinstance(value, dict):
        raise DraftingError("CA0502", "The resolved edit must have the selected item's shape.")
    return value


def accept(
    proposal: DraftProposal, *, by: User, based_on: int, resolutions: dict[str, Any]
) -> Revision:
    _author(by)
    with transaction.atomic():
        draft = Draft.objects.select_for_update().get(pk=proposal.draft_id)
        held = DraftProposal.objects.select_for_update().get(pk=proposal.pk)
        if held.state == "accepted":
            return drafts.latest(draft)
        if draft.state != Draft.State.OPEN:
            raise drafts.NotOpen(draft.public_id, draft.state)
        current = drafts.latest(draft)
        if current.number != based_on or current.pk != held.base_revision_id:
            raise drafts.Stale(current)
        if held.kind == "figure":
            raise DraftingError(
                "CA0507", "Use the composer and Save to the page to apply figure data."
            )
        value = chosen(held, resolutions)
        node = _node(draft, current)
        score_target = f"resource/{len(node.resources)}" if held.kind == "resource" else held.target

        def edit(node: Node) -> Node:
            changed = _candidate_node(held, node, value)
            target = f"resource/{len(node.resources)}" if held.kind == "resource" else held.target
            return attach(changed, target, str(held.public_id), public_receipt(held))

        saved = drafts.save(
            draft, based_on=based_on, edit=edit, by=by, change=f"kept AI proposal {held.public_id}"
        )
        held.state, held.accepted_revision, held.applied_by = "accepted", saved.revision, by
        held.save(update_fields=["state", "accepted_revision", "applied_by"])
        final = next(
            (attempt for attempt in reversed(held.evaluations) if attempt.get("score")), None
        )
        if final is not None:
            score_value = final["score_value"]
            if held.kind == "resource":
                selected = next(
                    (item for item in held.candidates if item["id"] == value.get("candidate_id")),
                    None,
                )
                score_matches = selected is not None and digest(
                    {key: field for key, field in selected.items() if key != "id"}
                ) == digest(score_value)
            else:
                score_matches = digest(value) == digest(score_value)
            if score_matches:
                _save_score(held, saved.revision, score_target)
        return saved.revision


def discard(proposal: DraftProposal) -> None:
    with transaction.atomic():
        held = DraftProposal.objects.select_for_update().get(pk=proposal.pk)
        if held.state == "accepted":
            raise DraftingError("CA0507", "An applied proposal is part of the draft's history.")
        held.state = "discarded"
        held.save(update_fields=["state"])


def expire() -> int:
    from django.db.models import Q

    now = timezone.now()
    return DraftProposal.objects.filter(
        Q(state="running", deadline_at__lt=now)
        | Q(state="queued", created_at__lt=now - timedelta(minutes=5))
    ).update(
        state="failed",
        code="CA0505",
        detail="Drafting was interrupted. Ask again to start a new proposal.",
    )


def save_figure(
    draft: Draft,
    *,
    based_on: int,
    by: User,
    edit: drafts.Edit,
    change: str,
    association: dict[str, Any],
    target: str,
    at: int | None,
    question: str | None,
) -> drafts.Saved:
    """Consume a figure receipt in the same transaction as the ordinary file save."""
    _author(by)
    with transaction.atomic():
        locked = Draft.objects.select_for_update().get(pk=draft.pk)
        held = (
            DraftProposal.objects.select_for_update()
            .filter(
                public_id=str(association.get("proposal_id", "")),
                draft=locked,
                kind="figure",
                target=target,
            )
            .first()
        )
        if held is None:
            raise DraftingError("CA0507", "This figure proposal belongs to another target.")
        if (
            drafts.latest(locked).pk != held.base_revision_id
            or based_on != held.base_revision.number
        ):
            raise drafts.Stale(drafts.latest(locked))
        if association.get("copy_digest") != held.copy_digest:
            raise DraftingError("CA0506", "The figure working copy changed before Use.")
        if target == "figure/new" and (
            held.context.get("figure_at") != at or held.context.get("figure_question") != question
        ):
            raise DraftingError("CA0507", "The new figure's placement changed.")
        value = chosen(held, association.get("resolutions", {}))
        figure_text(value, held.context["current"]["component"])
        score_target = target

        def with_receipt(node: Node) -> Node:
            nonlocal score_target
            changed = edit(node)
            if target == "figure/new":
                old = {f.stem for f in node.figures}
                added = [f.stem for f in changed.figures if f.stem not in old]
                if len(added) != 1:
                    raise DraftingError("CA0507", "Save must add exactly this figure.")
                key = f"figure/{added[0]}"
            else:
                key = target
            actual = payload(changed, key)
            score_target = key
            if actual.get("component") != held.context["current"]["component"]:
                raise DraftingError("CA0507", "The chosen figure component changed.")
            return attach(changed, key, str(held.public_id), public_receipt(held))

        saved = drafts.save(locked, based_on=based_on, by=by, edit=with_receipt, change=change)
        held.state, held.accepted_revision, held.applied_by = "accepted", saved.revision, by
        held.save(update_fields=["state", "accepted_revision", "applied_by"])
        final = next(
            (attempt for attempt in reversed(held.evaluations) if attempt.get("score")), None
        )
        if final is not None and digest(value) == digest(final["score_value"]):
            _save_score(held, saved.revision, score_target)
        return saved
