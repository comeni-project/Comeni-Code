"""Figures in the node folder (M6.4 spec, M6FG.1).

Each figure is one file, `figures/<stem>.yaml`: the component it names, its alt text, its data and,
optionally, where the data came from. A `:::{figure} <stem>` block, a try question's `figure:` or
an exam stem places it. What the data may hold is the component's, in code-figures; this module
reads the file and turns what code-figures finds into problems at the file.

A file's text is kept as written, comments and layout included: every key outside the schema is
refused, so a valid file holds nothing that was not parsed.
"""

import re
from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass

import yaml

from code_figures import figure_findings, two_readings
from code_schema.problems import Problem

FIGURE_FOLDER = "figures"
MAX_FIGURE_BYTES = 64 * 1024
STEM = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_KEYS = ("component", "alt", "data", "source")
_SOURCE_KEYS = ("title", "url")
MAX_ALT = 300
MAX_TITLE = 160


@dataclass(frozen=True)
class FigureSource:
    """Where a figure's data came from, when it came from elsewhere; drawn as *Data: <title>*."""

    title: str
    url: str | None = None


@dataclass(frozen=True)
class FigureFile:
    stem: str
    text: str  # the file as written
    component: str
    alt: str
    data: Mapping[str, object]
    source: FigureSource | None = None

    @property
    def name(self) -> str:
        return file_name(self.stem)


def file_name(stem: str) -> str:
    return f"{stem}.yaml"


class _Loader(yaml.SafeLoader):
    """A safe loader that reads the data as the page will: dates stay text (a chart's temporal
    field is an ISO string, as the file holds it); a number is read only from its plain decimal
    form, so YAML 1.1's 1:30 (90) or 012 (10) stays text and is refused where the author can see
    why (#376); and no alias, which expands past the size cap and takes minutes to check (#374)."""

    def compose_node(self, parent: yaml.Node | None, index: int) -> yaml.Node | None:
        if self.check_event(yaml.AliasEvent):
            event = self.peek_event()  # type: ignore[no-untyped-call]
            raise yaml.composer.ComposerError(
                None, None, "uses a YAML alias; write the data out in full", event.start_mark
            )
        return super().compose_node(parent, index)


_INT = re.compile(r"[-+]?(0|[1-9][0-9]*)")
_FLOAT = re.compile(r"[-+]?(0|[1-9][0-9]*)(\.[0-9]*)?([eE][-+]?[0-9]+)?")


def _number(kind: type[int] | type[float], plain: re.Pattern[str]):  # type: ignore[no-untyped-def]
    def construct(loader: yaml.SafeLoader, node: yaml.ScalarNode) -> object:
        text = loader.construct_scalar(node)
        return kind(text) if isinstance(text, str) and plain.fullmatch(text) else text

    return construct


_Loader.add_constructor(
    "tag:yaml.org,2002:timestamp",
    lambda loader, node: loader.construct_scalar(node),  # type: ignore[arg-type]
)
_Loader.add_constructor("tag:yaml.org,2002:int", _number(int, _INT))
_Loader.add_constructor("tag:yaml.org,2002:float", _number(float, _FLOAT))


def _at(path: str, key: str | int) -> str:
    if isinstance(key, int):
        return f"{path}[{key}]"
    return f"{path}.{key}" if path else key


def _one_reading(node: yaml.Node, path: str = "") -> list[str]:
    """Where the file reads two ways (M6.5 spec, M6CO.3): a plain key or value the browser's YAML
    1.2 reads apart from ours, or a key written twice, which PyYAML keeps the last of and YAML 1.2
    refuses. Each is a message with its path."""
    if isinstance(node, yaml.ScalarNode):
        form = two_readings(node.value) if node.style is None else None
        return [] if form is None else [f"{path}: `{node.value}` reads two ways ({form}); quote it"]
    if isinstance(node, yaml.SequenceNode):
        return [
            found
            for at, item in enumerate(node.value)
            for found in _one_reading(item, _at(path, at))
        ]
    found: list[str] = []
    seen: set[str] = set()
    for key, value in node.value:
        name = str(key.value) if isinstance(key, yaml.ScalarNode) else "?"
        found += _one_reading(key, _at(path, name)) if isinstance(key, yaml.ScalarNode) else []
        if name in seen:
            found.append(f"{_at(path, name)}: is written twice")
        seen.add(name)
        found += _one_reading(value, _at(path, name))
    return found


def _load(text: str) -> tuple[object, list[str]]:
    loader = _Loader(text)
    try:
        node = loader.get_single_node()
        if node is None:
            return None, []
        twice = _one_reading(node)
        if twice:
            return None, twice
        return loader.construct_document(node), []
    except yaml.YAMLError as error:
        detail = getattr(error, "problem", None) or "could not be parsed"
        return None, [f"is not valid YAML ({detail})"]
    finally:
        loader.dispose()


