"""Opening, saving and discarding drafts (M4.4 spec, M4W.1–M4W.3).

A save reads the latest revision's files into a `Node` with `code-schema`, applies a pure edit,
writes the files with the canonical writer and reads them back with the index's regions and
providers — the parse CI runs on the content repository. An error refuses the save and stores
nothing; a warning is stored with it. Each save names the revision it was based on, and a save on
a stale one is refused (optimistic concurrency, M4W.0).
"""

from collections.abc import Callable
from dataclasses import dataclass, field

from django.db import IntegrityError, connection, transaction

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.index import INDEX_LOCK
from code_api.content.models import IndexBuild
from code_api.content.models import Node as IndexedNode
from code_api.content.snapshot import node_from_index, providers_from_index, regions_from_index
from code_api.studio.log import record
from code_api.studio.models import LIVE_STATES, Draft, DraftEvent, Revision
from code_schema import Level, Node, Problem, parse_node_files
from code_schema.graph import graph_problems
from code_schema.links import locate_links
from code_schema.node import NODE_FILE
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


class Garbled(Exception):
    """The edit's files read back as a different node: the save would not store what was sent."""


class NotOpen(Exception):
    """The draft is not open — submitted, approved or discarded — so it takes no saves (#188)."""

    def __init__(self, public_id: object, state: str) -> None:
        super().__init__(public_id)
        self.state = state


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


def node_of(draft: Draft, revision: Revision | None = None) -> tuple[Node | None, list[Problem]]:
    """The node a revision holds (the latest by default), and its problems.

    A revision parsed when it was saved, but it is read against the index's registries as they
    are now: if a rebuild dropped a region or a licence it uses, the node is None and the problems
    say why, never a 500 (#173). Such a draft is discarded, or the registry is restored.
    """
    shown = revision or latest(draft)
    return _read(draft.node_id, draft.folder, shown.node_yaml, shown.body_md, shown.exam_yaml)


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
            record(draft, DraftEvent.Kind.OPENED, by=by, revision=1)
    except IntegrityError:
        # The partial unique constraint: another live draft of this node exists, or won a race.
        held = _open_draft(node.id)
        if held is None:
            raise  # some other integrity error: not ours to word
        raise AlreadyOpen(held) from None
    return draft


def _open_draft(node_id: str) -> Draft | None:
    return Draft.objects.filter(node_id=node_id, state__in=LIVE_STATES).first()


def open_existing(node_id: str, *, by: User) -> Draft:
    """A draft of an indexed node, from the index, at the latest applied build (M4W.2)."""
    if (held := _open_draft(node_id)) is not None:
        raise AlreadyOpen(held)
    with transaction.atomic():
        # The rebuild's lock, shared: no rebuild commits while the node, its folder and the build
        # are read, so the base version is the build the node came from (#173).
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock_shared(%s)", [INDEX_LOCK])
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
        if locked.state != Draft.State.OPEN:
            raise NotOpen(locked.public_id, locked.state)
        current = latest(locked)
        if current.number != based_on:
            raise Stale(current)
        node, problems = node_of(locked, current)
        if node is None:
            raise Refused(problems)  # it no longer reads against today's registries
        edited = edit(node)
        node_yaml, body, exam = _files(edited)
        again, problems = _read(locked.node_id, locked.folder, node_yaml, body, exam)
        if any(problem.refuses for problem in problems):
            raise Refused(problems)
        if again != edited:
            # A title with a newline, a ::: line inside a callout: the files say something else
            # than the edit, so storing them would not be what was sent (#174).
            raise Garbled()
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
    with transaction.atomic():
        locked = Draft.objects.select_for_update().get(pk=draft.pk)
        if locked.state != Draft.State.OPEN:
            raise NotOpen(locked.public_id, locked.state)
        if not by.can_act_as(Role.OPERATOR) and by not in contributors(locked):
            raise NotAllowed()
        locked.state = Draft.State.DISCARDED
        locked.save(update_fields=["state"])
        record(locked, DraftEvent.Kind.DISCARDED, by=by, revision=latest(locked).number)
    return locked


def verify(draft: Draft) -> list[Problem]:
    return _checked(draft)[1]


def in_place(standing: list[Draft]) -> list[Problem]:
    """Every problem of `standing` together (M4W.5, M4L.3): `code-schema`'s graph rules, as
    `validate` runs them, with each draft's latest revision in place of its indexed node, against
    every other node in the index, plus each draft's own problems. A draft that no longer reads
    adds its problems and stays out of the graph."""
    nodes: dict[str, Node] = {}
    folders: dict[str, str] = {}
    problems: list[Problem] = []
    with transaction.atomic():
        # Under the rebuild's lock, shared, so no rebuild commits between listing the nodes and
        # reading each (#174).
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock_shared(%s)", [INDEX_LOCK])
        for row in IndexedNode.objects.order_by("id"):
            indexed = node_from_index(row.id)
            assert indexed is not None
            nodes[row.id], folders[row.id] = indexed, row.folder
    for draft in standing:
        node, own = node_of(draft)
        problems.extend(own)
        if node is not None:
            nodes[draft.node_id], folders[draft.node_id] = node, draft.folder
    link_lines = {
        node_id: locate_links(write_node_yaml(each), file=f"{folders[node_id]}/{NODE_FILE}")
        for node_id, each in nodes.items()
    }
    every = [*problems, *graph_problems(nodes, folders, link_lines)]
    return sorted(every, key=Problem.sort_key)


def _checked(draft: Draft) -> tuple[Node | None, list[Problem]]:
    """The draft's node and every problem it has, against the index (M4W.5). A link to another
    draft's new node is missing until that node lands. It loads the whole index per call."""
    node, problems = node_of(draft)
    if node is None:
        return None, problems
    return node, in_place([draft])


@dataclass(frozen=True)
class Item:
    rule: str
    passed: bool
    detail: str


MIN_EXAM = 4  # M4's bar (architecture spec R4): an exam pool of at least four questions


def checks(draft: Draft) -> tuple[list[Item], list[Problem]]:
    """M4's bar before submitting (M4W.5) and the problems behind it, from one check (M4K.6): it
    verifies clean, a level, a resource, four exam questions."""
    node, problems = _checked(draft)
    errors = [problem for problem in problems if problem.refuses]
    resources = 0 if node is None else len(node.resources)
    exam = 0 if node is None else len(node.exam)
    items = [
        Item(
            "verifies clean",
            not errors,
            "no problems" if not errors else f"{len(errors)} problem(s); see verify",
        ),
        Item("a level", node is not None, "" if node is None else f"{node.level.value}"),
        Item("a resource", resources >= 1, f"{resources} resource(s)"),
        Item("four exam questions", exam >= MIN_EXAM, f"{exam} of {MIN_EXAM}"),
    ]
    return items, problems


def checklist(draft: Draft) -> list[Item]:
    """The checklist alone, as submitting and approving read it (M4.5)."""
    return checks(draft)[0]
