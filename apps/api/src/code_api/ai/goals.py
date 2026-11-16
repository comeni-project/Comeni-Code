"""Learner goal suggestions constrained to reviewed nodes already in the content index."""

import json
from importlib.resources import files

from django.db.models import Q

from code_api.ai import gateway
from code_api.ai.resolve import Refused
from code_api.ai.schemas import GoalSelection
from code_api.content import reads
from code_api.content.models import Link, Node
from code_api.content.schemas import ResultOut, SearchOut

PROMPT_ID = "goal-suggestions@1"
SEARCH_LIMIT = 10
CANDIDATE_LIMIT = 20
SUGGESTION_LIMIT = 3
MAX_QUERY_LENGTH = 240


def _candidate_cards(search: SearchOut) -> tuple[list[ResultOut], list[str]]:
    """Add reviewed related peers to ranked lexical results in a stable order."""
    initial_ids = [item.id for item in search.results]
    peers: dict[str, list[str]] = {node_id: [] for node_id in initial_ids}
    for source, target in (
        Link.objects.filter(kind=Link.Kind.RELATED)
        .filter(Q(source_id__in=initial_ids) | Q(target_id__in=initial_ids))
        .order_by("position", "source_id", "target_id")
        .values_list("source_id", "target_id")
    ):
        if source in peers and target not in peers[source]:
            peers[source].append(target)
        if target in peers and source not in peers[target]:
            peers[target].append(source)

    candidate_ids = list(initial_ids)
    for node_id in initial_ids:
        for peer in peers[node_id]:
            if peer not in candidate_ids and len(candidate_ids) < CANDIDATE_LIMIT:
                candidate_ids.append(peer)

    rows = {
        row.id: row
        for row in Node.objects.filter(id__in=candidate_ids)
        .select_related("region")
        .only("id", "title", "claim", "level", "minutes", "region__id", "region__name")
    }
    cards = [
        ResultOut(
            id=row.id,
            title=row.title,
            claim=row.claim,
            level=row.level,
            minutes=row.minutes,
            region=reads._region(row.region),
        )
        for identifier in candidate_ids
        if (row := rows.get(identifier)) is not None
    ]
    return cards, candidate_ids


def _messages(query: str, candidates: list[ResultOut]) -> list[dict[str, str]]:
    instruction = (
        files("code_api.ai.prompts").joinpath("suggest-goals.v1.txt").read_text(encoding="utf-8")
    )
    payload = {
        "query": query,
        "candidates": [item.model_dump(mode="json") for item in candidates],
    }
    return [
        {"role": "system", "content": instruction},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]


def suggest(query: str) -> SearchOut:
    """Choose up to three IDs from deterministic search plus their human-authored peers."""
    found = reads.search(query, SEARCH_LIMIT)
    if not found.results:
        return found
    candidates, allowed = _candidate_cards(found)
    if not candidates:
        return found
    answer = gateway.call(
        "goal-suggestions",
        _messages(query, candidates),
        by=None,
        prompt_id=PROMPT_ID,
        reply=GoalSelection,
    )
    if isinstance(answer, Refused) or not isinstance(answer.value, GoalSelection):
        return found
    accepted: list[str] = []
    for identifier in answer.value.ids:
        if identifier in allowed and identifier not in accepted:
            accepted.append(identifier)
        if len(accepted) == SUGGESTION_LIMIT:
            break
    if not accepted:
        return found
    by_id = {item.id: item for item in candidates}
    return SearchOut(query=query, unmatched=found.unmatched, results=[by_id[i] for i in accepted])
