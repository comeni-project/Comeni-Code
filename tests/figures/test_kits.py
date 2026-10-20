"""The four general kits: their data, checks and derived values (M6.4 spec, M6FG.3–M6FG.4)."""

from typing import Any

import pytest

from code_figures import CODES, COMPONENTS, derived, figure_findings


def codes(component: str, data: object) -> list[tuple[str, str]]:
    return [(f.code, f.path) for f in figure_findings(component, data)]


def test_an_unknown_component_is_cs1001() -> None:
    assert codes("pie", {}) == [("CS1001", "component")]


def test_the_registry_names_the_four_kits() -> None:
    assert sorted(COMPONENTS) == ["chart", "flow", "sequence-track", "table"]


@pytest.mark.parametrize("name", ["chart", "flow", "sequence-track", "table"])
def test_each_starter_is_valid(name: str) -> None:
    assert figure_findings(name, COMPONENTS[name].starter) == []


def test_codes_lists_every_code_the_package_writes() -> None:
    assert sorted(CODES) == [f"CS10{n:02}" for n in range(1, 12)]


# ── table ─────────────────────────────────────────────────────────────────────────────────────

TABLE: dict[str, Any] = {
    "columns": [
        {"name": "k", "type": "number"},
        {"name": "distinct k-mers", "type": "number"},
        {"name": "example", "type": "sequence"},
    ],
    "rows": [[3, 64, "ACG"], [5, 812, None]],
}


def test_a_table_is_valid() -> None:
    assert codes("table", TABLE) == []


def test_a_row_short_of_a_cell_is_cs1011() -> None:
    assert codes("table", {**TABLE, "rows": [[3, 64]]}) == [("CS1011", "data.rows[0]")]


def test_a_cell_of_the_wrong_type_is_cs1011() -> None:
    assert codes("table", {**TABLE, "rows": [["three", 64, "ACG"]]}) == [
        ("CS1011", "data.rows[0][0]")
    ]
    assert codes("table", {**TABLE, "rows": [[3, 64, "AC G"]]}) == [("CS1011", "data.rows[0][2]")]


def test_a_table_has_at_most_eight_columns_and_fifty_rows() -> None:
    wide = {"columns": [{"name": f"c{i}", "type": "text"} for i in range(9)], "rows": []}
    assert codes("table", wide) == [("CS1004", "data.columns")]
    long = {"columns": [{"name": "k", "type": "number"}], "rows": [[i] for i in range(51)]}
    assert codes("table", long) == [("CS1004", "data.rows")]


# ── chart ─────────────────────────────────────────────────────────────────────────────────────

CHART: dict[str, Any] = {
    "mark": {"type": "line", "point": True},
    "data": {
        "values": [
            {"k": 3, "genome": "simple", "kmers": 64},
            {"k": 5, "genome": "simple", "kmers": 812},
            {"k": 3, "genome": "repeat-rich", "kmers": 64},
        ]
    },
    "encoding": {
        "x": {"field": "k", "type": "quantitative"},
        "y": {"field": "kmers", "type": "quantitative", "title": "distinct k-mers"},
        "color": {"field": "genome", "type": "nominal"},
    },
}


def test_a_chart_is_valid() -> None:
    assert codes("chart", CHART) == []


@pytest.mark.parametrize(
    ("change", "where"),
    [
        (lambda d: d["encoding"].update(href={"field": "genome"}), "data.encoding.href"),
        (lambda d: d["data"].update(url="https://example.org/data.csv"), "data.data.url"),
        (lambda d: d.update(transform=[{"calculate": "1", "as": "x"}]), "data.transform"),
        (lambda d: d.update(params=[{"name": "p", "expr": "1"}]), "data.params"),
        (lambda d: d.update(config={"background": "red"}), "data.config"),
        (lambda d: d.update(usermeta={}), "data.usermeta"),
        (
            lambda d: d.update({"$schema": "https://vega.github.io/schema/vega-lite/v6.json"}),
            "data.$schema",
        ),
        (lambda d: d.update(width=900), "data.width"),
        (lambda d: d.update(title="A chart"), "data.title"),
        (
            lambda d: d["encoding"]["color"].update(scale={"scheme": "reds"}),
            "data.encoding.color.scale.scheme",
        ),
        (
            lambda d: d["encoding"]["color"].update(scale={"range": ["red"]}),
            "data.encoding.color.scale.range",
        ),
        (lambda d: d["encoding"].update(color={"value": "red"}), "data.encoding.color.value"),
        (
            lambda d: d["encoding"]["y"].update(condition={"test": "datum.k > 3"}),
            "data.encoding.y.condition",
        ),
    ],
)
def test_every_way_out_of_a_chart_is_refused_by_its_path(change: Any, where: str) -> None:
    data = {
        **CHART,
        "data": {**CHART["data"]},
        "encoding": {k: {**v} for k, v in CHART["encoding"].items()},
    }
    change(data)
    assert ("CS1002", where) in codes("chart", data)


