"""The field rules of spec M1P1.3, one message each."""

from code_schema.fields import (
    exactly,
    https_url,
    one_line,
    one_of,
    one_sentence,
    seconds,
    shown,
    slug,
    whole_number,
)

LEVELS = ("first-steps", "foundations", "introductory", "intermediate", "advanced")


def test_shown_quotes_text_and_leaves_numbers_bare() -> None:
    assert shown("expert") == '"expert"'
    assert shown(12) == "12"
    assert shown(None) == "nothing"


def test_exactly_names_both_versions() -> None:
    assert exactly(1)(1) is None
    assert exactly(1)(2) == "this node is schema 2; this validator understands 1"


def test_one_line_refuses_newlines_and_length() -> None:
    check = one_line(max_len=80)
    assert check("Salmon") is None
    assert check("Sal\nmon") == "must be one line"
    assert check("x" * 81) == "is longer than 80 characters (81)"
    assert check(12) == "12 is not text"


def test_one_sentence_wants_terminal_punctuation() -> None:
    check = one_sentence(max_len=200)
    assert check("Salmon quantifies transcripts.") is None
    assert check("Salmon quantifies transcripts") == "must end with . ? or !"
    assert check("") == "must not be empty"


def test_one_of_lists_what_was_expected() -> None:
    check = one_of(LEVELS, noun="level")
    assert check("intermediate") is None
    assert check("expert") == (
        '"expert" is not a level (first-steps, foundations, introductory, intermediate, advanced)'
    )


def test_whole_number_refuses_text_even_when_it_looks_like_a_number() -> None:
    check = whole_number(minimum=1)
    assert check(12) is None
    assert check("12") == '"12" is not a whole number'
    assert check("twelve") == '"twelve" is not a whole number'
    assert check(True) == "true is not a whole number"
    assert check(0) == "0 is not at least 1"


def test_slug_states_the_pattern() -> None:
    check = slug(noun="region id")
    assert check("sequence-analysis") is None
    assert check("Sequence Analysis") == (
        '"Sequence Analysis" is not a region id (lower case, digits and single hyphens)'
    )


def test_https_url_refuses_anything_else(name: str = "url") -> None:
    check = https_url()
    assert check("https://openstax.org/books/biology-2e/pages/17-1") is None
    assert check("http://openstax.org") == "the url must start with https://"
    assert check("openstax.org") == "the url must start with https://"
    assert check("https://openstax.org/a page") == '"https://openstax.org/a page" is not a url'
    assert check(7) == "7 is not a url"


def test_seconds_reads_a_timestamp_or_answers_none() -> None:
    assert seconds("7:45") == 465
    assert seconds("1:07:45") == 4065
    assert seconds("0:00") == 0
    assert seconds("7:45.5") is None
    assert seconds("the middle") is None
