"""Opening, saving and discarding drafts (M4.4 spec, M4W.1–M4W.3).

A save reads the latest revision's files into a `Node` with `code-schema`, applies a pure edit,
writes the files with the canonical writer and reads them back with the index's regions and
providers — the parse CI runs on the content repository. An error refuses the save and stores
nothing; a warning is stored with it. Each save names the revision it was based on, and a save on
a stale one is refused (optimistic concurrency, M4W.0).
"""

import hashlib
from collections.abc import Callable, Container, Mapping
from dataclasses import dataclass, field

from django.db import IntegrityError, connection, transaction

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.index import INDEX_LOCK
from code_api.content.models import IndexBuild
from code_api.content.models import Node as IndexedNode
from code_api.content.snapshot import (
    images_from_index,
    node_from_index,
    providers_from_index,
    regions_from_index,
)
from code_api.studio.log import record
from code_api.studio.models import LIVE_STATES, Asset, Draft, DraftEvent, Revision
from code_schema import Level, Node, Problem, parse_node_files
from code_schema.edits import without_unplaced_figures
from code_schema.figures import figure_texts
from code_schema.graph import graph_problems
from code_schema.images import sniff
from code_schema.links import locate_links
from code_schema.node import NODE_FILE
from code_schema.question_rules import question_checks
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
    node_id: str,
    folder: str,
    node_yaml: str,
    body: str,
    exam: str,
    images: Mapping[str, bytes] | None = None,
    figures: Mapping[str, str] | None = None,
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
        images={} if images is None else images,
        figures=figures,
    )


def images_of(revision: Revision) -> dict[str, bytes]:
    """The revision's image files by name, read from their assets (M6IM.3)."""
    if not revision.images:
        return {}
    found = {
        a.sha256: bytes(a.data) for a in Asset.objects.filter(sha256__in=revision.images.values())
    }
    return {name: found[sha] for name, sha in revision.images.items() if sha in found}


def _stored(images: Mapping[str, bytes]) -> dict[str, str]:
    """Each file kept once as an asset, by its sha256; the revision's mapping (M6IM.3)."""
    mapping: dict[str, str] = {}
    for name, data in images.items():
        sha = hashlib.sha256(data).hexdigest()
        Asset.objects.get_or_create(
            sha256=sha,
            defaults={
                "media_type": sniff(data) or "application/octet-stream",
                "size": len(data),
                "data": data,
            },
        )
        mapping[name] = sha
    return mapping


def latest(draft: Draft) -> Revision:
    return draft.revisions.order_by("-number").first()  # type: ignore[return-value]


def node_of(draft: Draft, revision: Revision | None = None) -> tuple[Node | None, list[Problem]]:
    """The node a revision holds (the latest by default), and its problems.

    A revision parsed when it was saved, but it is read against the index's registries as they
    are now: if a rebuild dropped a region or a licence it uses, the node is None and the problems
    say why, never a 500 (#173). Such a draft is discarded, or the registry is restored.
    """
    shown = revision or latest(draft)
    return _read(
        draft.node_id,
        draft.folder,
        shown.node_yaml,
        shown.body_md,
        shown.exam_yaml,
        images_of(shown),
        shown.figures,
    )


def contributors(draft: Draft) -> list[User]:
    """Everyone who saved a revision, in the order they first saved."""
    seen: dict[int, User] = {}
    for revision in draft.revisions.order_by("number").select_related("saved_by"):
        if revision.saved_by is not None and revision.saved_by.pk not in seen:
            seen[revision.saved_by.pk] = revision.saved_by
    return list(seen.values())


def _start(
    node: Node,
    folder: str,
    base_digest: str,
    by: User,
    change: str,
    images: Mapping[str, bytes] | None = None,
) -> Draft:
    node_yaml, body, exam = _files(node)
    figures = figure_texts(node.figures)
    _, problems = _read(node.id, folder, node_yaml, body, exam, images or {}, figures)
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
                images=_stored(images or {}),
                figures=figures,
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
        images = images_from_index(node_id)
    return _start(node, folder, build.digest, by, "opened from the index", images)


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


