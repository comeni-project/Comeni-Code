"""A node's outside resources (spec M3P1.2)."""

from typing import Any

from code_schema.problems import Problem
from code_schema.providers import Provider
from code_schema.resources import parse_resources
from code_schema.yaml_lines import load_mapping

PROVIDERS = {
    "khan-academy": Provider(
        "khan-academy", "Khan Academy", ("YouTube embed",), embed=True, players=("youtube",)
    ),
    "openstax": Provider("openstax", "OpenStax", ("CC BY 4.0",), embed=False),
}

VIDEO = """resources:
  - kind: video
    provider: khan-academy
    url: https://www.youtube.com/watch?v=abc
    part: 2:10–7:45
    covers: Why overlapping reads are assembled through their k-mers.
    licence: YouTube embed
    display: embed
    level: introductory
    video: youtube:Jnk_4Maf5Fk
"""

READING = """  - kind: reading
    provider: openstax
    url: https://openstax.org/books/biology-2e/pages/17-1
    part: §17.1
    covers: The genome-sequencing section that sets up assembly.
    licence: CC BY 4.0
    display: link
    level: foundations
"""


def parse(text: str, *, providers: dict[str, Provider] | None = PROVIDERS) -> Any:
    """Parse one resources: field. `providers=None` is a content folder with no registry."""
    data, lines, problems = load_mapping(text, file="node.yaml")
    assert data is not None
    assert problems == []
    return parse_resources(data["resources"], providers=providers, lines=lines, file="node.yaml")


def messages(problems: list[Problem]) -> list[str]:
    return [problem.message for problem in problems]


def test_a_video_resource_is_read() -> None:
    resources, problems = parse(VIDEO)
    assert problems == []
    assert resources[0].kind == "video"
    assert resources[0].provider == "khan-academy"
    assert resources[0].part == "2:10–7:45"
    assert resources[0].display == "embed"
    assert resources[0].level.value == "introductory"


def test_the_authors_order_is_kept() -> None:
    resources, problems = parse(VIDEO + READING)
    assert problems == []
    assert [resource.kind for resource in resources] == ["video", "reading"]


def test_an_unknown_provider_suggests_the_closest() -> None:
    _, problems = parse(VIDEO.replace("provider: khan-academy", "provider: khan-acadmy"))
    assert problems[0].field == "resources"
    assert problems[0].line == 3
    assert messages(problems) == [
        "khan-acadmy is not a provider in providers.yaml — did you mean khan-academy?"
    ]


def test_a_licence_the_provider_does_not_list_is_a_problem() -> None:
    _, problems = parse(VIDEO.replace("licence: YouTube embed", "licence: CC BY-NC-SA"))
    assert messages(problems) == [
        "the resource from Khan Academy carries CC BY-NC-SA, which Khan Academy does not list"
    ]
    assert problems[0].line == 7


def test_an_embed_a_provider_does_not_allow_is_a_problem() -> None:
    _, problems = parse(VIDEO + READING.replace("display: link", "display: embed"))
    assert messages(problems) == [
        "the resource from OpenStax asks for an embed it does not allow — use display: link"
    ]


def test_a_reversed_timestamp_range_is_a_problem() -> None:
    _, problems = parse(VIDEO.replace("part: 2:10–7:45", "part: 7:45–2:10"))
    assert messages(problems) == ["the part 7:45–2:10 ends before it starts"]


def test_a_video_part_that_is_not_a_range_is_a_problem() -> None:
    _, problems = parse(VIDEO.replace("part: 2:10–7:45", "part: the middle"))
    assert messages(problems) == [
        'the part of a video is a timestamp range, such as 2:10–7:45, not "the middle"'
    ]


def test_an_hour_long_range_is_read() -> None:
    resources, problems = parse(VIDEO.replace("part: 2:10–7:45", "part: 1:02:10–1:07:45"))
    assert problems == []
    assert resources[0].part == "1:02:10–1:07:45"


def test_a_hyphen_may_separate_a_range() -> None:
    resources, problems = parse(VIDEO.replace("part: 2:10–7:45", "part: 2:10-7:45"))
    assert problems == []
    assert resources[0].part == "2:10-7:45"


def test_a_section_part_is_fine_on_a_reading() -> None:
    resources, problems = parse("resources:\n" + READING)
    assert problems == []
    assert resources[0].part == "§17.1"


def test_a_part_is_optional() -> None:
    resources, problems = parse(VIDEO.replace("    part: 2:10–7:45\n", ""))
    assert problems == []
    assert resources[0].part == ""


def test_the_same_url_twice_in_one_node_is_a_problem() -> None:
    _, problems = parse(VIDEO + VIDEO.split("\n", 1)[1])
    assert messages(problems) == ["https://www.youtube.com/watch?v=abc is cited twice in this node"]


