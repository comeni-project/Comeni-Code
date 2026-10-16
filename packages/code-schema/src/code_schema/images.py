"""A node's images: the files in its `images/` folder and their records in node.yaml (M6.3 spec,
M6IM.1–M6IM.2; invariant 6: an image carries its author and licence, or it is refused).

A file is read by its first bytes, never by its name alone: PNG, JPEG and WebP, at most 2 MB. SVG
is refused, being a document that can carry script. A licence must allow copying and showing the
image as it is — CC0, public domain, CC BY or CC BY-SA in any version, ported or not — since the
content repository is public and CC BY; it is written in one canonical form, which links its deed.
"""

from __future__ import annotations

import re
from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass

from code_schema.fields import Wrong, one_line, one_sentence, shown
from code_schema.problems import Problem
from code_schema.records import Field
from code_schema.yaml_lines import Lines

IMAGE_FIELD = "images"
IMAGE_FOLDER = "images"
MAX_IMAGE_BYTES = 2 * 1024 * 1024
_KEYS = ("file", "alt", "author", "source", "licence")
NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*\.(png|jpe?g|webp)$")
_EXTENSION_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
}
_VERSIONS = ("1.0", "2.0", "2.5", "3.0", "4.0")
_CC = re.compile(r"^cc[ -]?(by(?:[ -]sa)?)[ -](\d\.\d)(?:[ -]([a-z]{2,3}))?$")
OWN_WORK = "own work"

_alt = one_sentence(max_len=300)
_author = one_line(max_len=120)


@dataclass(frozen=True)
class ImageRecord:
    file: str
    alt: str
    author: str
    source: str
    licence: str


def sniff(data: bytes) -> str | None:
    """The image's media type by its first bytes; None for anything not PNG, JPEG or WebP."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def media_type_of(name: str) -> str | None:
    """The media type a file's extension promises."""
    found = NAME.match(name)
    return None if found is None else _EXTENSION_TYPES[found.group(1)]


def canonical_licence(text: str) -> str | None:
    """The licence in its one written form, or None when it is not one an image may carry."""
    said = " ".join(text.strip().lower().replace("_", " ").split())
    if said in ("cc0", "cc0 1.0", "cc0-1.0", "cc zero"):
        return "CC0 1.0"
    if said in ("public domain", "pd", "public-domain"):
        return "Public domain"
    found = _CC.match(said)
    if found is None or found.group(2) not in _VERSIONS:
        return None
    kind = "CC BY-SA" if "sa" in found.group(1) else "CC BY"
    port = f" {found.group(3)}" if found.group(3) else ""
    return f"{kind} {found.group(2)}{port}"


def licence_from_commons(short_names: Sequence[str]) -> str | None:
    """Of a Commons file's licences, the first an image may carry, in the order CC0, public
    domain, CC BY, CC BY-SA (M6IM.2); every public-domain flavour is `Public domain`."""
    found: list[str] = []
    for name in short_names:
        said = name.strip().lower()
        if said.startswith("pd") or "public domain" in said:
            found.append("Public domain")
        elif (licence := canonical_licence(name)) is not None:
            found.append(licence)
    order = ("CC0", "Public domain", "CC BY ", "CC BY-SA")
    for start in order:
        for licence in found:
            if licence.startswith(start) or licence == start:
                return licence
    return None


def deed_url(licence: str) -> str | None:
    """The licence's deed on creativecommons.org."""
    if licence == "CC0 1.0":
        return "https://creativecommons.org/publicdomain/zero/1.0/"
    if licence == "Public domain":
        return "https://creativecommons.org/publicdomain/mark/1.0/"
    parts = licence.split(" ")
    if len(parts) < 3 or parts[0] != "CC":
        return None
    kind = parts[1].lower()
    port = f"{parts[3]}/" if len(parts) > 3 else ""
    return f"https://creativecommons.org/licenses/{kind}/{parts[2]}/{port}"


def _source(value: object) -> Wrong | None:
    if value == OWN_WORK:
        return None
    if isinstance(value, str) and value.startswith("https://") and " " not in value.strip():
        return None
    return Wrong(
        "CS0907", f"an image's source is an https:// link or `{OWN_WORK}`, not {shown(value)}"
    )


