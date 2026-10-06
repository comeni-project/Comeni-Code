"""What the team sees of the index (M4.7 spec, M4F.5): the live build, the latest attempt with
its problems, and main's last-seen head. Asks GitHub nothing: the follower writes the head."""

from datetime import datetime

from django.core.cache import cache
from django.http import HttpRequest
from ninja import Router

from code_api.accounts.access import studio
from code_api.accounts.roles import Role
from code_api.content.models import IndexBuild
from code_api.studio.follow import MAIN_KEY
from code_api.studio.schemas import BuildOut, IndexOut

router = Router(tags=["studio"], auth=studio(Role.AUTHOR))


def _out(build: IndexBuild | None) -> BuildOut | None:
    if build is None:
        return None
    return BuildOut(
        commit=build.commit,
        digest=build.digest,
        outcome=build.outcome,
        node_count=build.node_count,
        created_at=build.created_at,
        problems=list(build.problems),
    )


@router.get("", response=IndexOut, summary="The index and main")
def index(request: HttpRequest) -> IndexOut:
    live = IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).order_by("-id").first()
    latest = IndexBuild.objects.order_by("-id").first()
    seen = cache.get(MAIN_KEY) or {}
    head = seen.get("head")
    checked = seen.get("checked_at")
    return IndexOut(
        live=_out(live),
        latest=_out(latest),
        main_head=head,
        checked_at=None if checked is None else datetime.fromisoformat(checked),
        behind=head is not None and (live is None or live.commit != head),
    )