def save(
    draft: Draft,
    *,
    based_on: int,
    edit: Edit,
    by: User,
    change: str,
    images: Mapping[str, bytes | None] | None = None,
) -> Saved:
    """One edit, one revision — or none, if the edit's files have errors or `based_on` is stale.
    `images` changes the image files with the edit: a file by name, or None to remove it (M6IM.3).

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
        edited = without_unplaced_figures(edit(node))
        node_yaml, body, exam = _files(edited)
        files = images_of(current)
        for name, data in (images or {}).items():
            if data is None:
                files.pop(name, None)
            else:
                files[name] = data
        figures = figure_texts(edited.figures)
        again, problems = _read(
            locked.node_id, locked.folder, node_yaml, body, exam, files, figures
        )
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
            images=_stored(files),
            figures=figures,
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


def _index_nodes() -> tuple[dict[str, Node], dict[str, str]]:
    """Every indexed node and its folder, read under the rebuild's lock, shared, so no rebuild
    commits between listing the nodes and reading each (#174)."""
    nodes: dict[str, Node] = {}
    folders: dict[str, str] = {}
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock_shared(%s)", [INDEX_LOCK])
        for row in IndexedNode.objects.order_by("id"):
            indexed = node_from_index(row.id)
            assert indexed is not None
            nodes[row.id], folders[row.id] = indexed, row.folder
    return nodes, folders


def link_lines(node: Node, folder: str) -> dict[tuple[str, str], int]:
    return locate_links(write_node_yaml(node), file=f"{folder}/{NODE_FILE}")


def _graph(nodes: dict[str, Node], folders: dict[str, str]) -> list[Problem]:
    lines = {node_id: link_lines(each, folders[node_id]) for node_id, each in nodes.items()}
    return graph_problems(nodes, folders, lines)


def in_place(standing: list[Draft]) -> list[Problem]:
    """Every problem of `standing` together (M4W.5, M4L.3): `code-schema`'s graph rules, as
    `validate` runs them, with each draft's latest revision in place of its indexed node, against
    every other node in the index, plus each draft's own problems. A draft that no longer reads
    adds its problems and stays out of the graph. Landing's check: the index and the batch."""
    nodes, folders = _index_nodes()
    problems: list[Problem] = []
    for draft in standing:
        node, own = node_of(draft)
        problems.extend(own)
        if node is not None:
            nodes[draft.node_id], folders[draft.node_id] = node, draft.folder
    return sorted([*problems, *_graph(nodes, folders)], key=Problem.sort_key)


def live_nodes() -> dict[str, tuple[Draft, Node]]:
    """Each live draft that reads, with its node, by its node's id (one per node, M4W.1). A draft
    that no longer reads is no link target: a link to it is a missing node, never also CA0224
    (#341)."""
    found: dict[str, tuple[Draft, Node]] = {}
    for draft in Draft.objects.filter(state__in=LIVE_STATES):
        node, _ = node_of(draft)  # its own problems are its own (M6LD.2)
        if node is not None:
            found[draft.node_id] = (draft, node)
    return found


def indexed_ids() -> set[str]:
    return set(IndexedNode.objects.values_list("id", flat=True))


def _kinds(node: Node) -> list[tuple[str, str]]:
    return [
        *(("needs", link.node) for link in node.needs),
        *(("goes-deeper", link.node) for link in node.goes_deeper),
        *(("related", link.node) for link in node.related),
    ]


def unlanded_links(node: Node, indexed: set[str], live: Container[str]) -> list[tuple[str, str]]:
    """The node's links to a live draft (of `live`'s ids) of a node the index does not have
    (M6LD.1), as
    `(kind, target)` in link order: needs, goes-deeper, related."""
    return [
        (kind, target)
        for kind, target in _kinds(node)
        if target not in indexed and target in live and target != node.id
    ]


def _where(problem: Problem) -> tuple[str, str | None, int | None, str]:
    return problem.file, problem.field, problem.line, problem.code


def _checked(draft: Draft) -> tuple[Node | None, list[Problem]]:
    """The draft's node and the problems it carries or causes (M6LD.1–M6LD.2), with every live
    draft in place over the index. A problem shows when it is in the draft's folder, or when it is
    gone with the draft taken back out; a link to a draft not landed adds CA0224. It loads the
    whole index and runs the graph rules twice per call."""
    node, problems = node_of(draft)
    if node is None:
        return None, problems
    indexed, indexed_folders = _index_nodes()
    nodes, folders = dict(indexed), dict(indexed_folders)
    live = live_nodes()
    for node_id, (other, placed) in live.items():
        if other.pk != draft.pk:
            nodes[node_id], folders[node_id] = placed, other.folder
    without_nodes, without_folders = dict(nodes), dict(folders)
    if draft.node_id in indexed:
        without_nodes[draft.node_id] = indexed[draft.node_id]
        without_folders[draft.node_id] = indexed_folders[draft.node_id]
    else:
        without_nodes.pop(draft.node_id, None)
        without_folders.pop(draft.node_id, None)
    nodes[draft.node_id], folders[draft.node_id] = node, draft.folder
    # Compared without their message: a missing node's "closest is" may name this draft's node, and
    # rewording another draft's problem does not make it this draft's (#340).
    without = {_where(p) for p in _graph(without_nodes, without_folders)}
    own = f"{draft.folder}/"
    shown = [
        p for p in _graph(nodes, folders) if p.file.startswith(own) or _where(p) not in without
    ]
    lines = link_lines(node, draft.folder)
    shown += [
        Problem(
            file=f"{draft.folder}/{NODE_FILE}",
            field=kind,
            line=lines.get((kind, target)),
            code="CA0224",
            message=f"{kind.replace('-', ' ')} {target}, a draft that has not landed",
        )
        for kind, target in unlanded_links(node, set(indexed), live)
    ]
    return node, sorted([*problems, *shown], key=Problem.sort_key)


@dataclass(frozen=True)
class Item:
    rule: str
    passed: bool
    detail: str


MIN_EXAM = 4  # M4's bar (architecture spec R4): an exam pool of at least four questions


def checks(draft: Draft) -> tuple[list[Item], list[Problem], dict[str, list[Item]]]:
    """M4's bar before submitting (M4W.5) and the problems behind it, from one check (M4K.6): it
    verifies clean, a level, a resource, four exam questions; and each exam question's own checks,
    by its id in pool order (M4P.4)."""
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
    by_question = (
        {}
        if node is None
        else {
            question.id: [
                Item(check.says, check.passed, check.detail)
                for check in question_checks(question, problems)
            ]
            for question in node.exam
        }
    )
    return items, problems, by_question


def checklist(draft: Draft) -> list[Item]:
    """The checklist alone, as submitting and approving read it (M4.5)."""
    return checks(draft)[0]