def _licence(value: object) -> Wrong | None:
    canonical = canonical_licence(value) if isinstance(value, str) else None
    if canonical is not None and canonical == value:
        return None
    if canonical is not None:
        return Wrong("CS0906", f"the licence is written {canonical}, not {shown(value)}")
    return Wrong(
        "CS0906",
        f"{shown(value)} is not a licence an image may carry "
        "(CC0, public domain, CC BY or CC BY-SA; never NC or ND)",
    )


def parse_images(
    value: object, *, lines: Lines, file: str
) -> tuple[tuple[ImageRecord, ...], list[Problem]]:
    """One images: field. Never raises; returns the sound records and every problem."""
    problems: list[Problem] = []
    field = Field(IMAGE_FIELD, lines=lines, file=file, problems=problems)
    records: list[ImageRecord] = []
    seen: set[str] = set()
    for entry in field.entries(
        value,
        not_a_list=("CS0901", "must be a list of images"),
        not_a_mapping=("CS0902", lambda item: f"{shown(item)} is not an image"),
    ):
        written = entry.mapping
        entry.unknown(
            _KEYS, "CS0903", lambda key: f"unknown key `{key}` in an image ({', '.join(_KEYS)})"
        )
        for key in _KEYS:
            entry.require(key, "CS0904", f"an image has no {key}")
        name = written.get("file")
        if "file" in written and (not isinstance(name, str) or not NAME.match(name)):
            entry.problem(
                "CS0905",
                f"{shown(name)} is not an image file name (lowercase words joined by hyphens, "
                ".png, .jpg or .webp)",
                key="file",
            )
        elif isinstance(name, str) and name in seen:
            entry.problem("CS0908", f"{name} is recorded twice", key="file")
        entry.check("alt", _alt, prefix="the alt text ")
        entry.check("author", _author, prefix="the author ")
        entry.check("source", _source)
        entry.check("licence", _licence)
        if isinstance(name, str):
            seen.add(name)
        if not entry.sound:
            continue
        records.append(
            ImageRecord(
                file=str(written["file"]),
                alt=str(written["alt"]),
                author=str(written["author"]),
                source=str(written["source"]),
                licence=str(written["licence"]),
            )
        )
    return tuple(records), problems


def image_problems(
    records: Sequence[ImageRecord],
    images: Mapping[str, bytes] | None,
    placed: Collection[str],
    *,
    file: str,
    where: str,
) -> list[Problem]:
    """Records, placements and files agree (M6IM.1), and each file is an image it may be
    (M6IM.2). `images` None skips the files, as when only a node's texts are at hand."""
    problems: list[Problem] = []
    recorded = {record.file for record in records}
    for record in records:
        if record.file not in placed:
            problems.append(
                Problem(
                    file=file,
                    field=IMAGE_FIELD,
                    code="CS0909",
                    message=f"{record.file} is recorded but no block places it",
                )
            )
    for name in sorted(set(placed) - recorded):
        problems.append(
            Problem(
                file=file,
                field=IMAGE_FIELD,
                code="CS0910",
                message=f"{name} is placed but has no record in {IMAGE_FIELD}",
            )
        )
    if images is None:
        return problems
    folder = f"{where}{IMAGE_FOLDER}/"
    for name in sorted(recorded - set(images)):
        problems.append(
            Problem(
                file=folder, code="CS0911", message=f"{name} is recorded but not in {IMAGE_FOLDER}/"
            )
        )
    for name in sorted(set(images) - recorded):
        problems.append(
            Problem(
                file=f"{folder}{name}",
                code="CS0912",
                message=f"{name} has no record in {IMAGE_FIELD}",
            )
        )
    for name in sorted(set(images) & recorded):
        data = images[name]
        found = sniff(data)
        if found is None or found != media_type_of(name):
            said = (
                "not a PNG, JPEG or WebP image"
                if found is None
                else f"a {found}, not what its name says"
            )
            problems.append(
                Problem(file=f"{folder}{name}", code="CS0913", message=f"{name} is {said}")
            )
        elif len(data) > MAX_IMAGE_BYTES:
            problems.append(
                Problem(
                    file=f"{folder}{name}",
                    code="CS0914",
                    message=f"{name} is {len(data) // 1024} KB; an image is at most 2 MB",
                )
            )
    return problems
