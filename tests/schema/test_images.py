"""Images in the node folder (M6.3 spec, M6IM.1–M6IM.2)."""

from pathlib import Path

import pytest

from code_schema.blocks import Image, block_from_json, block_json, parse_blocks, write_blocks
from code_schema.images import (
    MAX_IMAGE_BYTES,
    ImageRecord,
    canonical_licence,
    deed_url,
    licence_from_commons,
    sniff,
)
from code_schema.node import read_node
from code_schema.writer import write_node_yaml

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 32
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 32
SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'

RECORD = (
    "images:\n"
    "  - file: graph.png\n"
    "    alt: A graph drawn as grey paths that meet at a few knots.\n"
    "    author: Jane Doe\n"
    "    source: https://commons.wikimedia.org/wiki/File:Graph.png\n"
    "    licence: CC BY-SA 4.0\n"
)
NODE = (
    "schema: 1\ntitle: Graphs\nclaim: A graph is nodes joined by edges.\nregion: algorithms\n"
    "level: foundations\nminutes: 10\n"
)
BODY = "Look:\n\n:::{image} graph.png\nWhat an assembly graph looks like.\n:::\n"
REGIONS = {"algorithms"}


def folder(tmp_path: Path, *, record: str = RECORD, body: str = BODY, **files: bytes) -> Path:
    node = tmp_path / "graphs"
    node.mkdir()
    (node / "node.yaml").write_text(NODE + record)
    (node / "body.md").write_text(body)
    if files:
        (node / "images").mkdir()
        for name, data in files.items():
            (node / "images" / name.replace("_", ".")).write_bytes(data)
    return node


def codes(tmp_path: Path, **kwargs: object) -> list[str]:
    node, problems = read_node(folder(tmp_path, **kwargs), regions=REGIONS)  # type: ignore[arg-type]
    return [problem.code for problem in problems]


# ── The block ─────────────────────────────────────────────────────────────────────────────────


def test_an_image_block_round_trips() -> None:
    body = ":::{image} graph.png\nWhat it looks like.\n:::\n"
    blocks, _, problems = parse_blocks(body, file="n/body.md")
    assert (blocks, problems) == ((Image("graph.png", "What it looks like.\n"),), [])
    assert write_blocks(blocks) == body
    assert block_from_json(block_json(blocks[0])) == blocks[0]
    assert block_json(blocks[0]) == {
        "kind": "image",
        "file": "graph.png",
        "caption": "What it looks like.\n",
    }


@pytest.mark.parametrize(
    ("body", "code"),
    [(":::{image}\nA caption.\n:::\n", "CS0426"), (":::{image} graph.png\n\n:::\n", "CS0427")],
)
def test_an_image_block_names_a_file_and_has_a_caption(body: str, code: str) -> None:
    _, _, problems = parse_blocks(body, file="n/body.md")
    assert [problem.code for problem in problems] == [code]


# ── The record and the files ──────────────────────────────────────────────────────────────────


def test_a_node_reads_its_images(tmp_path: Path) -> None:
    node, problems = read_node(folder(tmp_path, graph_png=PNG), regions=REGIONS)
    assert problems == []
    assert node is not None
    assert node.images == (
        ImageRecord(
            file="graph.png",
            alt="A graph drawn as grey paths that meet at a few knots.",
            author="Jane Doe",
            source="https://commons.wikimedia.org/wiki/File:Graph.png",
            licence="CC BY-SA 4.0",
        ),
    )
    assert "images:\n  - file: graph.png\n" in write_node_yaml(node)


