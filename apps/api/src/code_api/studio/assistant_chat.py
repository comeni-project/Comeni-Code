"""Private, draft-scoped author conversations that can only queue normal block proposals."""

import json
from importlib.resources import files
from typing import Any
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from code_api.accounts.models import User
from code_api.ai import gateway
from code_api.ai.resolve import Refused
from code_api.studio import ai_drafting, drafts
from code_api.studio.ai_edits import payload
from code_api.studio.ai_schemas import (
    AssistantActionOut,
    AssistantReply,
    AssistantSessionListOut,
    AssistantSessionOut,
    AssistantTurnOut,
    CreateProposalIn,
    DraftingError,
)
from code_api.studio.models import (
    AssistantAction,
    AssistantSession,
    AssistantTurn,
    Draft,
    Revision,
)
from code_schema import Node

PROMPT_ID = "author-assistant@1"
MAX_TURNS = 20
RECENT_TURNS = 11
MAX_BLOCKS = 40


class AssistantError(Exception):
    def __init__(self, code: str, detail: str, *, status: int = 409) -> None:
        self.code = code
        self.detail = detail
        self.status = status
        super().__init__(detail)


def _node(draft: Draft, revision: Revision) -> Node:
    node, _ = drafts.node_of(draft, revision)
    if node is None:
        raise AssistantError("CA0502", "This draft no longer validates.")
    return node


def _context(node: Node, revision: int) -> tuple[dict[str, Any], dict[str, str]]:
    blocks: list[dict[str, str]] = []
    allowed: dict[str, str] = {}
    for at in range(min(len(node.blocks), MAX_BLOCKS)):
        target = f"block/{at}"
        try:
            current = payload(node, target)
        except DraftingError:
            continue
        kind = str(current.get("kind", "block"))
        summary = json.dumps(current, ensure_ascii=False, sort_keys=True)[:600]
        blocks.append({"target": target, "kind": kind, "content": summary})
        allowed[target] = kind
    return (
        {
            "draft_revision": revision,
            "node": {"id": node.id, "title": node.title, "claim": node.claim, "level": node.level},
            "blocks": blocks,
        },
        allowed,
    )


def _messages(
    session: AssistantSession,
    current_text: str,
    context: dict[str, Any],
) -> list[dict[str, str]]:
    system = (
        files("code_api.ai.prompts").joinpath("author-assistant.v1.txt").read_text(encoding="utf-8")
    )
    messages = [{"role": "system", "content": system}]
    prior = list(session.turns.exclude(state="running").order_by("-number")[:RECENT_TURNS])
    for turn in reversed(prior):
        messages.append({"role": "user", "content": turn.user_text})
        assistant_text = turn.answer
        action_text = list(turn.actions.order_by("number").values_list("target", "instruction"))
        if action_text:
            assistant_text += "\nProposed actions: " + "; ".join(
                f"{target}: {instruction}" for target, instruction in action_text
            )
        messages.append({"role": "assistant", "content": assistant_text})
    messages.append(
        {
            "role": "user",
            "content": json.dumps(
                {"draft_context": context, "request": current_text}, ensure_ascii=False
            ),
        }
    )
    return messages


def _actions(turn: AssistantTurn) -> list[AssistantActionOut]:
    return [
        AssistantActionOut(
            number=action.number,
            target=action.target,
            instruction=action.instruction,
            proposal_id=None if action.proposal is None else action.proposal.public_id,
            proposal_state=(
                action.proposal.state
                if action.proposal is not None
                else "failed"
                if action.code
                else None
            ),
            code=action.code,
            detail=action.detail,
        )
        for action in turn.actions.select_related("proposal").all()
    ]


def _turn_out(turn: AssistantTurn) -> AssistantTurnOut:
    return AssistantTurnOut(
        number=turn.number,
        request_id=turn.request_id,
        user_text=turn.user_text,
        answer=turn.answer,
        state=turn.state,  # type: ignore[arg-type]
        code=turn.code,
        created_at=turn.created_at,
        actions=_actions(turn),
    )


def _session_out(session: AssistantSession) -> AssistantSessionOut:
    latest = drafts.latest(session.draft)
    return AssistantSessionOut(
        public_id=session.public_id,
        draft_id=session.draft.public_id,
        node_id=session.draft.node_id,
        revision=latest.number,
        created_at=session.created_at,
        turns=[_turn_out(turn) for turn in session.turns.prefetch_related("actions__proposal")],
    )


def list_sessions(*, by: User) -> list[AssistantSessionListOut]:
    return [
        AssistantSessionListOut(
            public_id=session.public_id,
            draft_id=session.draft.public_id,
            node_id=session.draft.node_id,
            created_at=session.created_at,
            updated_at=session.updated_at,
            turn_count=session.turns.count(),
        )
        for session in AssistantSession.objects.filter(owner=by)
        .select_related("draft")
        .order_by("-updated_at", "-pk")[:30]
    ]


def get_session(identity: UUID, *, by: User) -> AssistantSessionOut | None:
    session = (
        AssistantSession.objects.filter(public_id=identity, owner=by)
        .select_related("draft")
        .first()
    )
    return None if session is None else _session_out(session)


