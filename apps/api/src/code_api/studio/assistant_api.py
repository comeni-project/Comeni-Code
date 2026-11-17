"""Author-only S15 chat routes; each proposed edit remains an ordinary draft proposal."""

from collections.abc import Callable
from typing import Any
from uuid import UUID

from django.http import HttpRequest
from ninja import Router, Status

from code_api.accounts.access import studio
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.studio import assistant_chat
from code_api.studio.ai_schemas import (
    AssistantFailure,
    AssistantSessionCreateIn,
    AssistantSessionListOut,
    AssistantSessionOut,
    AssistantTurnIn,
)

router = Router(tags=["studio"], auth=studio(Role.AUTHOR))
ERRORS = {404: AssistantFailure, 409: AssistantFailure, 422: AssistantFailure}


def handled(action: Callable[[], Any]) -> Any:
    try:
        return action()
    except assistant_chat.AssistantError as error:
        return Status(error.status, AssistantFailure(code=error.code, detail=error.detail))


@router.get("/sessions", response=list[AssistantSessionListOut])
def sessions(request: HttpRequest) -> list[AssistantSessionListOut]:
    assert isinstance(request.user, User)
    return assistant_chat.list_sessions(by=request.user)


@router.post("/sessions", response={200: AssistantSessionOut, **ERRORS})
def create_session(request: HttpRequest, body: AssistantSessionCreateIn) -> Any:
    user = request.user
    assert isinstance(user, User)
    return handled(lambda: assistant_chat.create_session(body.draft_id, by=user))


@router.get("/sessions/{identity}", response={200: AssistantSessionOut, 404: AssistantFailure})
def read_session(request: HttpRequest, identity: UUID) -> Any:
    assert isinstance(request.user, User)
    answer = assistant_chat.get_session(identity, by=request.user)
    return (
        Status(404, AssistantFailure(code="CA0201", detail="No assistant session has that id."))
        if answer is None
        else answer
    )


@router.post("/sessions/{identity}/turns", response={200: AssistantSessionOut, **ERRORS})
def send_turn(request: HttpRequest, identity: UUID, body: AssistantTurnIn) -> Any:
    user = request.user
    assert isinstance(user, User)
    return handled(lambda: assistant_chat.send_turn(identity, body.request_id, body.text, by=user))