def test_an_image_mark_is_refused() -> None:
    assert codes("chart", {**CHART, "mark": {"type": "image"}}) == [("CS1003", "data.mark.type")]
    assert codes("chart", {**CHART, "mark": "image"}) == [("CS1003", "data.mark")]


def test_a_field_that_is_no_column_is_cs1005() -> None:
    encoding = {**CHART["encoding"], "x": {"field": "length", "type": "quantitative"}}
    assert codes("chart", {**CHART, "encoding": encoding}) == [("CS1005", "data.encoding.x.field")]


def test_a_quantitative_field_of_text_is_cs1006() -> None:
    encoding = {**CHART["encoding"], "x": {"field": "genome", "type": "quantitative"}}
    assert codes("chart", {**CHART, "encoding": encoding}) == [("CS1006", "data.encoding.x.field")]


def test_a_temporal_field_takes_iso_dates() -> None:
    values = [{"day": "2026-10-20", "n": 1}, {"day": "2026-10-21T09:30", "n": 2}]
    encoding = {
        "x": {"field": "day", "type": "temporal"},
        "y": {"field": "n", "type": "quantitative"},
    }
    chart = {"mark": "bar", "data": {"values": values}, "encoding": encoding}
    assert codes("chart", chart) == []
    values[1]["day"] = "21 October"
    assert codes("chart", chart) == [("CS1006", "data.encoding.x.field")]


def test_chart_sparse_rows() -> None:
    """Review Focus 2: a field in some rows only is still a column; its gaps are never refused."""
    values = [{"k": 3, "kmers": 64}, {"k": 5}, {"k": 7, "kmers": None}]
    chart = {
        **CHART,
        "data": {"values": values},
        "encoding": {
            "x": {"field": "k", "type": "quantitative"},
            "y": {"field": "kmers", "type": "quantitative"},
        },
    }
    assert codes("chart", chart) == []


def test_a_count_needs_no_field_but_a_channel_needs_one_or_the_other() -> None:
    encoding = {
        "x": {"field": "genome", "type": "nominal"},
        "y": {"aggregate": "count", "type": "quantitative"},
    }
    assert codes("chart", {**CHART, "mark": "bar", "encoding": encoding}) == []
    encoding["y"] = {"type": "quantitative"}
    assert codes("chart", {**CHART, "mark": "bar", "encoding": encoding}) == [
        ("CS1003", "data.encoding.y")
    ]


def test_layers_share_the_data_and_a_chart_has_a_mark_or_layers() -> None:
    layer = {"mark": "line", "encoding": CHART["encoding"]}
    assert (
        codes("chart", {"data": CHART["data"], "layer": [layer, {**layer, "mark": "point"}]}) == []
    )
    assert codes("chart", {"data": CHART["data"]}) == [("CS1003", "data")]
    assert codes("chart", {**CHART, "layer": [layer]}) == [("CS1003", "data")]
    assert codes("chart", {"data": CHART["data"], "layer": [layer] * 5}) == [
        ("CS1004", "data.layer")
    ]


def test_a_chart_has_at_most_2000_rows_and_20_columns() -> None:
    many = {**CHART, "data": {"values": [{"k": i, "kmers": i} for i in range(2001)]}}
    assert ("CS1004", "data.data.values") in codes("chart", many)
    wide = {
        **CHART,
        "data": {"values": [{f"c{i}": i for i in range(21)} | {"k": 1, "kmers": 1, "genome": "g"}]},
    }
    assert ("CS1004", "data.data.values") in codes("chart", wide)


def test_a_long_string_cell_is_a_bound() -> None:
    values = [{"k": 3, "kmers": 64, "genome": "g" * 201}]
    assert codes("chart", {**CHART, "data": {"values": values}}) == [
        ("CS1004", "data.data.values[0].genome")
    ]


# ── flow ──────────────────────────────────────────────────────────────────────────────────────

FLOW: dict[str, Any] = {
    "nodes": [
        {"id": "reads", "label": "reads"},
        {"id": "kmers", "label": "k-mers", "group": "quant"},
        {"id": "em", "label": "EM", "group": "quant"},
    ],
    "edges": [{"from": "reads", "to": "kmers"}, {"from": "kmers", "to": "em", "label": "counts"}],
    "groups": [{"id": "quant", "label": "salmon quant"}],
}


def test_a_flow_is_valid() -> None:
    assert codes("flow", FLOW) == []
    assert codes("flow", {**FLOW, "direction": "down"}) == []


def test_an_edge_to_nothing_is_cs1007() -> None:
    edges = [*FLOW["edges"], {"from": "em", "to": "tpm"}]
    assert codes("flow", {**FLOW, "edges": edges}) == [("CS1007", "data.edges[2].to")]


