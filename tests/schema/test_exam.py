"""A node's exam pool, in exam.yaml beside node.yaml (spec M4E.1, M4E.3).

Each refusal is pinned to the line `validate` prints, as the try questions' are. Nodes are built in
tmp_path, never read from the content repository.
"""

from pathlib import Path

from schema.content_helpers import SMALL_POOL, content_root, node_yaml

from code_schema.blocks import SequenceBlock
from code_schema.content import read_content
from code_schema.node import Level, read_node
from code_schema.questions import ChoiceAnswer, NumberAnswer, Option

REGIONS = {"sequence-analysis"}

BODY = """TPM is a share of the sample.

:::{try} tpm-units
:::

:::{misconception} TPM is not a count of reads
Equal reads do not mean equal TPM.
:::
"""

TRY = """try:
  - id: tpm-units
    kind: number
    ask: Across one sample, what do the TPM values add up to?
    answer: 1000000
    hints:
      - Think of the name, transcripts per what.
    rationale: TPM is scaled so a sample's shares add up to a million.
"""

CHOICE = """  - id: tpm-or-count
    kind: choice
    title: What does a transcript's TPM tell you?
    stem: What does a transcript's TPM tell you?
    level: foundations
    options:
      - text: Its share of the sample, corrected for length
        right: true
      - text: How many reads mapped to it
        misconception: TPM is not a count of reads
      - text: How long the transcript is
        plain: true
    rationale: TPM divides reads by length first, then scales, so it is a proportion.
"""


def number(question_id: str) -> str:
    return (
        f"  - id: {question_id}\n"
        "    kind: number\n"
        "    title: How many reads does a 2 kb transcript at 10 reads per kb collect?\n"
        "    stem: How many reads does a 2 kb transcript at 10 reads per kb collect?\n"
        "    answer: 20\n"
        "    rationale: Reads scale with length at a fixed rate.\n"
    )


POOL = "exam:\n" + CHOICE + number("reads-at-rate") + number("reads-again") + number("reads-more")


def make(tmp_path: Path, exam: str | None, *, try_field: str = "") -> Path:
    root = content_root(tmp_path)
    folder = root / "tpm"
    folder.mkdir()
    (folder / "node.yaml").write_text(node_yaml("TPM", "introductory") + try_field, "utf-8")
    body = BODY if try_field else BODY.replace(":::{try} tpm-units\n:::\n\n", "")
    (folder / "body.md").write_text(body, encoding="utf-8")
    if exam is not None:
        (folder / "exam.yaml").write_text(exam, encoding="utf-8")
    return folder


def lines(tmp_path: Path, exam: str | None, *, try_field: str = "") -> list[str]:
    folder = make(tmp_path, exam, try_field=try_field)
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    return [str(problem) for problem in problems]


def test_a_sound_pool_is_read_in_order(tmp_path: Path) -> None:
    folder = make(tmp_path, POOL, try_field=TRY)
    node, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert problems == []
    assert node is not None
    assert [question.id for question in node.exam] == [
        "tpm-or-count",
        "reads-at-rate",
        "reads-again",
        "reads-more",
    ]
    choice = node.exam[0]
    assert choice.kind == "choice" and choice.level is Level.FOUNDATIONS
    assert isinstance(choice.answer, ChoiceAnswer)
    assert choice.answer.options[1] == Option(
        text="How many reads mapped to it", misconception="TPM is not a count of reads"
    )
    assert node.exam[1].level is None
    assert node.exam[1].answer == NumberAnswer(value=20)
    assert node.questions[0].id == "tpm-units"


def test_a_node_without_a_pool_has_none(tmp_path: Path) -> None:
    node, problems = read_node(make(tmp_path, None), regions=REGIONS, root=tmp_path)
    assert problems == [] and node is not None and node.exam == ()


def test_the_file_must_be_a_mapping(tmp_path: Path) -> None:
    assert lines(tmp_path, "- 3\n") == [
        "tpm/exam.yaml: CS0003 the file must be a mapping of fields, not a list"
    ]


def test_the_file_holds_only_exam(tmp_path: Path) -> None:
    assert lines(tmp_path, POOL + "pool: 3\n") == [
        "tpm/exam.yaml:33: CS0801 unknown key `pool` in exam.yaml (exam)"
    ]


def test_the_file_needs_exam(tmp_path: Path) -> None:
    assert lines(tmp_path, "pool: 3\n") == [
        "tpm/exam.yaml: CS0802 exam.yaml has no exam: list",
        "tpm/exam.yaml:1: CS0801 unknown key `pool` in exam.yaml (exam)",
    ]


def test_exam_is_a_list(tmp_path: Path) -> None:
    assert lines(tmp_path, "exam: 3\n") == [
        "tpm/exam.yaml:1: exam: CS0803 must be a list of exam questions"
    ]