def _source(value: object) -> tuple[FigureSource | None, str | None]:
    if not isinstance(value, Mapping):
        return None, "source is a mapping: title, and a url if there is one"
    unknown = [key for key in value if key not in _SOURCE_KEYS]
    if unknown:
        return None, f"source has an unknown key `{unknown[0]}` (title, url)"
    title, url = value.get("title"), value.get("url")
    if not isinstance(title, str) or not title.strip() or len(title) > MAX_TITLE:
        return None, f"source needs a title, one line of at most {MAX_TITLE} characters"
    if url is not None and (
        not isinstance(url, str) or not url.startswith("https://") or " " in url
    ):
        return None, "source's url is an https:// link"
    return FigureSource(title, url), None


def figure_texts(figures: Sequence[FigureFile]) -> dict[str, str]:
    """The figures as figures/ holds them: each file's text by its name."""
    return {figure.name: figure.text for figure in figures}


def starter_text(component: str, alt: str, data: Mapping[str, object]) -> str:
    """A new figure's file: its component, alt text and a component's starter data (M6FG.5)."""
    return yaml.safe_dump(
        {"component": component, "alt": alt, "data": dict(data)},
        sort_keys=False,
        allow_unicode=True,
        width=100,
    )


def read_figure(stem: str, text: str, *, file: str) -> tuple[FigureFile | None, list[Problem]]:
    """One figure file read: the figure, or None and every problem. Never raises."""
    return _figure(stem, text, file)


def _figure(stem: str, text: str, file: str) -> tuple[FigureFile | None, list[Problem]]:
    def problem(code: str, message: str) -> Problem:
        return Problem(file=file, code=code, message=message)

    if len(text.encode("utf-8")) > MAX_FIGURE_BYTES:
        size = len(text.encode("utf-8")) // 1024
        return None, [problem("CS1027", f"is {size} KB; a figure is at most 64 KB")]
    written, errors = _load(text)
    if errors:
        return None, [problem("CS1023", error) for error in errors]
    if not isinstance(written, Mapping):
        return None, [problem("CS1023", "must be a mapping: component, alt, data")]
    problems = [
        problem("CS1025", f"unknown key `{key}` in a figure ({', '.join(_KEYS)})")
        for key in written
        if key not in _KEYS
    ]
    alt = written.get("alt")
    if not isinstance(alt, str) or not alt.strip():
        problems.append(problem("CS1024", "has no alt text: the type, what it shows, the takeaway"))
    elif len(alt) > MAX_ALT:
        problems.append(problem("CS1024", f"has alt text longer than {MAX_ALT} characters"))
    source: FigureSource | None = None
    if "source" in written:
        source, wrong = _source(written["source"])
        if wrong is not None:
            problems.append(problem("CS1026", wrong))
    component = written.get("component")
    if not isinstance(component, str):
        problems.append(problem("CS1001", "names no component"))
    else:
        problems += [
            problem(found.code, f"{found.path}: {found.message}")
            for found in figure_findings(component, written.get("data"))
        ]
    if problems:
        return None, problems
    data = written["data"]
    assert isinstance(data, Mapping) and isinstance(component, str) and isinstance(alt, str)
    return FigureFile(stem, text, component, alt, data, source), []


def parse_figures(
    texts: Mapping[str, str], *, where: str
) -> tuple[tuple[FigureFile, ...], list[Problem]]:
    """The folder's figures/ by file name, read. Never raises."""
    figures: list[FigureFile] = []
    problems: list[Problem] = []
    for name in sorted(texts):
        file = f"{where}{FIGURE_FOLDER}/{name}"
        stem = name.removesuffix(".yaml")
        if stem == name or not STEM.match(stem):
            problems.append(
                Problem(
                    file=file,
                    code="CS1022",
                    message=(
                        f"{name} is not a figure file name (lowercase words joined by hyphens, "
                        "then .yaml)"
                    ),
                )
            )
            continue
        figure, found = _figure(stem, texts[name], file)
        problems += found
        if figure is not None:
            figures.append(figure)
    return tuple(figures), problems


def figure_problems(
    names: Collection[str], placed: Collection[str], *, file: str, where: str
) -> list[Problem]:
    """Every placement names a file and every file is placed (M6FG.1). `names` are the stems in
    figures/, read or not, so a file refused for its content is not also called missing."""
    problems = [
        Problem(
            file=file, code="CS1020", message=f"{stem} is placed but figures/ has no {stem}.yaml"
        )
        for stem in sorted(set(placed) - set(names))
    ]
    problems += [
        Problem(
            file=f"{where}{FIGURE_FOLDER}/{file_name(stem)}",
            code="CS1021",
            message=f"{file_name(stem)} is placed by no block, try question or exam stem",
        )
        for stem in sorted(set(names) - set(placed))
    ]
    return problems