def test_a_group_that_is_not_declared_is_cs1007() -> None:
    nodes = [*FLOW["nodes"], {"id": "tpm", "label": "TPM", "group": "after"}]
    assert codes("flow", {**FLOW, "nodes": nodes}) == [("CS1007", "data.nodes[3].group")]


def test_a_duplicate_id_is_cs1008() -> None:
    nodes = [*FLOW["nodes"], {"id": "em", "label": "again"}]
    assert codes("flow", {**FLOW, "nodes": nodes}) == [("CS1008", "data.nodes[3].id")]


def test_a_flow_has_at_most_twenty_nodes_and_short_labels() -> None:
    nodes = [{"id": f"n{i}", "label": "x"} for i in range(21)]
    assert codes("flow", {"nodes": nodes, "edges": []}) == [("CS1004", "data.nodes")]
    long = [{"id": "a", "label": "x" * 41}]
    assert codes("flow", {"nodes": long, "edges": []}) == [("CS1004", "data.nodes[0].label")]


def test_a_cycle_is_allowed() -> None:
    edges = [*FLOW["edges"], {"from": "em", "to": "reads"}]
    assert codes("flow", {**FLOW, "edges": edges}) == []


# ── sequence-track ────────────────────────────────────────────────────────────────────────────

TRACK: dict[str, Any] = {
    "alphabet": "dna",
    "sequence": "ATGGCGTACGTTAGCCTAGGTAAGTCCATGTTTCAGGATCCAGTACGTTAGGCATCGATAAG",  # 62
    "features": [
        {"start": 1, "end": 20, "label": "exon 1", "kind": "exon"},
        {"start": 21, "end": 38, "label": "intron", "kind": "intron"},
        {"start": 39, "end": 62, "label": "exon 2", "kind": "exon"},
        {"start": 5, "end": 24, "label": "forward primer", "kind": "primer", "strand": "+"},
    ],
}


def test_a_track_is_valid_and_its_lanes_are_computed() -> None:
    assert codes("sequence-track", TRACK) == []
    assert derived("sequence-track", TRACK) == {"lanes": [0, 0, 0, 1]}


def test_lanes_are_first_fit_by_start() -> None:
    features = [
        {"start": 10, "end": 20, "label": "b", "kind": "region"},
        {"start": 1, "end": 12, "label": "a", "kind": "region"},
        {"start": 21, "end": 30, "label": "c", "kind": "region"},
        {"start": 11, "end": 25, "label": "d", "kind": "region"},
    ]
    data = {"alphabet": "dna", "length": 30, "features": features}
    # By start: a (1–12) lane 0; b (10–20) lane 1; d (11–25) lane 2; c (21–30) lane 0 again.
    assert derived("sequence-track", data) == {"lanes": [1, 0, 0, 2]}


def test_a_letter_outside_the_alphabet_is_cs1010() -> None:
    assert codes("sequence-track", {**TRACK, "sequence": "ACGU", "features": []}) == [
        ("CS1010", "data.sequence")
    ]
    assert (
        codes("sequence-track", {**TRACK, "alphabet": "rna", "sequence": "acgu", "features": []})
        == []
    )
    assert (
        codes("sequence-track", {"alphabet": "protein", "sequence": "MKTAYIX", "features": []})
        == []
    )


def test_a_feature_past_the_end_is_cs1009() -> None:
    features = [{"start": 50, "end": 70, "label": "late", "kind": "exon"}]
    assert codes("sequence-track", {**TRACK, "features": features}) == [
        ("CS1009", "data.features[0].end")
    ]
    backwards = [{"start": 9, "end": 4, "label": "back", "kind": "exon"}]
    assert codes("sequence-track", {**TRACK, "features": backwards}) == [
        ("CS1009", "data.features[0].start")
    ]


def test_a_track_gives_its_sequence_or_its_length() -> None:
    assert codes("sequence-track", {"alphabet": "dna", "length": 100_000, "features": []}) == []
    assert codes("sequence-track", {"alphabet": "dna", "features": []}) == [("CS1003", "data")]
    both = {"alphabet": "dna", "sequence": "ACGT", "length": 4, "features": []}
    assert codes("sequence-track", both) == [("CS1003", "data")]
    assert codes("sequence-track", {**TRACK, "sequence": "A" * 121}) == [
        ("CS1004", "data.sequence")
    ]


def test_a_chart_colours_at_most_three_series() -> None:
    """The series palette has three hues that pass every colour check against both surfaces;
    a fourth would be cycled, which the colour rules forbid (M6FG.3)."""
    four = [{"k": 3, "kmers": 1, "genome": g} for g in ("a", "b", "c", "d")]
    assert codes("chart", {**CHART, "data": {"values": four}}) == [
        ("CS1004", "data.encoding.color.field")
    ]
    assert codes("chart", {**CHART, "data": {"values": four[:3]}}) == []
