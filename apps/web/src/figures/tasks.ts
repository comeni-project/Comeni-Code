// What a learner does with a figure that asks a question, and the answers it computes: the twin
// of code_figures/tasks.py (M6.6b spec, M6FA.2). A kit declares its tasks; each has a schema for
// its fields, a check against the figure's data, and the answer: `accept`, every selection that
// is right, and `wrong`, one that is not, for the composer to draw. A selection is the k-mers a
// learner picked, in order.
import { type Finding, type Schema, validate } from "./validate";

export const NO_TASK = "CS1028";

export type Data = Record<string, unknown>;
export type Fields = Record<string, unknown>;
export type Selection = string[];
export interface Answer {
  accept: Selection[];
  wrong: Selection;
}

export interface Task {
  /** What Interaction calls it, beside Nothing (M6FA.6). */
  label: string;
  /** What the learner does, in the step's words. */
  says: string;
  schema: Schema;
  check: (data: Data, derived: Record<string, unknown>, fields: Fields) => Finding[];
  answer: (data: Data, derived: Record<string, unknown>, fields: Fields) => Answer;
}

/** CS1028 when `interact` names no task of the kit or its fields do not fit; else nothing. */
export function fieldsFindings(tasks: Record<string, Task>, interact: unknown): Finding[] {
  if (interact === null || typeof interact !== "object" || Array.isArray(interact)) {
    return [{ code: NO_TASK, path: "interact", message: "must be a mapping that names its task" }];
  }
  if (!Object.hasOwn(interact, "task")) {
    return [{ code: NO_TASK, path: "interact", message: "must be a mapping that names its task" }];
  }
  const name = (interact as Fields).task;
  if (typeof name !== "string" || !Object.hasOwn(tasks, name)) {
    const named = Object.keys(tasks).sort().join(", ") || "none";
    return [
      {
        code: NO_TASK,
        path: "interact.task",
        message: `${String(name)} is not a task of this component (${named})`,
      },
    ];
  }
  return validate((tasks[name] as Task).schema, interact, "interact").map((found) => ({
    ...found,
    code: NO_TASK,
  }));
}
