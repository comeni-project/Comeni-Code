// Generated from packages/code-figures/src/code_figures/schemas/ by `npm run figure-types`.
// Do not edit (M6.4 spec, M6FG.2).
export const SCHEMAS = {
  "chart": {
    "$comment": "Vega-Lite, an allowlisted subset (M6.4 spec, M6FG.4). Every object is closed; anything not here is refused by its path. Widen only: a narrowing is a new component.",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "mark": {
        "$ref": "#/$defs/mark"
      },
      "data": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "values": {
            "type": "array",
            "maxItems": 2000,
            "items": {
              "type": "object",
              "additionalProperties": {
                "$ref": "#/$defs/cell"
              }
            }
          }
        },
        "required": [
          "values"
        ]
      },
      "encoding": {
        "$ref": "#/$defs/encoding"
      },
      "layer": {
        "type": "array",
        "minItems": 1,
        "maxItems": 4,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "mark": {
              "$ref": "#/$defs/mark"
            },
            "encoding": {
              "$ref": "#/$defs/encoding"
            }
          },
          "required": [
            "mark"
          ]
        }
      }
    },
    "required": [
      "data"
    ],
    "$defs": {
      "cell": {
        "oneOf": [
          {
            "type": "string",
            "maxLength": 200
          },
          {
            "type": "number"
          },
          {
            "type": "boolean"
          },
          {
            "type": "null"
          }
        ]
      },
      "markType": {
        "enum": [
          "bar",
          "line",
          "point",
          "area",
          "rule",
          "tick",
          "text"
        ]
      },
      "mark": {
        "oneOf": [
          {
            "type": "string",
            "enum": [
              "bar",
              "line",
              "point",
              "area",
              "rule",
              "tick",
              "text"
            ]
          },
          {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "type": {
                "$ref": "#/$defs/markType"
              },
              "point": {
                "type": "boolean"
              },
              "interpolate": {
                "enum": [
                  "linear",
                  "monotone",
                  "step"
                ]
              },
              "opacity": {
                "type": "number",
                "minimum": 0,
                "maximum": 1
              }
            },
            "required": [
              "type"
            ]
          }
        ]
      },
      "encoding": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "x": {
            "$ref": "#/$defs/channel"
          },
          "y": {
            "$ref": "#/$defs/channel"
          },
          "x2": {
            "$ref": "#/$defs/channel"
          },
          "y2": {
            "$ref": "#/$defs/channel"
          },
          "xOffset": {
            "$ref": "#/$defs/channel"
          },
          "color": {
            "$ref": "#/$defs/channel"
          },
          "size": {
            "$ref": "#/$defs/channel"
          },
          "shape": {
            "$ref": "#/$defs/channel"
          },
          "opacity": {
            "$ref": "#/$defs/channel"
          },
          "text": {
            "$ref": "#/$defs/channel"
          },
          "detail": {
            "$ref": "#/$defs/channel"
          },
          "row": {
            "$ref": "#/$defs/channel"
          },
          "column": {
            "$ref": "#/$defs/channel"
          }
        }
      },
      "channel": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "field": {
            "type": "string",
            "pattern": "^[A-Za-z_][A-Za-z0-9_ -]*$",
            "maxLength": 40
          },
          "type": {
            "enum": [
              "quantitative",
              "ordinal",
              "nominal",
              "temporal"
            ]
          },
          "aggregate": {
            "enum": [
              "count",
              "sum",
              "mean",
              "median",
              "min",
              "max"
            ]
          },
          "bin": {
            "oneOf": [
              {
                "type": "boolean"
              },
              {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "maxbins": {
                    "type": "integer",
                    "minimum": 2,
                    "maximum": 50
                  }
                }
              }
            ]
          },
          "timeUnit": {
            "enum": [
              "year",
              "month",
              "date",
              "day",
              "hours",
              "yearmonth",
              "yearmonthdate",
              "monthdate"
            ]
          },
          "sort": {
            "oneOf": [
              {
                "type": "string",
                "enum": [
                  "ascending",
                  "descending"
                ]
              },
              {
                "type": "null"
              },
              {
                "type": "array",
                "maxItems": 50,
                "items": {
                  "oneOf": [
                    {
                      "type": "string",
                      "maxLength": 200
                    },
                    {
                      "type": "number"
                    }
                  ]
                }
              }
            ]
          },
          "stack": {
            "oneOf": [
              {
                "type": "string",
                "enum": [
                  "zero",
                  "normalize",
                  "center"
                ]
              },
              {
                "type": "null"
              },
              {
                "type": "boolean"
              }
            ]
          },
          "title": {
            "type": "string",
            "maxLength": 80
          },
          "scale": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "zero": {
                "type": "boolean"
              },
              "domain": {
                "type": "array",
                "maxItems": 50,
                "items": {
                  "oneOf": [
                    {
                      "type": "string",
                      "maxLength": 200
                    },
                    {
                      "type": "number"
                    }
                  ]
                }
              },
              "type": {
                "enum": [
                  "linear",
                  "log",
                  "sqrt"
                ]
              }
            }
          },
          "axis": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "title": {
                    "type": "string",
                    "maxLength": 80
                  },
                  "format": {
                    "type": "string",
                    "pattern": "^[0-9.,%$~+ (sdefgrx-]*$",
                    "maxLength": 20
                  },
                  "tickCount": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 20
                  }
                }
              },
              {
                "type": "null"
              }
            ]
          },
          "legend": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "title": {
                    "type": "string",
                    "maxLength": 80
                  }
                }
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "type"
        ]
      }
    }
  },
  "flow": {
    "$comment": "Boxes and arrows, laid out in the browser (M6.4 spec, M6FG.3).",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "nodes": {
        "type": "array",
        "minItems": 1,
        "maxItems": 20,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
              "maxLength": 40
            },
            "label": {
              "type": "string",
              "minLength": 1,
              "maxLength": 40
            },
            "group": {
              "type": "string",
              "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
              "maxLength": 40
            }
          },
          "required": [
            "id",
            "label"
          ]
        }
      },
      "edges": {
        "type": "array",
        "maxItems": 40,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "from": {
              "type": "string",
              "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
              "maxLength": 40
            },
            "to": {
              "type": "string",
              "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
              "maxLength": 40
            },
            "label": {
              "type": "string",
              "minLength": 1,
              "maxLength": 24
            }
          },
          "required": [
            "from",
            "to"
          ]
        }
      },
      "direction": {
        "enum": [
          "right",
          "down"
        ]
      },
      "groups": {
        "type": "array",
        "maxItems": 4,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
              "maxLength": 40
            },
            "label": {
              "type": "string",
              "minLength": 1,
              "maxLength": 40
            }
          },
          "required": [
            "id",
            "label"
          ]
        }
      }
    },
    "required": [
      "nodes",
      "edges"
    ]
  },
  "sequence-track": {
    "$comment": "A sequence, a ruler and features in lanes (M6.4 spec, M6FG.3). Positions are 1-based and inclusive.",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "alphabet": {
        "enum": [
          "dna",
          "rna",
          "protein"
        ]
      },
      "sequence": {
        "type": "string",
        "pattern": "^[A-Za-z]+$",
        "maxLength": 120
      },
      "length": {
        "type": "integer",
        "minimum": 1,
        "maximum": 100000
      },
      "features": {
        "type": "array",
        "maxItems": 30,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "start": {
              "type": "integer",
              "minimum": 1
            },
            "end": {
              "type": "integer",
              "minimum": 1
            },
            "label": {
              "type": "string",
              "minLength": 1,
              "maxLength": 40
            },
            "kind": {
              "enum": [
                "exon",
                "intron",
                "cds",
                "utr",
                "primer",
                "motif",
                "region"
              ]
            },
            "strand": {
              "enum": [
                "+",
                "-"
              ]
            }
          },
          "required": [
            "start",
            "end",
            "label",
            "kind"
          ]
        }
      }
    },
    "required": [
      "alphabet",
      "features"
    ]
  },
  "table": {
    "$comment": "A table that is a numbered, checked figure (M6.4 spec, M6FG.3).",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "columns": {
        "type": "array",
        "minItems": 1,
        "maxItems": 8,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "name": {
              "type": "string",
              "minLength": 1,
              "maxLength": 40
            },
            "type": {
              "enum": [
                "text",
                "number",
                "sequence"
              ]
            },
            "unit": {
              "type": "string",
              "maxLength": 20
            },
            "decimals": {
              "type": "integer",
              "minimum": 0,
              "maximum": 6
            }
          },
          "required": [
            "name",
            "type"
          ]
        }
      },
      "rows": {
        "type": "array",
        "maxItems": 50,
        "items": {
          "type": "array",
          "maxItems": 8,
          "items": {
            "oneOf": [
              {
                "type": "string",
                "maxLength": 200
              },
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      }
    },
    "required": [
      "columns",
      "rows"
    ]
  }
} as const;

