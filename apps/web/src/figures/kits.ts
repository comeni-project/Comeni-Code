// Each kit's own checks, its starter data and what it derives: the twins of code_figures/table.py,
// chart.py, flow.py and track.py (M6.4 spec, M6FG.3; M6.5 spec, M6CO.5), and of the de Bruijn
// kits in domain/ (M6.6a spec, M6DC.1–M6DC.3). Same codes, paths and
// messages; tests/fixtures/figures/cases.json holds both to them, so the composer refuses exactly
// what the server would.
import * as compareGraphs from "./domain/compareGraphs";
import * as graphArtifacts from "./domain/graphArtifacts";
import * as kmerGraph from "./domain/kmerGraph";
import * as kmerWindow from "./domain/kmerWindow";
import * as readTiling from "./domain/readTiling";
import { type Component, type FigureData, SCHEMAS } from "./schemas";
import { type Finding, validate } from "./validate";

type Data = Record<string, unknown>;
type Item = Record<string, unknown>;

const UNKNOWN = "CS1001";
const WRONG = "CS1003";
const BOUND = "CS1004";
const NO_COLUMN = "CS1005";
const NOT_ITS_TYPE = "CS1006";
const MISSING = "CS1007";
const TWICE = "CS1008";
const OUT = "CS1009";
const LETTER = "CS1010";
const ROW = "CS1011";

/** Every code the composer can show for a figure: these, and the file's own (read.ts). */
export const CODES: ReadonlySet<string> = new Set([
  UNKNOWN,
  "CS1002",
  WRONG,
  BOUND,
  NO_COLUMN,
  NOT_ITS_TYPE,
  MISSING,
  TWICE,
  OUT,
  LETTER,
  ROW,
  "CS1012",
  "CS1013",
  "CS1014",
  "CS1015",
  "CS1016",
  "CS1023",
  "CS1024",
  "CS1025",
  "CS1026",
  "CS1027",
]);

export const STARTERS: { [C in Component]: FigureData[C] } = {
  chart: {
    mark: "bar",
    data: {
      values: [
        { k: 3, n: 64 },
        { k: 5, n: 812 },
        { k: 7, n: 3904 },
      ],
    },
    encoding: {
      x: { field: "k", type: "ordinal" },
      y: { field: "n", type: "quantitative" },
    },
  },
  "compare-graphs": { reads: [{ sequence: "ACGTT" }], k: 3 },
  "graph-artifacts": {
    reads: [
      { sequence: "ACGTTAGC" },
      { sequence: "ACGTTAGC" },
      { sequence: "ACGTCAGC" },
      { sequence: "ACGTTAGG" },
    ],
    k: 3,
  },
  "kmer-graph": {
    reads: [
      { sequence: "ACGTT" },
      { sequence: "CGTTA" },
      { sequence: "GTTAG" },
      { sequence: "CGTC", note: "another read — a branch" },
    ],
    k: 3,
    highlight: "path",
    path: [1, 3],
    spell: "shown",
  },
  "kmer-window": { read: "ACGTTAGCAT", k: 4, range: [3, 7] },
  "read-tiling": {
    genome: "ATGCGTACGTTAGCCTAGGATCCAGTACGTTAGGCATCGA",
    reads: [
      { sequence: "ATGCGTACG" },
      { sequence: "TACGTTAGC" },
      { sequence: "AGCCTAGGA" },
      { sequence: "AGGATCCAG" },
      { sequence: "CCAGTACGT" },
      { sequence: "CGTTAGGCA" },
      { sequence: "AGGCATCGA" },
    ],
  },
  flow: {
    nodes: [
      { id: "reads", label: "reads" },
      { id: "k-mers", label: "k-mers" },
    ],
    edges: [{ from: "reads", to: "k-mers" }],
  },
  "sequence-track": {
    alphabet: "dna",
    sequence: "ATGGCGTACGTTAGCCTAGG",
    features: [{ start: 1, end: 12, label: "exon 1", kind: "exon" }],
  },
  table: {
    columns: [
      { name: "k", type: "number" },
      { name: "k-mers", type: "number" },
    ],
    rows: [
      [3, 64],
      [5, 812],
    ],
  },
};

const isNumber = (value: unknown) => typeof value === "number";

// ── table ────────────────────────────────────────────────────────────────────────────────────

