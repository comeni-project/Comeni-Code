"""{% try id %} in body.md, and every other marker (spec M3P1.3)."""

from code_schema.markers import find_markers

BODY = """Some prose.

{% try kmer-count %}

## A heading

```yaml
{% try not-a-marker %}
```

{% figure component="kmer-window" %}
"""


def test_a_marker_is_found_with_its_line() -> None:
    markers, _ = find_markers(BODY)
    assert [(marker.id, marker.line) for marker in markers] == [("kmer-count", 3)]


def test_a_marker_inside_a_fence_is_prose() -> None:
    markers, others = find_markers(BODY)
    assert "not-a-marker" not in [marker.id for marker in markers]


def test_another_marker_is_reported_with_its_line() -> None:
    _, others = find_markers(BODY)
    assert others == [('{% figure component="kmer-window" %}', 11)]


def test_a_marker_must_be_alone_on_its_line() -> None:
    markers, others = find_markers("Text {% try a %} more text.\n")
    assert markers == ()
    assert others == [("Text {% try a %} more text.", 1)]


def test_an_indented_marker_still_counts() -> None:
    markers, others = find_markers("   {% try a %}\n")
    assert [marker.id for marker in markers] == ["a"]
    assert others == []


def test_spacing_inside_the_braces_is_free() -> None:
    markers, _ = find_markers("{%try   kmer-count%}\n")
    assert [marker.id for marker in markers] == ["kmer-count"]


def test_a_tilde_fence_hides_a_marker_too() -> None:
    _, others = find_markers("~~~\n{% try a %}\n~~~\n")
    markers, _ = find_markers("~~~\n{% try a %}\n~~~\n")
    assert markers == ()
    assert others == []


def test_a_body_with_no_markers_gives_nothing() -> None:
    assert find_markers("Prose, and a { brace }.\n") == ((), [])