export type Component = keyof typeof SCHEMAS;

export interface FigureData {
  "chart": ChartData;
  "flow": FlowData;
  "sequence-track": SequenceTrackData;
  "table": TableData;
}

export type Mark =
  | ("bar" | "line" | "point" | "area" | "rule" | "tick" | "text")
  | {
      type: MarkType;
      point?: boolean;
      interpolate?: "linear" | "monotone" | "step";
      opacity?: number;
    };
export type MarkType = "bar" | "line" | "point" | "area" | "rule" | "tick" | "text";
export type Cell = string | number | boolean | null;

export interface ChartData {
  mark?: Mark;
  data: {
    /**
     * @maxItems 2000
     */
    values: {
      [k: string]: Cell;
    }[];
  };
  encoding?: Encoding;
  /**
   * @minItems 1
   * @maxItems 4
   */
  layer?: [
    {
      mark: Mark;
      encoding?: Encoding;
    },
    ...{
      mark: Mark;
      encoding?: Encoding;
    }[],
  ];
}
export interface Encoding {
  x?: Channel;
  y?: Channel;
  x2?: Channel;
  y2?: Channel;
  xOffset?: Channel;
  color?: Channel;
  size?: Channel;
  shape?: Channel;
  opacity?: Channel;
  text?: Channel;
  detail?: Channel;
  row?: Channel;
  column?: Channel;
}
export interface Channel {
  field?: string;
  type: "quantitative" | "ordinal" | "nominal" | "temporal";
  aggregate?: "count" | "sum" | "mean" | "median" | "min" | "max";
  bin?:
    | boolean
    | {
        maxbins?: number;
      };
  timeUnit?:
    "year" | "month" | "date" | "day" | "hours" | "yearmonth" | "yearmonthdate" | "monthdate";
  sort?: ("ascending" | "descending") | null | (string | number)[];
  stack?: ("zero" | "normalize" | "center") | null | boolean;
  title?: string;
  scale?: {
    zero?: boolean;
    /**
     * @maxItems 50
     */
    domain?: (string | number)[];
    type?: "linear" | "log" | "sqrt";
  };
  axis?: {
    title?: string;
    format?: string;
    tickCount?: number;
  } | null;
  legend?: {
    title?: string;
  } | null;
}