def test_an_unknown_key_is_a_problem() -> None:
    _, problems = parse(VIDEO + "    note: hello\n")
    assert messages(problems) == [
        "unknown key `note` in a resource "
        "(kind, provider, url, video, part, covers, licence, display, level)"
    ]


def test_every_required_field_is_named_when_missing() -> None:
    _, problems = parse("resources:\n  - kind: video\n")
    assert messages(problems) == [
        "a resource has no provider",
        "a resource has no url",
        "a resource has no covers",
        "a resource has no licence",
        "a resource has no display",
        "a resource has no level",
    ]


def test_a_url_must_be_https() -> None:
    _, problems = parse(VIDEO.replace("https://", "http://"))
    assert messages(problems) == ["the url must start with https://"]


def test_a_kind_must_be_one_of_the_four() -> None:
    _, problems = parse(VIDEO.replace("kind: video", "kind: podcast"))
    assert messages(problems) == [
        '"podcast" is not a kind of resource (video, reading, tutorial, exercise)'
    ]


def test_a_display_must_be_embed_or_link() -> None:
    _, problems = parse(VIDEO.replace("display: embed", "display: inline"))
    assert messages(problems) == ['"inline" is not a display (embed, link)']


def test_covers_is_one_sentence() -> None:
    _, problems = parse(VIDEO.replace("their k-mers.", "their k-mers"))
    assert messages(problems) == ["what this resource covers must end with . ? or !"]


def test_the_list_must_be_a_list() -> None:
    _, problems = parse("resources: a video\n")
    assert messages(problems) == ["must be a list of resources"]


def test_an_empty_list_is_written_by_leaving_the_field_out() -> None:
    _, problems = parse("resources: []\n")
    assert messages(problems) == ["an empty list is written by leaving the field out"]


def test_without_a_registry_the_other_rules_still_run() -> None:
    _, problems = parse(VIDEO.replace("https://", "ftp://"), providers=None)
    assert messages(problems) == ["the url must start with https://"]


def test_without_a_registry_no_provider_is_unknown() -> None:
    _, problems = parse(
        VIDEO.replace("provider: khan-academy", "provider: nowhere"), providers=None
    )
    assert problems == []


def test_an_embedded_video_names_the_video_it_plays() -> None:
    resources, problems = parse(VIDEO)
    assert problems == []
    assert resources[0].video == "youtube:Jnk_4Maf5Fk"


def test_a_linked_resource_names_no_video() -> None:
    resources, problems = parse(VIDEO + READING)
    assert problems == []
    assert resources[1].video == ""


def test_an_embedded_video_without_its_video_is_a_problem() -> None:
    _, problems = parse(VIDEO.replace("    video: youtube:Jnk_4Maf5Fk\n", ""))
    assert messages(problems) == [
        "an embedded video names the video it plays, such as video: youtube:<id>"
    ]
    assert problems[0].line == 8


def test_a_linked_video_needs_no_video() -> None:
    linked = VIDEO.replace("display: embed", "display: link")
    _, problems = parse(linked.replace("    video: youtube:Jnk_4Maf5Fk\n", ""))
    assert problems == []


def test_only_a_video_names_a_video() -> None:
    _, problems = parse(VIDEO + READING + "    video: youtube:Jnk_4Maf5Fk\n")
    assert messages(problems) == ["only a video names a video to play"]
    assert problems[0].line == 19


def test_a_video_is_written_player_colon_id() -> None:
    _, problems = parse(VIDEO.replace("youtube:Jnk_4Maf5Fk", "Jnk_4Maf5Fk"))
    assert messages(problems) == [
        'a video is written player:id, such as youtube:Jnk_4Maf5Fk, not "Jnk_4Maf5Fk"'
    ]
    assert problems[0].line == 10


def test_an_unknown_player_is_a_problem() -> None:
    _, problems = parse(VIDEO.replace("youtube:Jnk_4Maf5Fk", "vimeo:123"))
    assert messages(problems) == ["vimeo is not a player (youtube)"]


def test_a_malformed_id_is_a_problem() -> None:
    _, problems = parse(VIDEO.replace("youtube:Jnk_4Maf5Fk", "youtube:short"))
    assert messages(problems) == ["short is not a youtube video id"]


def test_a_player_the_provider_does_not_list_is_a_problem() -> None:
    providers = dict(PROVIDERS)
    providers["khan-academy"] = Provider(
        "khan-academy", "Khan Academy", ("YouTube embed",), embed=True
    )
    _, problems = parse(VIDEO, providers=providers)
    assert messages(problems) == ["Khan Academy is not embedded through youtube"]
    assert problems[0].line == 10