def test_an_empty_pool_is_refused(tmp_path: Path) -> None:
    assert lines(tmp_path, "exam: []\n") == [
        "tpm/exam.yaml:1: exam: CS0804 the pool is empty — delete exam.yaml instead"
    ]


def test_an_entry_must_be_a_question(tmp_path: Path) -> None:
    assert lines(tmp_path, POOL + "  - 3\n") == [
        "tpm/exam.yaml:1: exam: CS0805 3 is not a question"
    ]


def test_an_unknown_key_is_refused(tmp_path: Path) -> None:
    pool = POOL.replace("    level: foundations\n", "    hint: a hint\n")
    assert lines(tmp_path, pool) == [
        "tpm/exam.yaml:6: exam: CS0806 unknown key `hint` in an exam question "
        "(id, title, claim, kind, level, stem, options, answer, unit, tolerance, accept, exact, "
        "steps, rationale)"
    ]


def test_an_exam_question_has_no_hints(tmp_path: Path) -> None:
    pool = POOL.replace("    level: foundations\n", "    hints:\n      - Think of the name.\n")
    assert lines(tmp_path, pool) == [
        "tpm/exam.yaml:6: exam: CS0807 the exam question tpm-or-count has hints "
        "— a self-test gives none"
    ]


def test_an_unknown_option_key_is_refused(tmp_path: Path) -> None:
    pool = POOL.replace(
        "      - text: How long the transcript is\n", "      - text: How long\n        why: no\n"
    )
    assert lines(tmp_path, pool) == [
        "tpm/exam.yaml:13: exam: CS0808 unknown key `why` in an exam option "
        "(text, right, misconception, plain)"
    ]


def test_a_misconception_names_a_callout(tmp_path: Path) -> None:
    pool = POOL.replace(
        "misconception: TPM is not a count of reads", "misconception: TPM is a count"
    )
    assert lines(tmp_path, pool) == [
        "tpm/exam.yaml:11: exam: CS0809 `TPM is a count` names no misconception callout in body.md"
    ]


def test_the_right_option_has_no_misconception(tmp_path: Path) -> None:
    pool = POOL.replace(
        "        right: true\n",
        "        right: true\n        misconception: TPM is not a count of reads\n",
    )
    assert lines(tmp_path, pool) == [
        "tpm/exam.yaml:10: exam: CS0810 the right option of tpm-or-count names a misconception "
        "— only a wrong option can"
    ]


def test_an_id_is_not_also_a_try_question(tmp_path: Path) -> None:
    pool = POOL.replace("id: reads-more", "id: tpm-units")
    assert lines(tmp_path, pool, try_field=TRY) == [
        "tpm/exam.yaml:27: exam: CS0811 tpm-units is already a try question in node.yaml "
        "— a node's question ids are shared by both pools"
    ]


def test_a_pool_holds_at_most_forty(tmp_path: Path) -> None:
    pool = "exam:\n" + "".join(number(f"q{n}") for n in range(41))
    assert lines(tmp_path, pool) == [
        "tpm/exam.yaml:1: exam: CS0812 the pool has 41 questions (at most 40)"
    ]


def test_the_question_rules_are_shared(tmp_path: Path) -> None:
    pool = POOL.replace(
        "      - text: How long the transcript is\n",
        "      - text: How long\n        right: true\n",
    )
    assert lines(tmp_path, pool) == [
        "tpm/exam.yaml:1: exam: CS0329 the question tpm-or-count has two right options"
    ]


def test_a_level_is_one_of_five(tmp_path: Path) -> None:
    pool = POOL.replace("level: foundations", "level: degree")
    assert lines(tmp_path, pool) == [
        'tpm/exam.yaml:6: exam: CS0012 the level of tpm-or-count "degree" is not a level '
        "(first-steps, foundations, introductory, intermediate, advanced)"
    ]


def test_a_try_question_takes_no_level_or_misconception(tmp_path: Path) -> None:
    try_field = TRY.replace("    rationale:", "    level: foundations\n    rationale:")
    folder = make(tmp_path, None, try_field=try_field)
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert [problem.code for problem in problems] == ["CS0303"]


def test_a_near_miss_of_exam_yaml_is_reported(tmp_path: Path) -> None:
    folder = make(tmp_path, None)
    (folder / "exam.yml").write_text(POOL, encoding="utf-8")
    assert [str(problem) for problem in read_content(tmp_path).problems] == [
        "tpm/: CS0706 exam.yml is not read — did you mean exam.yaml?"
    ]


# Warnings (spec M4E.4): they are printed, and they never refuse.