def create_session(draft_id: UUID, *, by: User) -> AssistantSessionOut:
    ai_drafting._author(by)
    draft = Draft.objects.filter(public_id=draft_id).first()
    if draft is None:
        raise AssistantError("CA0201", "No draft has that id.", status=404)
    if draft.state != Draft.State.OPEN:
        raise AssistantError("CA0211", "The assistant needs an open draft.")
    latest = drafts.latest(draft)
    _node(draft, latest)
    session = AssistantSession.objects.create(draft=draft, owner=by)
    return _session_out(session)


def _reserve_turn(
    identity: UUID, request_id: UUID, text: str, *, by: User
) -> tuple[AssistantSession, AssistantTurn, dict[str, Any], dict[str, str], bool]:
    with transaction.atomic():
        session = (
            AssistantSession.objects.select_for_update()
            .select_related("draft")
            .filter(public_id=identity, owner=by)
            .first()
        )
        if session is None:
            raise AssistantError("CA0201", "No assistant session has that id.", status=404)
        existing = AssistantTurn.objects.filter(session=session, request_id=request_id).first()
        if existing is not None:
            if existing.user_text != text:
                raise AssistantError("CA0410", "That request id already names another message.")
            revision = drafts.latest(session.draft)
            node = _node(session.draft, revision)
            context, allowed = _context(node, revision.number)
            return session, existing, context, allowed, False
        if session.draft.state != Draft.State.OPEN:
            raise AssistantError("CA0211", "This draft is no longer open for editing.")
        if session.turns.filter(state="running").exists():
            raise AssistantError("CA0410", "Wait for the current assistant turn to finish.")
        number = session.turns.count() + 1
        if number > MAX_TURNS:
            raise AssistantError("CA0410", "This conversation reached its 20-turn limit.")
        revision = drafts.latest(session.draft)
        node = _node(session.draft, revision)
        context, allowed = _context(node, revision.number)
        turn = AssistantTurn.objects.create(
            session=session,
            number=number,
            request_id=request_id,
            user_text=text,
            state="running",
        )
        session.updated_at = timezone.now()
        session.save(update_fields=["updated_at"])
        return session, turn, context, allowed, True


def _safe_refusal(refusal: Refused) -> str:
    return f"I couldn't answer this turn ({refusal.code}). No proposals were created."


def send_turn(identity: UUID, request_id: UUID, text: str, *, by: User) -> AssistantSessionOut:
    ai_drafting._author(by)
    normalized = text.strip()
    if not normalized:
        raise AssistantError("CA0003", "Write a message first.", status=422)
    if len(normalized) > 4000:
        raise AssistantError("CA0410", "A message can be at most 4,000 characters.", status=422)
    session, turn, context, allowed, is_new = _reserve_turn(identity, request_id, normalized, by=by)
    if not is_new:
        return _session_out(session)
    result = gateway.call(
        "assistant",
        _messages(session, normalized, context),
        by=by,
        prompt_id=PROMPT_ID,
        reply=AssistantReply,
        draft=session.draft.public_id,
    )
    if isinstance(result, Refused) or not isinstance(result.value, AssistantReply):
        refusal = (
            result
            if isinstance(result, Refused)
            else Refused("CA0406", "The reply was not in the shape asked for.")
        )
        turn.answer = _safe_refusal(refusal)
        turn.state = "refused"
        turn.code = refusal.code
        turn.save(update_fields=["answer", "state", "code"])
        return _session_out(session)

    accepted: list[tuple[str, str]] = []
    used_targets: set[str] = set()
    for suggested in result.value.actions:
        if suggested.target not in allowed or suggested.target in used_targets:
            continue
        instruction = suggested.instruction.strip()
        if not instruction:
            continue
        used_targets.add(suggested.target)
        accepted.append((suggested.target, instruction))
    with transaction.atomic():
        turn.answer = result.value.answer.strip()
        turn.state = "ready"
        turn.save(update_fields=["answer", "state"])
        for number, (target, instruction) in enumerate(accepted, start=1):
            AssistantAction.objects.create(
                turn=turn, number=number, target=target, instruction=instruction
            )
        session.updated_at = timezone.now()
        session.save(update_fields=["updated_at"])

    for stored_action in turn.actions.all():
        try:
            proposal = ai_drafting.create(
                session.draft,
                CreateProposalIn(
                    request_id=stored_action.request_id,
                    based_on=context["draft_revision"],
                    kind="block",
                    target=stored_action.target,
                    instruction=stored_action.instruction,
                ),
                by=by,
            )
        except DraftingError as error:
            stored_action.code, stored_action.detail = error.code, error.detail
            stored_action.save(update_fields=["code", "detail"])
        except drafts.Stale as error:
            stored_action.code = "CA0203"
            stored_action.detail = (
                f"The draft moved to revision {error.latest.number}; reload first."
            )
            stored_action.save(update_fields=["code", "detail"])
        except drafts.NotOpen:
            stored_action.code = "CA0211"
            stored_action.detail = "The draft is no longer open for editing."
            stored_action.save(update_fields=["code", "detail"])
        else:
            stored_action.proposal = proposal
            stored_action.save(update_fields=["proposal"])
    session.refresh_from_db()
    return _session_out(session)
