"""`code-weaver`: `route` weaves a goal into stops (M2P3), `find` looks a goal up (M3P2.3).

The only module in this package that reads files or imports `code-schema`; the weave itself
imports nothing outside the standard library.
"""

import argparse
import sys
from collections.abc import Iterable, Sequence
from pathlib import Path

from code_schema.content import Content, read_content
from code_schema.node import Level
from code_weaver.find import Found, Target, find
from code_weaver.graph import Graph, GraphError, Need, Topic
from code_weaver.weave import Route, UnknownGoal, weave

WIDTH = 100
TITLE_COLUMN = 26


def graph_of(content: Content) -> Graph:
    """The weaver's graph, from nodes, `regions.yaml`'s order and the five levels."""
    topics = [
        Topic(
            id=node.id,
            region=node.region,
            level=node.level.value,
            needs=tuple(Need(node=link.node, reason=link.reason) for link in node.needs),
        )
        for node in content.nodes.values()
    ]
    return Graph(topics, list(content.regions), [level.value for level in Level])


def targets_of(content: Content) -> list[Target]:
    """What search sees: a node's id, title and claim. Bodies are not searched (M3P2.1)."""
    return [
        Target(id=node.id, title=node.title, claim=node.claim) for node in content.nodes.values()
    ]


def _cut(text: str, width: int) -> str:
    return text if len(text) <= width else text[: width - 1] + "…"


def _plural(count: int, noun: str) -> str:
    return f"{count} {noun}" if count == 1 else f"{count} {noun}s"


def _shown_level(level: str) -> str:
    return level.replace("-", " ").capitalize()


def _shown_time(minutes: int) -> str:
    hours, rest = divmod(minutes, 60)
    if not hours:
        return f"about {minutes} min"
    return f"about {hours} h {rest} min" if rest else f"about {hours} h"


def report(content: Content, route: Route, known: int) -> list[str]:
    """The header, a blank line, then one line per stop."""
    goals = set(route.goals)
    titles = ", ".join(content.nodes[stop].title for stop in route.stops if stop in goals)
    minutes = sum(content.nodes[stop].minutes for stop in route.stops)
    parts = [
        _plural(len(route.stops), "stop"),
        _shown_time(minutes),
        f"{_shown_level(route.span[0])} → {_shown_level(route.span[1])}",
    ]
    if known:
        parts.append(f"{known} known")
    lines = [_cut(f"Route to {titles} — " + " · ".join(parts), WIDTH), ""]
    for number, stop in enumerate(route.stops, 1):
        node = content.nodes[stop]
        head = (
            f"{number:>2}. {_cut(node.title, TITLE_COLUMN):<{TITLE_COLUMN}}  "
            f"{node.level.value:<12}  {node.minutes:>3}m"
        )
        needed_by = route.needed_by[stop]
        if not needed_by:
            lines.append(head)
            continue
        first = needed_by[0]
        lines.append(_cut(f"{head}  → {content.nodes[first.node].title}: {first.reason}", WIDTH))
    return lines


def found_report(content: Content, found: Found, words: str) -> list[str]:
    """The header, a blank line, one line per candidate, and the words that matched nothing."""
    if not found.ids:
        lines = [_cut(f'Nothing matches "{words}"', WIDTH)]
        return lines
    matches = "matches" if len(found.ids) == 1 else "match"
    lines = [_cut(f'{_plural(len(found.ids), "topic")} {matches} "{words}"', WIDTH), ""]
    for number, identifier in enumerate(found.ids, 1):
        node = content.nodes[identifier]
        head = (
            f"{number:>2}. {_cut(node.title, TITLE_COLUMN):<{TITLE_COLUMN}}  "
            f"{node.level.value:<12}  {node.minutes:>3}m"
        )
        lines.append(_cut(f"{head}  {node.claim}", WIDTH))
    if found.unmatched:
        lines += ["", _cut(f"Nothing matches: {', '.join(found.unmatched)}", WIDTH)]
    return lines


def main(argv: Sequence[str] | None = None) -> int:
    """0 a route, 1 the content is wrong, 2 the command was used wrongly."""
    parser = argparse.ArgumentParser(prog="code-weaver", description="Comeni Code's weaver.")
    commands = parser.add_subparsers(dest="command", required=True)
    route = commands.add_parser("route", help="weave a route to one or more goals")
    route.add_argument("goals", nargs="+", help="the node ids to reach")
    route.add_argument("--root", type=Path, required=True, help="the content root")
    route.add_argument(
        "--known", action="append", default=[], metavar="ID", help="a node already held"
    )
    look = commands.add_parser("find", help="find the topics some words are about")
    look.add_argument("words", help="what the learner typed")
    look.add_argument("--root", type=Path, required=True, help="the content root")
    look.add_argument(
        "--limit",
        type=int,
        default=10,
        choices=range(1, 51),
        metavar="N",
        help="how many candidates to print (1 to 50)",
    )
    arguments = parser.parse_args(argv)

    if arguments.command == "find" and not arguments.words.strip():
        print("code-weaver: a search needs a word", file=sys.stderr)
        return 2

    root: Path = arguments.root
    if not root.is_dir():
        print(f"code-weaver: no such folder: {root}", file=sys.stderr)
        return 2
    content = read_content(root)
    if content.problems:
        problems = _plural(len(content.problems), "problem")
        print(
            f"code-weaver: {problems} in the content; run code-schema validate {root}",
            file=sys.stderr,
        )
        return 1
    if arguments.command == "find":
        found = find(targets_of(content), arguments.words, limit=arguments.limit)
        for line in found_report(content, found, arguments.words):
            print(line)
        return 0

    try:
        graph = graph_of(content)
    except GraphError as refused:
        print(str(refused), file=sys.stderr)
        return 1
    known: Iterable[str] = arguments.known
    try:
        woven = weave(graph, arguments.goals, known=known)
    except UnknownGoal as unknown:
        print(f"code-weaver: not in the content: {', '.join(unknown.ids)}", file=sys.stderr)
        return 2
    held = {topic for topic in known if topic in content.nodes} - set(woven.goals)
    for line in report(content, woven, len(held)):
        print(line)
    return 0


def run() -> None:
    """The console script's entry point."""
    sys.exit(main())
