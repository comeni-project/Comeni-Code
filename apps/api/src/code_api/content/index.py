"""Rebuild the index from a content folder, all or nothing (spec M1P5.5).

The only code that writes the index. It reads with `read_content`, the call content CI makes, so
the app and CI never disagree about what a valid node is. It does not run git and does not choose
the folder: the caller passes both.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from django.db import connection, transaction

from code_api.content.models import (
    IndexBuild,
    Link,
    Node,
    Provider,
    Question,
    Region,
    Resource,
)
from code_schema import Content, read_content
from code_schema.providers import REGISTRY as PROVIDER_REGISTRY
from code_schema.regions import REGISTRY

# Any fixed number: it names the transaction-scoped lock two rebuilds take in turn.
_LOCK = 5_172_031


def content_digest(root: Path, content: Content) -> str:
    """SHA-256 over the registries and every file inside every node folder, in sorted path order.

    Files outside the nodes (a README, .github/) do not change the index, so they do not change
    the digest. Each file contributes its relative path, its size and its bytes, so no two
    different folders hash alike by moving bytes between files.
    """
    files = [root / name for name in (REGISTRY, PROVIDER_REGISTRY) if (root / name).is_file()]
    for folder in content.folders.values():
        for path in (root / folder).rglob("*"):
            relative = path.relative_to(root)
            if path.is_file() and not any(part.startswith(".") for part in relative.parts):
                files.append(path)
    digest = hashlib.sha256()
    for path in sorted(files, key=lambda path: path.relative_to(root).as_posix()):
        data = path.read_bytes()
        digest.update(path.relative_to(root).as_posix().encode() + b"\0")
        digest.update(len(data).to_bytes(8, "big") + data)
    return digest.hexdigest()


def _region_rows(content: Content) -> list[Region]:
    return [
        Region(id=region.id, name=region.name, position=position)
        for position, region in enumerate(content.regions.values())
    ]


def _node_rows(content: Content) -> list[Node]:
    return [
        Node(
            id=node.id,
            title=node.title,
            claim=node.claim,
            region_id=node.region,
            level=node.level.value,
            minutes=node.minutes,
            body=node.body,
            folder=content.folders[node.id],
        )
        for node in content.nodes.values()
    ]


def _link_rows(content: Content) -> list[Link]:
    rows: list[Link] = []
    for node in content.nodes.values():
        for kind, links in (
            (Link.Kind.NEEDS, node.needs),
            (Link.Kind.GOES_DEEPER, node.goes_deeper),
            (Link.Kind.RELATED, node.related),
        ):
            rows.extend(
                Link(
                    source_id=node.id,
                    target_id=link.node,
                    kind=kind,
                    reason=link.reason,
                    position=position,
                )
                for position, link in enumerate(links)
            )
    return rows


def _provider_rows(content: Content) -> list[Provider]:
    return [
        Provider(id=provider.id, name=provider.name, position=position)
        for position, provider in enumerate(content.providers.values())
    ]


def _resource_rows(content: Content) -> list[Resource]:
    return [
        Resource(
            node_id=node.id,
            position=position,
            kind=resource.kind,
            provider_id=resource.provider,
            url=resource.url,
            video=resource.video,
            part=resource.part,
            covers=resource.covers,
            licence=resource.licence,
            display=resource.display,
            level=resource.level.value,
        )
        for node in content.nodes.values()
        for position, resource in enumerate(node.resources)
    ]


def _question_rows(content: Content) -> list[Question]:
    return [
        Question(
            node_id=node.id,
            position=position,
            question_id=question.id,
            kind=question.kind,
            ask=question.ask,
            options=[{"text": option.text, "right": option.right} for option in question.options],
            answer=question.answer,
            unit=question.unit,
            tolerance=question.tolerance,
            hints=list(question.hints),
            rationale=question.rationale,
        )
        for node in content.nodes.values()
        for position, question in enumerate(node.questions)
    ]


def rebuild_index(root: Path, *, commit: str = "") -> IndexBuild:
    """Replace the index with `root`'s content, or change nothing and record why.

    A refusal is an outcome, returned; only an unexpected failure while applying raises, after
    the transaction has rolled back and left the old index standing.
    """
    content = read_content(root)
    digest = content_digest(root, content)
    if content.problems:
        return IndexBuild.objects.create(
            outcome=IndexBuild.Outcome.REFUSED,
            digest=digest,
            commit=commit,
            node_count=len(content.folders),
            problems=[str(problem) for problem in content.problems],
        )
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(%s)", [_LOCK])
        Link.objects.all().delete()
        Question.objects.all().delete()
        Resource.objects.all().delete()
        Node.objects.all().delete()
        Region.objects.all().delete()
        Provider.objects.all().delete()
        Region.objects.bulk_create(_region_rows(content))
        Provider.objects.bulk_create(_provider_rows(content))
        Node.objects.bulk_create(_node_rows(content))
        Link.objects.bulk_create(_link_rows(content))
        Resource.objects.bulk_create(_resource_rows(content))
        Question.objects.bulk_create(_question_rows(content))
        return IndexBuild.objects.create(
            outcome=IndexBuild.Outcome.APPLIED,
            digest=digest,
            commit=commit,
            node_count=len(content.nodes),
        )