function fitsColumn(kind: unknown, cell: unknown): boolean {
  if (cell === null) return true; // an empty cell
  if (kind === "number") return isNumber(cell);
  if (kind === "sequence") return typeof cell === "string" && /^[A-Za-z]+$/.test(cell);
  return typeof cell === "string";
}

function table(data: Data): Finding[] {
  const kinds = (data.columns as Item[]).map((column) => column.type);
  return (data.rows as unknown[][]).flatMap((row, at) => {
    if (row.length !== kinds.length) {
      return [
        {
          code: ROW,
          path: `data.rows[${at}]`,
          message: `has ${row.length} cells, not ${kinds.length}`,
        },
      ];
    }
    return row.flatMap((cell, column) =>
      fitsColumn(kinds[column], cell)
        ? []
        : [
            {
              code: ROW,
              path: `data.rows[${at}][${column}]`,
              message: `is not a ${String(kinds[column])}, as its column is`,
            },
          ],
    );
  });
}

// ── chart ────────────────────────────────────────────────────────────────────────────────────

const MAX_COLUMNS = 20;
const MAX_SERIES = 3;
const DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

function* encodings(data: Data): Generator<[string, Item]> {
  const encoding = data.encoding;
  if (encoding !== null && typeof encoding === "object") yield ["data.encoding", encoding as Item];
  for (const [at, layer] of ((data.layer ?? []) as Item[]).entries()) {
    const own = layer.encoding;
    if (own !== null && typeof own === "object") yield [`data.layer[${at}].encoding`, own as Item];
  }
}

function fitsType(kind: unknown, value: unknown): boolean {
  if (value === undefined || value === null) return true; // a gap
  if (kind === "quantitative") return isNumber(value);
  if (kind === "temporal") return typeof value === "string" && DATE.test(value);
  return true;
}

function chart(data: Data): Finding[] {
  if (Object.hasOwn(data, "mark") === Object.hasOwn(data, "layer")) {
    return [
      {
        code: WRONG,
        path: "data",
        message: "has a mark and an encoding, or layers: one of the two",
      },
    ];
  }
  if (Object.hasOwn(data, "mark") && !Object.hasOwn(data, "encoding")) {
    return [{ code: WRONG, path: "data.encoding", message: "is required with a mark" }];
  }
  const rows = (data.data as Item).values as Item[];
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (columns.length > MAX_COLUMNS) {
    return [
      { code: BOUND, path: "data.data.values", message: `has more than ${MAX_COLUMNS} columns` },
    ];
  }
  const found: Finding[] = [];
  for (const [where, encoding] of encodings(data)) {
    for (const [channel, given] of Object.entries(encoding)) {
      const spec = given as Item;
      const at = `${where}.${channel}`;
      const field = spec.field;
      if (field === undefined || field === null) {
        if (spec.aggregate !== "count") {
          found.push({
            code: WRONG,
            path: at,
            message: "names a field, or counts (aggregate: count)",
          });
        }
        continue;
      }
      const name = String(field);
      if (!columns.includes(name)) {
        found.push({ code: NO_COLUMN, path: `${at}.field`, message: `${name} is not a column` });
      } else if (!rows.every((row) => fitsType(spec.type, row[name]))) {
        found.push({
          code: NOT_ITS_TYPE,
          path: `${at}.field`,
          message: `${name} is not ${String(spec.type)}`,
        });
      } else if (channel === "color") {
        const series = new Set(
          rows.map((row) => row[name]).filter((v) => v !== undefined && v !== null),
        );
        if (series.size > MAX_SERIES) {
          found.push({
            code: BOUND,
            path: `${at}.field`,
            message: `${name} names ${series.size} series; a chart colours at most ${MAX_SERIES}`,
          });
        }
      }
    }
  }
  return found;
}

// ── flow ─────────────────────────────────────────────────────────────────────────────────────

function ids(items: Item[], where: string): [Set<unknown>, Finding[]] {
  const seen = new Set<unknown>();
  const found: Finding[] = [];
  items.forEach((item, at) => {
    if (seen.has(item.id)) {
      found.push({
        code: TWICE,
        path: `${where}[${at}].id`,
        message: `${String(item.id)} is used twice`,
      });
    }
    seen.add(item.id);
  });
  return [seen, found];
}

