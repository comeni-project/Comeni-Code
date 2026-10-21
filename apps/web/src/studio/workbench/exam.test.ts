import { describe, expect, it } from "vitest";
import type { DraftNodeOut, ExamQuestionIn } from "../../api/schema";
import { examIn, newExamQuestion, sent, stemIn, testAskOf } from "./exam";
import { examQuestion, NODE } from "./fixtures";

describe("exam questions as the editor holds them", () => {
  it("names a new one by the first id free in both pools (CS0811)", () => {
    const node = {
      ...NODE,
      questions: [{ id: "k-mers-q1" }],
      exam: [examQuestion("k-mers-q2", "draft")],
    } as DraftNodeOut;
    const q = newExamQuestion("k-mers", node);
    expect(q.id).toBe("k-mers-q3");
    expect(q).toMatchObject({
      kind: "choice",
      title: "",
      stem: [{ kind: "text", markdown: "" }],
      level: null,
    });
    expect(q.options).toHaveLength(3);
  });

  it("turns a draft's question back into what the API takes", () => {
    const back = examIn(examQuestion("a", "approved", "choice"));
    expect(back.stem).toEqual([{ kind: "text", markdown: "What is a?\n" }]);
    expect(back).not.toHaveProperty("state");
    expect(back).not.toHaveProperty("stem_text");
    expect(back.options?.[2]).toEqual({
      text: "A clean path",
      right: false,
      misconception: "",
      plain: true,
    });
  });

  it("ends each stem block's last line and strips spaces at line ends (CS0823)", () => {
    expect(
      stemIn([
        { kind: "text", markdown: "One  \ntwo " },
        { kind: "sequence", letters: "ACG" },
      ]),
    ).toEqual([
      { kind: "text", markdown: "One\ntwo\n" },
      { kind: "sequence", letters: "ACG\n" },
    ]);
  });

  it("strips spaces at line ends in a sequence block too, as pasted letters bring them (#268)", () => {
    expect(stemIn([{ kind: "sequence", letters: "ACGT \nTTGA  " }])).toEqual([
      { kind: "sequence", letters: "ACGT\nTTGA\n" },
    ]);
  });

  it("drops empty lines from accepted answers and empty blocks from the stem", () => {
    const q: ExamQuestionIn = {
      ...examIn(examQuestion("a", "draft")),
      accept: ["x", ""],
      stem: [
        { kind: "text", markdown: "" },
        { kind: "text", markdown: "Hi" },
      ],
    };
    expect(sent(q)).toMatchObject({ accept: ["x"], stem: [{ kind: "text", markdown: "Hi\n" }] });
  });
});

describe("a question as a test asks it", () => {
  it("is drawn from what the editor holds, stem as sent", () => {
    const q: ExamQuestionIn = {
      ...examIn(examQuestion("a", "draft", "choice")),
      stem: [{ kind: "text", markdown: "Hi  " }],
    };
    expect(testAskOf(q)).toEqual({
      kind: "choice",
      stem: [{ kind: "text", markdown: "Hi\n" }],
      options: ["A bubble", "A tip", "A clean path"],
      unit: "",
      steps: [],
    });
  });
});

describe("a stem's images and figures (#369)", () => {
  it("keeps them, their caption's last line ended", () => {
    expect(
      stemIn([
        { kind: "text", markdown: "Two transcripts:" },
        { kind: "figure", file: "two-transcripts", caption: "Reads and lengths." },
        { kind: "image", file: "kmers.png", caption: "Three reads.\n" },
      ]),
    ).toEqual([
      { kind: "text", markdown: "Two transcripts:\n" },
      { kind: "figure", file: "two-transcripts", caption: "Reads and lengths.\n" },
      { kind: "image", file: "kmers.png", caption: "Three reads.\n" },
    ]);
  });
});
