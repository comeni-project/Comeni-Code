"""`code-weaver route`: a goal to an ordered route, one line per stop (spec M2P3).

The only module in this package that reads files or imports `code-schema`; the weave itself
imports nothing outside the standard library.
"""

import argparse
import sys
from collections.abc import Iterable, Sequence
from pathlib import Path

from code_schema.content import Content, read_content
from code_schema.node import Level
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
    arguments = parser.parse_args(argv)

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