function flow(data: Data): Finding[] {
  const nodes = data.nodes as Item[];
  const [names, found] = ids(nodes, "data.nodes");
  const [groups, twice] = ids((data.groups ?? []) as Item[], "data.groups");
  found.push(...twice);
  nodes.forEach((node, at) => {
    if (Object.hasOwn(node, "group") && !groups.has(node.group)) {
      found.push({
        code: MISSING,
        path: `data.nodes[${at}].group`,
        message: `no group is ${String(node.group)}`,
      });
    }
  });
  (data.edges as Item[]).forEach((edge, at) => {
    for (const end of ["from", "to"]) {
      if (!names.has(edge[end])) {
        found.push({
          code: MISSING,
          path: `data.edges[${at}].${end}`,
          message: `no node is ${String(edge[end])}`,
        });
      }
    }
  });
  return found;
}

// ── sequence-track ───────────────────────────────────────────────────────────────────────────

const ALPHABETS: Record<string, string> = {
  dna: "ACGTN",
  rna: "ACGUN",
  protein: "ACDEFGHIKLMNPQRSTVWYX",
};

function track(data: Data): Finding[] {
  const sequence = data.sequence;
  let length = data.length;
  if ((sequence === undefined) === (length === undefined)) {
    return [
      { code: WRONG, path: "data", message: "gives its sequence or its length, one of the two" },
    ];
  }
  const found: Finding[] = [];
  if (typeof sequence === "string") {
    const letters = ALPHABETS[String(data.alphabet)] ?? "";
    const strays = [...new Set(sequence.toUpperCase())]
      .filter((ch) => !letters.includes(ch))
      .sort();
    if (strays.length > 0) {
      found.push({
        code: LETTER,
        path: "data.sequence",
        message: `${strays.join("")} is not ${String(data.alphabet)}`,
      });
    }
    length = sequence.length;
  }
  (data.features as Item[]).forEach((feature, at) => {
    const start = feature.start as number;
    const end = feature.end as number;
    if (start > end) {
      found.push({
        code: OUT,
        path: `data.features[${at}].start`,
        message: `starts after it ends (${end})`,
      });
    } else if (end > (length as number)) {
      found.push({
        code: OUT,
        path: `data.features[${at}].end`,
        message: `ends past the sequence (${length})`,
      });
    }
  });
  return found;
}

const CHECKS: { [C in Component]: (data: Data) => Finding[] } = {
  chart,
  "compare-graphs": compareGraphs.check,
  flow,
  "graph-artifacts": graphArtifacts.check,
  "kmer-graph": kmerGraph.check,
  "kmer-window": kmerWindow.check,
  "read-tiling": readTiling.check,
  "sequence-track": track,
  table,
};

const isComponent = (name: string): name is Component => Object.hasOwn(SCHEMAS, name);

/** The schema's findings; the kit's own checks only once the schema has none (registry.py). */
export function figureFindings(component: string, data: unknown): Finding[] {
  if (!isComponent(component)) {
    const named = Object.keys(SCHEMAS).sort().join(", ");
    return [
      { code: UNKNOWN, path: "component", message: `${component} is not a component (${named})` },
    ];
  }
  const problems = validate(SCHEMAS[component], data);
  if (problems.length > 0 || data === null || typeof data !== "object" || Array.isArray(data)) {
    return problems;
  }
  return CHECKS[component](data as Data);
}

const DERIVES: Partial<{ [C in Component]: (data: Data) => Record<string, unknown> }> = {
  "compare-graphs": compareGraphs.derive,
  "graph-artifacts": graphArtifacts.derive,
  "kmer-graph": kmerGraph.derive,
  "kmer-window": kmerWindow.derive,
  "read-tiling": readTiling.derive,
  "sequence-track": lanes,
};

/** What the page draws and nobody writes; only for data with no findings (registry.py). */
export function derive(component: Component, data: unknown): Record<string, unknown> {
  return DERIVES[component]?.(data as Data) ?? {};
}

/** A track's lanes, first fit by start (track.py). */
function lanes(data: Data): Record<string, unknown> {
  const features = data.features as Item[];
  const order = features.map((_, at) => at);
  order.sort((a, b) => (features[a]?.start as number) - (features[b]?.start as number) || a - b);
  const ends: number[] = [];
  const lanes = features.map(() => 0);
  for (const at of order) {
    const start = features[at]?.start as number;
    const end = features[at]?.end as number;
    let lane = ends.findIndex((last) => last < start);
    if (lane === -1) {
      lane = ends.length;
      ends.push(end);
    } else {
      ends[lane] = end;
    }
    lanes[at] = lane;
  }
  return { lanes };
}
