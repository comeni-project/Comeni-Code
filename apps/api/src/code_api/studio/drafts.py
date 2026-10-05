"""Opening, saving and discarding drafts (M4.4 spec, M4W.1–M4W.3).

A save reads the latest revision's files into a `Node` with `code-schema`, applies a pure edit,
writes the files with the canonical writer and reads them back with the index's regions and
providers — the parse CI runs on the content repository. An error refuses the save and stores
nothing; a warning is stored with it. Each save names the revision it was based on, and a save on
a stale one is refused (optimistic concurrency, M4W.0).
"""

from collections.abc import Callable
from dataclasses import dataclass, field

from django.db import IntegrityError, transaction

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.models import IndexBuild
from code_api.content.models import Node as IndexedNode
from code_api.content.snapshot import node_from_index, providers_from_index, regions_from_index
from code_api.studio.models import Draft, Revision
from code_schema import Level, Node, Problem, parse_node_files
from code_schema.writer import write_exam_yaml, write_node_yaml

Edit = Callable[[Node], Node]


class AlreadyOpen(Exception):
    def __init__(self, draft: Draft) -> None:
        super().__init__(draft.node_id)
        self.draft = draft


class NotIndexed(Exception):
    """The index has no node with this id."""


class AlreadyANode(Exception):
    """A new node's id is one the index already has."""


class Stale(Exception):
    def __init__(self, latest: Revision) -> None:
        super().__init__(latest.number)
        self.latest = latest


@dataclass
class Refused(Exception):
    """The files the save would make have errors; nothing was stored."""

    problems: list[Problem] = field(default_factory=list)


class NotAllowed(Exception):
    """Only a contributor or an operator may do this."""


@dataclass(frozen=True)
class Saved:
    revision: Revision
    warnings: list[Problem]


def _files(node: Node) -> tuple[str, str, str]:
    return write_node_yaml(node), node.body, write_exam_yaml(node) if node.exam else ""


def _read(
    node_id: str, folder: str, node_yaml: str, body: str, exam: str
) -> tuple[Node | None, list[Problem]]:
    """The draft's files read as CI reads a node folder, against the index's registries."""
    return parse_node_files(
        node_yaml,
        body,
        exam or None,
        node_id=node_id,
        regions=set(regions_from_index()),
        providers=providers_from_index(),
        where=f"{folder}/",
    )


def latest(draft: Draft) -> Revision:
    return draft.revisions.order_by("-number").first()  # type: ignore[return-value]


def node_of(draft: Draft, revision: Revision | None = None) -> Node:
    """The node a revision holds (the latest by default). A stored revision always parses."""
    shown = revision or latest(draft)
    node, problems = _read(
        draft.node_id, draft.folder, shown.node_yaml, shown.body_md, shown.exam_yaml
    )
    assert node is not None, problems
    return node


def contributors(draft: Draft) -> list[User]:
    """Everyone who saved a revision, in the order they first saved."""
    seen: dict[int, User] = {}
    for revision in draft.revisions.order_by("number").select_related("saved_by"):
        if revision.saved_by is not None and revision.saved_by.pk not in seen:
            seen[revision.saved_by.pk] = revision.saved_by
    return list(seen.values())


def _start(node: Node, folder: str, base_digest: str, by: User, change: str) -> Draft:
    node_yaml, body, exam = _files(node)
    _, problems = _read(node.id, folder, node_yaml, body, exam)
    if any(problem.refuses for problem in problems):
        raise Refused(problems)
    try:
        with transaction.atomic():
            draft = Draft.objects.create(
                node_id=node.id, folder=folder, base_digest=base_digest, created_by=by
            )
            Revision.objects.create(
                draft=draft,
                number=1,
                node_yaml=node_yaml,
                body_md=body,
                exam_yaml=exam,
                saved_by=by,
                change=change,
            )
    except IntegrityError:
        # The partial unique constraint: another open draft of this node exists, or won a race.
        raise AlreadyOpen(Draft.objects.get(node_id=node.id, state=Draft.State.OPEN)) from None
    return draft


def _open_draft(node_id: str) -> Draft | None:
    return Draft.objects.filter(node_id=node_id, state=Draft.State.OPEN).first()


def open_existing(node_id: str, *, by: User) -> Draft:
    """A draft of an indexed node, from the index, at the latest applied build (M4W.2)."""
    if (held := _open_draft(node_id)) is not None:
        raise AlreadyOpen(held)
    node = node_from_index(node_id)
    if node is None:
        raise NotIndexed(node_id)
    folder = IndexedNode.objects.get(id=node_id).folder
    build = IndexBuild.objects.filter(outcome=IndexBuild.Outcome.APPLIED).latest("created_at")
    return _start(node, folder, build.digest, by, "opened from the index")


def open_new(
    node_id: str,
    *,
    title: str,
    claim: str,
    region: str,
    level: Level,
    minutes: int,
    by: User,
) -> Draft:
    """A draft of a node the index does not have; its folder is its region's (M4W.2)."""
    if node_from_index(node_id) is not None:
        raise AlreadyANode(node_id)
    if (held := _open_draft(node_id)) is not None:
        raise AlreadyOpen(held)
    # The format refuses an empty body, so a new node's starts as its claim: valid from revision
    # 1, and the first thing an author rewrites.
    node = Node(
        id=node_id,
        title=title,
        claim=claim,
        region=region,
        level=level,
        minutes=minutes,
        body=f"{claim}\n",
    )
    return _start(node, f"{region}/{node_id}", "", by, "opened as a new node")


def save(draft: Draft, *, based_on: int, edit: Edit, by: User, change: str) -> Saved:
    """One edit, one revision — or none, if the edit's files have errors or `based_on` is stale.

    The draft row is locked for the save, so two saves on one draft run one after the other, and
    the second sees the first's revision.
    """
    with transaction.atomic():
        locked = Draft.objects.select_for_update().get(pk=draft.pk)
        current = latest(locked)
        if current.number != based_on:
            raise Stale(current)
        edited = edit(node_of(locked, current))
        node_yaml, body, exam = _files(edited)
        _, problems = _read(locked.node_id, locked.folder, node_yaml, body, exam)
        if any(problem.refuses for problem in problems):
            raise Refused(problems)
        revision = Revision.objects.create(
            draft=locked,
            number=current.number + 1,
            node_yaml=node_yaml,
            body_md=body,
            exam_yaml=exam,
            saved_by=by,
            change=change,
        )
    return Saved(revision=revision, warnings=problems)


def discard(draft: Draft, *, by: User) -> Draft:
    """A contributor or an operator ends a draft; it and its revisions stay as history."""
    if not by.can_act_as(Role.OPERATOR) and by not in contributors(draft):
        raise NotAllowed()
    draft.state = Draft.State.DISCARDED
    draft.save(update_fields=["state"])
    return draft