def test_a_pool_of_three_warns_and_is_kept(tmp_path: Path) -> None:
    node, problems = read_node(make(tmp_path, SMALL_POOL), regions=REGIONS, root=tmp_path)
    assert [str(problem) for problem in problems] == [
        "tpm/exam.yaml:1: exam: CS0813 the pool has 3 questions "
        "— the node is left out of self-tests until it has 4"
    ]
    assert not problems[0].refuses
    assert node is not None and len(node.exam) == 3


def test_a_level_two_from_the_nodes_warns(tmp_path: Path) -> None:
    pool = POOL.replace("level: foundations", "level: advanced")
    node, problems = read_node(make(tmp_path, pool), regions=REGIONS, root=tmp_path)
    assert [str(problem) for problem in problems] == [
        "tpm/exam.yaml:6: exam: CS0814 tpm-or-count is at advanced, "
        "2 levels from the node's introductory"
    ]
    assert node is not None


def test_a_level_one_away_is_quiet(tmp_path: Path) -> None:
    assert lines(tmp_path, POOL.replace("level: foundations", "level: intermediate")) == []


def test_an_error_beside_a_warning_still_refuses(tmp_path: Path) -> None:
    pool = SMALL_POOL.replace("answer: 20\n", "answer: twenty\n", 1)
    node, problems = read_node(make(tmp_path, pool), regions=REGIONS, root=tmp_path)
    assert node is None
    assert [problem.code for problem in problems] == ["CS0813", "CS0312"]


# #149: one run reports everything wrong, and the bound of 40 is inclusive.


def test_an_earlier_problem_does_not_hide_a_misconception_check(tmp_path: Path) -> None:
    pool = POOL.replace("    level: foundations\n", "    hints:\n      - Think of the name.\n")
    pool = pool.replace(
        "        right: true\n",
        "        right: true\n        misconception: TPM is not a count of reads\n",
    )
    pool = pool.replace(
        "misconception: TPM is not a count of reads\n      - text: How long",
        "misconception: nope\n      - text: How long",
    )
    _, problems = read_node(make(tmp_path, pool), regions=REGIONS, root=tmp_path)
    assert [problem.code for problem in problems] == ["CS0807", "CS0810", "CS0809"]


def test_a_misconception_that_is_not_text_reads_plainly(tmp_path: Path) -> None:
    pool = POOL.replace("misconception: TPM is not a count of reads", "misconception: 5")
    assert lines(tmp_path, pool) == [
        "tpm/exam.yaml:11: exam: CS0007 a misconception in tpm-or-count: 5 is not text"
    ]


def test_a_pool_of_forty_is_accepted(tmp_path: Path) -> None:
    assert lines(tmp_path, "exam:\n" + "".join(number(f"q{n}") for n in range(40))) == []


# #150: the near miss is the file's name, not any YAML file that looks alike.


def test_a_data_file_that_merely_looks_alike_is_not_a_near_miss(tmp_path: Path) -> None:
    folder = make(tmp_path, None)
    for name in ("edam.yaml", "team.yaml", "beam.yaml", "example.yaml", "exam-figure.yaml"):
        (folder / name).write_text("data: 1\n", encoding="utf-8")
    assert read_content(tmp_path).problems == ()


def test_each_spelling_of_exam_yaml_is_a_near_miss(tmp_path: Path) -> None:
    folder = make(tmp_path, None)
    for name in ("exam.yml", "exams.yaml", "Exam.yaml"):
        (folder / name).write_text(POOL, encoding="utf-8")
    assert sorted(problem.message for problem in read_content(tmp_path).problems) == [
        "Exam.yaml is not read — did you mean exam.yaml?",
        "exam.yml is not read — did you mean exam.yaml?",
        "exams.yaml is not read — did you mean exam.yaml?",
    ]


def test_an_exam_yaml_that_is_not_utf8_is_refused(tmp_path: Path) -> None:
    folder = make(tmp_path, None)
    (folder / "exam.yaml").write_bytes(b"exam:\n  - id: caf\xe9\n")
    node, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    assert node is None
    assert [str(problem) for problem in problems] == ["tpm/exam.yaml: CS0022 the file is not UTF-8"]


# M4.8c: a question as the QuestionBuilder board draws it (spec M4Q.2–M4Q.4).

STEM_POOL = """exam:
  - id: mid-read-error
    title: Which mark does a mid-read error leave?
    claim: spots a bubble left by a mid-read error
    kind: choice
    stem: |
      One read has a wrong base in its middle.

      :::{sequence}
      ACGTAGCA
      :::
    options:
      - text: A bubble
        right: true
      - text: A tip
        misconception: TPM is not a count of reads
      - text: Nothing
        plain: true
    rationale: A wrong base mid-read leaves the path and rejoins it.
"""