@pytest.mark.parametrize(
    ("kwargs", "code"),
    [
        ({"body": "No image here.\n", "graph_png": PNG}, "CS0909"),
        ({"graph_png": PNG, "extra_png": PNG}, "CS0912"),
        ({}, "CS0911"),
        ({"graph_png": JPEG}, "CS0913"),
        ({"graph_png": SVG}, "CS0913"),
        ({"graph_png": PNG + b"\x00" * MAX_IMAGE_BYTES}, "CS0914"),
        ({"record": RECORD.replace("CC BY-SA 4.0", "CC BY-NC 4.0"), "graph_png": PNG}, "CS0906"),
        ({"record": RECORD.replace("    author: Jane Doe\n", ""), "graph_png": PNG}, "CS0904"),
        ({"record": RECORD.replace("graph.png", "Graph.PNG"), "graph_png": PNG}, "CS0905"),
        (
            {"record": RECORD.replace("https://commons", "http://commons"), "graph_png": PNG},
            "CS0907",
        ),
        ({"body": BODY.replace("graph.png", "other.png"), "graph_png": PNG}, "CS0910"),
        ({"record": "images: graph.png\n", "graph_png": PNG}, "CS0901"),
        ({"record": "images:\n  - graph.png\n", "graph_png": PNG}, "CS0902"),
        ({"record": RECORD + "    width: 400\n", "graph_png": PNG}, "CS0903"),
        ({"record": RECORD + RECORD.removeprefix("images:\n"), "graph_png": PNG}, "CS0908"),
    ],
)
def test_each_image_refusal_names_its_code(
    tmp_path: Path, kwargs: dict[str, object], code: str
) -> None:
    assert code in codes(tmp_path, **kwargs)


def test_own_work_is_a_source(tmp_path: Path) -> None:
    record = RECORD.replace("https://commons.wikimedia.org/wiki/File:Graph.png", "own work")
    assert codes(tmp_path, record=record, graph_png=PNG) == []


def test_formats_are_read_by_their_first_bytes() -> None:
    assert (sniff(PNG), sniff(JPEG), sniff(WEBP), sniff(SVG)) == (
        "image/png",
        "image/jpeg",
        "image/webp",
        None,
    )


# ── Licences ──────────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("given", "canonical"),
    [
        ("CC BY-SA 4.0", "CC BY-SA 4.0"),
        ("cc-by-4.0", "CC BY 4.0"),
        ("CC BY-SA 3.0 de", "CC BY-SA 3.0 de"),
        ("CC0", "CC0 1.0"),
        ("Public domain", "Public domain"),
        ("CC BY-NC 4.0", None),
        ("CC BY-ND 2.0", None),
        ("All rights reserved", None),
    ],
)
def test_canonical_licences(given: str, canonical: str | None) -> None:
    assert canonical_licence(given) == canonical


def test_commons_licences() -> None:
    assert licence_from_commons(["CC BY-NC 2.0", "CC BY-SA 3.0"]) == "CC BY-SA 3.0"
    assert licence_from_commons(["CC BY-SA 3.0", "CC BY 2.5"]) == "CC BY 2.5"
    assert licence_from_commons(["PD-US"]) == "Public domain"
    assert licence_from_commons(["CC BY-NC-SA 2.0"]) is None


def test_each_licence_links_its_deed() -> None:
    assert deed_url("CC BY-SA 3.0 de") == "https://creativecommons.org/licenses/by-sa/3.0/de/"
    assert deed_url("CC BY 4.0") == "https://creativecommons.org/licenses/by/4.0/"
    assert deed_url("CC0 1.0") == "https://creativecommons.org/publicdomain/zero/1.0/"
    assert deed_url("Public domain") == "https://creativecommons.org/publicdomain/mark/1.0/"


# ── Edits (#356, #355) ────────────────────────────────────────────────────────────────────────


def test_removing_an_image_takes_it_from_the_body_and_every_stem(tmp_path: Path) -> None:
    from dataclasses import replace

    from code_schema import ExamQuestion, NumberAnswer
    from code_schema.edits import remove_image

    node, _ = read_node(folder(tmp_path, graph_png=PNG), regions=REGIONS)
    assert node is not None
    stem = "How many paths?\n\n:::{image} graph.png\nThe graph.\n:::\n"
    asked = ExamQuestion(
        id="paths",
        title="Paths",
        claim="",
        stem=stem,
        answer=NumberAnswer(value=3, unit="", tolerance=None),
        level=None,
        rationale="Count them.",
    )
    gone = remove_image(replace(node, exam=(asked,)), "graph.png")
    assert gone.images == ()
    assert not any(isinstance(b, Image) for b in gone.blocks)
    assert gone.exam[0].stem == "How many paths?\n\n"


def test_a_free_name_for_a_new_image() -> None:
    from code_schema.images import free_name

    taken = {"image.png", "image-2.png"}
    assert free_name("image.png", taken) == "image-3.png"
    assert free_name("kmers.jpg", taken) == "kmers.jpg"
