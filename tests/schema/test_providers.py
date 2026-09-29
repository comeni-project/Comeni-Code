"""providers.yaml: the allow-list a resource cites (spec M3P1.2)."""

from pathlib import Path

from code_schema.providers import Provider, parse_providers, read_providers

GOOD = """providers:
  - id: khan-academy
    name: Khan Academy
    licences: [YouTube embed]
    embed: true
    players: [youtube]
  - id: openstax
    name: OpenStax
    licences: [CC BY 4.0]
    embed: true
"""


def test_a_registry_is_read_in_order() -> None:
    providers, problems = parse_providers(GOOD)
    assert problems == []
    assert list(providers) == ["khan-academy", "openstax"]
    assert providers["khan-academy"] == Provider(
        id="khan-academy",
        name="Khan Academy",
        licences=("YouTube embed",),
        embed=True,
        players=("youtube",),
    )
    assert providers["openstax"].players == ()


def test_a_provider_listed_twice_is_a_problem() -> None:
    again = "  - id: khan-academy\n    name: Again\n    licences: [x]\n    embed: false\n"
    _, problems = parse_providers(GOOD + again)
    assert [problem.message for problem in problems] == ['"khan-academy" is listed twice']
    assert problems[0].line == 11


def test_every_field_is_required() -> None:
    _, problems = parse_providers("providers:\n  - id: khan-academy\n")
    assert [(problem.field, problem.message) for problem in problems] == [
        ("name", "required field is missing"),
        ("licences", "required field is missing"),
        ("embed", "required field is missing"),
    ]


def test_licences_must_list_at_least_one() -> None:
    _, problems = parse_providers(
        "providers:\n  - id: a\n    name: A\n    licences: []\n    embed: true\n"
    )
    assert [(problem.field, problem.message) for problem in problems] == [
        ("licences", "must list at least one licence")
    ]


def test_a_licence_must_be_one_line() -> None:
    _, problems = parse_providers(
        "providers:\n  - id: a\n    name: A\n    licences: [7]\n    embed: true\n"
    )
    assert [problem.message for problem in problems] == ["7 is not text"]


def test_embed_must_be_true_or_false() -> None:
    _, problems = parse_providers(
        "providers:\n  - id: a\n    name: A\n    licences: [CC BY 4.0]\n    embed: yes please\n"
    )
    assert [problem.message for problem in problems] == ['"yes please" is not true or false']


def test_an_id_must_be_a_slug() -> None:
    _, problems = parse_providers(
        "providers:\n  - id: Khan Academy\n    name: A\n    licences: [x]\n    embed: true\n"
    )
    assert problems[0].message.startswith('"Khan Academy" is not a provider id')


def test_the_list_must_be_a_list() -> None:
    _, problems = parse_providers("providers: khan-academy\n")
    assert [(problem.field, problem.message) for problem in problems] == [
        ("providers", "must be a list of providers")
    ]


def test_a_missing_file_is_no_registry_and_no_problem(tmp_path: Path) -> None:
    providers, problems = read_providers(tmp_path)
    assert providers is None
    assert problems == []


def test_a_present_file_is_read(tmp_path: Path) -> None:
    (tmp_path / "providers.yaml").write_text(GOOD, encoding="utf-8")
    providers, problems = read_providers(tmp_path)
    assert problems == []
    assert providers is not None
    assert list(providers) == ["khan-academy", "openstax"]


def test_a_player_must_be_one_the_page_can_play() -> None:
    _, problems = parse_providers(
        "providers:\n  - id: a\n    name: A\n    licences: [x]\n    embed: true\n"
        "    players: [vimeo]\n"
    )
    assert [(problem.field, problem.message) for problem in problems] == [
        ("players", "vimeo is not a player (youtube)")
    ]


def test_players_must_be_a_list() -> None:
    _, problems = parse_providers(
        "providers:\n  - id: a\n    name: A\n    licences: [x]\n    embed: true\n"
        "    players: youtube\n"
    )
    assert [problem.message for problem in problems] == ["must be a list of players"]