def codes(tmp_path: Path, exam: str) -> list[str | None]:
    folder = make(tmp_path, exam, try_field=TRY)
    _, problems = read_node(folder, regions=REGIONS, root=tmp_path)
    return [problem.code for problem in problems]


def test_a_question_has_a_title_a_claim_and_a_stem(tmp_path: Path) -> None:
    node, _ = read_node(make(tmp_path, STEM_POOL, try_field=TRY), regions=REGIONS, root=tmp_path)
    assert node is not None
    question = node.exam[0]
    assert question.title == "Which mark does a mid-read error leave?"
    assert question.claim == "spots a bubble left by a mid-read error"
    assert question.blocks[1] == SequenceBlock("ACGTAGCA\n")


def test_a_question_needs_a_title(tmp_path: Path) -> None:
    untitled = STEM_POOL.replace("    title: Which mark does a mid-read error leave?\n", "")
    assert "CS0815" in codes(tmp_path, untitled)


def test_a_question_needs_a_stem(tmp_path: Path) -> None:
    stemless = (
        STEM_POOL.split("    stem: |")[0] + "    options:" + STEM_POOL.split("    options:")[1]
    )
    assert "CS0816" in codes(tmp_path, stemless)


def test_ask_is_not_an_exam_field(tmp_path: Path) -> None:
    asked = STEM_POOL.replace("    kind: choice\n", "    kind: choice\n    ask: Old?\n")
    assert "CS0806" in codes(tmp_path, asked)


def test_a_stem_holds_no_try_or_callout(tmp_path: Path) -> None:
    called = STEM_POOL.replace(
        "      :::{sequence}\n      ACGTAGCA\n      :::\n",
        "      :::{caveat} Careful\n      Not here.\n      :::\n",
    )
    assert "CS0817" in codes(tmp_path, called)


def test_a_stem_problem_is_reported_at_its_line(tmp_path: Path) -> None:
    broken = STEM_POOL.replace("      ACGTAGCA\n", "      ACGT-1\n")
    assert (
        "tpm/exam.yaml:9: CS0416 a sequence block holds only letters, spaces and line breaks"
        in (lines(tmp_path, broken, try_field=TRY))
    )


def test_an_exam_choice_offers_three_options(tmp_path: Path) -> None:
    two = STEM_POOL.replace("      - text: Nothing\n        plain: true\n", "")
    assert "CS0818" in codes(tmp_path, two)


def test_plain_and_a_misconception_are_one_or_the_other(tmp_path: Path) -> None:
    both = STEM_POOL.replace(
        "        misconception: TPM is not a count of reads\n",
        "        misconception: TPM is not a count of reads\n        plain: true\n",
    )
    assert "CS0819" in codes(tmp_path, both)


def test_the_right_option_is_not_plain(tmp_path: Path) -> None:
    plain_right = STEM_POOL.replace(
        "        right: true\n", "        right: true\n        plain: true\n"
    )
    assert "CS0820" in codes(tmp_path, plain_right)


def test_a_wrong_option_naming_nothing_is_a_warning(tmp_path: Path) -> None:
    silent = STEM_POOL.replace("        plain: true\n", "")
    node, problems = read_node(
        make(tmp_path, silent, try_field=TRY), regions=REGIONS, root=tmp_path
    )
    assert "CS0821" in [problem.code for problem in problems]
    assert node is not None  # a warning never refuses (M4E.4)


def test_plain_is_true_or_false(tmp_path: Path) -> None:
    assert "CS0822" in codes(tmp_path, STEM_POOL.replace("plain: true", "plain: sometimes"))


def test_a_stem_line_ending_in_spaces_or_holding_a_tab_is_refused(tmp_path: Path) -> None:
    """#264: YAML cannot write such a stem as `stem: |`, so it would land rewritten as an escaped
    string; it is refused instead, as CS0415 refuses what the blocks cannot carry."""
    spaced = STEM_POOL.replace(
        "      One read has a wrong base in its middle.\n",
        "      One read has a wrong base in its middle.  \n",
    )
    tabbed = STEM_POOL.replace("      ACGTAGCA\n", "      ACGT\tAGCA\n")
    assert (
        "tpm/exam.yaml:7: exam: CS0823 "
        "a line of mid-read-error's stem ends in spaces or holds a tab"
        in lines(tmp_path, spaced, try_field=TRY)
    )
    (tmp_path / "tabbed").mkdir()
    assert "CS0823" in codes(tmp_path / "tabbed", tabbed)


def test_every_stem_is_written_as_a_literal_block() -> None:
    from code_schema.writer import write_exam_yaml

    node = read_content(Path(__file__).resolve().parents[1] / "fixtures" / "salmon").nodes["tpm"]
    written = write_exam_yaml(node)
    assert written.count("    stem: |\n") == len(node.exam)