export interface FlowData {
  /**
   * @minItems 1
   * @maxItems 20
   */
  nodes: [
    {
      id: string;
      label: string;
      group?: string;
    },
    ...{
      id: string;
      label: string;
      group?: string;
    }[],
  ];
  /**
   * @maxItems 40
   */
  edges: {
    from: string;
    to: string;
    label?: string;
  }[];
  direction?: "right" | "down";
  /**
   * @maxItems 4
   */
  groups?: {
    id: string;
    label: string;
  }[];
}

export interface SequenceTrackData {
  alphabet: "dna" | "rna" | "protein";
  sequence?: string;
  length?: number;
  /**
   * @maxItems 30
   */
  features: {
    start: number;
    end: number;
    label: string;
    kind: "exon" | "intron" | "cds" | "utr" | "primer" | "motif" | "region";
    strand?: "+" | "-";
  }[];
}

export interface TableData {
  /**
   * @minItems 1
   * @maxItems 8
   */
  columns: [
    {
      name: string;
      type: "text" | "number" | "sequence";
      unit?: string;
      decimals?: number;
    },
    ...{
      name: string;
      type: "text" | "number" | "sequence";
      unit?: string;
      decimals?: number;
    }[],
  ];
  /**
   * @maxItems 50
   */
  rows: (string | number | null)[][];
}
