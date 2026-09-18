"""The region registry (spec M1P1.3): the only file that is not a node."""

from pathlib import Path

from code_schema.regions import Region, parse_regions, read_regions

GOOD = """\
regions:
  - id: sequence-analysis
    name: Sequence analysis
  - id: molecular-biology
    name: Molecular biology
"""


def test_it_reads_the_registry() -> None:
    regions, problems = parse_regions(GOOD)
    assert problems == []
    assert regions == {
        "sequence-analysis": Region(id="sequence-analysis", name="Sequence analysis"),
        "molecular-biology": Region(id="molecular-biology", name="Molecular biology"),
    }


def test_a_bad_id_names_its_own_line() -> None:
    text = GOOD + "  - id: Cell Biology\n    name: Cell biology\n"
    _, problems = parse_regions(text)
    assert [str(p) for p in problems] == [
        'regions.yaml:6: id: "Cell Biology" is not a region id '
        "(lower case, digits and single hyphens)"
    ]


def test_a_repeated_id_names_the_repeat() -> None:
    text = GOOD + "  - id: sequence-analysis\n    name: Again\n"
    _, problems = parse_regions(text)
    assert [str(p) for p in problems] == ['regions.yaml:6: id: "sequence-analysis" is listed twice']


def test_a_missing_name_is_refused() -> None:
    _, problems = parse_regions("regions:\n  - id: genomics\n")
    assert [str(p) for p in problems] == ["regions.yaml:2: name: required field is missing"]


def test_regions_must_be_a_list_of_mappings() -> None:
    _, problems = parse_regions("regions: sequence-analysis\n")
    assert [str(p) for p in problems] == ["regions.yaml:1: regions: must be a list of regions"]


def test_an_entry_that_is_not_a_mapping_is_refused() -> None:
    _, problems = parse_regions("regions:\n  - genomics\n")
    assert [str(p) for p in problems] == ['regions.yaml: regions: "genomics" is not a region']


def test_read_regions_reports_a_missing_file(tmp_path: Path) -> None:
    regions, problems = read_regions(tmp_path)
    assert regions == {}
    assert [str(p) for p in problems] == ["regions.yaml: the file is missing"]


def test_read_regions_reads_the_file(tmp_path: Path) -> None:
    (tmp_path / "regions.yaml").write_text(GOOD, encoding="utf-8")
    regions, problems = read_regions(tmp_path)
    assert problems == []
    assert sorted(regions) == ["molecular-biology", "sequence-analysis"]
