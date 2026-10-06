"""Landing's routes (M4.6 spec, M4L.5): an operator asks for a landing, reads it, closes it."""

from uuid import UUID

from django.http import HttpRequest
from ninja import Router, Schema, Status

from code_api.accounts.access import studio
from code_api.accounts.api import MemberOut
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.schemas import Message
from code_api.studio import github, landing
from code_api.studio.models import Landing
from code_api.studio.schemas import LandingEntryOut, LandingOut, ProblemOut, RefusedOut

router = Router(tags=["studio"], auth=studio(Role.OPERATOR))

_NO_LANDING = Message(detail="No landing has this id.", code="CA0310")
_OFF = Message(
    detail="Landing is not configured: the GitHub App's settings are not set.", code="CA0301"
)


class LandingIn(Schema):
    drafts: list[UUID]


def landing_out(made: Landing) -> LandingOut:
    return LandingOut(
        public_id=made.public_id,
        state=made.state,
        started_by=None if made.started_by is None else MemberOut.of(made.started_by),
        started_at=made.started_at,
        main_head=made.main_head,
        branch=made.branch,
        pull_number=made.pull_number,
        pull_url=made.pull_url,
        reason=made.reason,
        entries=[
            LandingEntryOut(
                draft=entry.draft.public_id,
                node_id=entry.draft.node_id,
                revision=entry.revision,
                live=entry.live,
                dropped_code=entry.dropped_code,
                dropped_reason=entry.dropped_reason,
            )
            for entry in made.entries.select_related("draft").order_by("draft__node_id")
        ],
    )


@router.post(
    "",
    response={202: LandingOut, 404: Message, 409: Message, 422: RefusedOut, 503: Message},
    summary="Land a batch of approved drafts",
)
def start(
    request: HttpRequest, body: LandingIn
) -> Status[LandingOut] | Status[Message] | Status[RefusedOut]:
    assert isinstance(request.user, User)
    try:
        made = landing.start(body.drafts, by=request.user)
    except landing.NotConfigured:
        return Status(503, _OFF)
    except landing.EmptyBatch:
        detail = "Pick at least one approved draft."
        return Status(422, RefusedOut(detail=detail, code="CA0304", problems=[]))
    except landing.NoSuchDraft as missing:
        detail = f"No draft has the id {missing.public_id}."
        return Status(404, Message(detail=detail, code="CA0201"))
    except landing.NotApproved as no:
        detail = f"{no.draft.node_id}'s draft is {no.draft.state}; only approved drafts land."
        return Status(409, Message(detail=detail, code="CA0302"))
    except landing.AlreadyLanding as held:
        detail = f"{held.draft.node_id} is already in landing {held.landing.public_id}."
        return Status(409, Message(detail=detail, code="CA0303"))
    except landing.BatchFails as fails:
        return Status(
            422,
            RefusedOut(
                detail="The batch does not validate in place.",
                code="CA0305",
                problems=[ProblemOut.of(problem) for problem in fails.problems],
            ),
        )
    return Status(202, landing_out(made))


@router.get("", response=list[LandingOut], summary="The landings, newest first")
def landings(request: HttpRequest) -> list[LandingOut]:
    return [landing_out(made) for made in Landing.objects.order_by("-started_at", "-id")]


@router.get("/{public_id}", response={200: LandingOut, 404: Message}, summary="A landing")
def read(request: HttpRequest, public_id: UUID) -> Status[LandingOut] | Status[Message]:
    made = Landing.objects.filter(public_id=public_id).first()
    return Status(404, _NO_LANDING) if made is None else Status(200, landing_out(made))


@router.post(
    "/{public_id}/close",
    response={200: LandingOut, 404: Message, 409: Message, 502: Message, 503: Message},
    summary="Close a failed landing",
)
def close(request: HttpRequest, public_id: UUID) -> Status[LandingOut] | Status[Message]:
    made = Landing.objects.filter(public_id=public_id).first()
    if made is None:
        return Status(404, _NO_LANDING)
    client = github.from_settings()
    if client is None:
        return Status(503, _OFF)
    try:
        return Status(200, landing_out(landing.close(made, client)))
    except landing.NotFailed as no:
        detail = f"This landing is {no.state}; only a failed landing is closed."
        return Status(409, Message(detail=detail, code="CA0309"))
    except github.GitHubError as error:
        return Status(502, Message(detail=str(error), code="CA0311"))
