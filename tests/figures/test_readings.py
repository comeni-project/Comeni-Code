"""One reading for every figure file (M6.5 spec, M6CO.3): the plain forms PyYAML and YAML 1.2
read differently, written once as data."""

import re

import pytest

from code_figures import TWO_READINGS, two_readings


@pytest.mark.parametrize(
    ("plain", "form"),
    [
        ("yes", "a YAML 1.1 boolean"),
        ("No", "a YAML 1.1 boolean"),
        ("ON", "a YAML 1.1 boolean"),
        ("off", "a YAML 1.1 boolean"),
        ("1e3", "a number only YAML 1.2 reads"),
        ("012", "a number only YAML 1.2 reads"),
        ("00", "a number only YAML 1.2 reads"),
        (".5", "a number only YAML 1.2 reads"),
        ("-.5", "a number only YAML 1.2 reads"),
        ("1.5e3", "a number only YAML 1.2 reads"),
        ("1e+3", "a number only YAML 1.2 reads"),
        ("0o17", "a number only YAML 1.2 reads"),
        ("0x1f", "a number only YAML 1.2 reads"),
        ("+.inf", "a number only YAML 1.2 reads"),
        (".NaN", "a number only YAML 1.2 reads"),
        ("<<", "a merge key"),
        ("=", "a value key"),
    ],
)
def test_each_form_is_named(plain: str, form: str) -> None:
    assert two_readings(plain) == form


@pytest.mark.parametrize(
    "plain",
    [
        "1:30",
        "1:30.5",
        "~",
        "null",
        "true",
        "False",
        "2024-01-02",
        "1_000",
        "0b101",
        "0",
        "-12",
        "3.5",
        "-0.25",
        "1.",
        "1.0e+3",
        "6400",
        "k-mers",
        "y",
        "n",
    ],
)
def test_what_both_read_alike_is_allowed(plain: str) -> None:
    assert two_readings(plain) is None


def test_every_form_is_anchored_and_has_a_name() -> None:
    assert TWO_READINGS
    for form in TWO_READINGS:
        assert form.name and isinstance(form.pattern, re.Pattern)
        assert form.pattern.pattern.startswith("^") and form.pattern.pattern.endswith("$")
