// `flow` (M6FG.3), as the board's Figure 3: boxes and arrows laid out by `layoutFlow`, a group as
// a dashed box with its label beneath, drawn in our tokens. Arrows are ink-3: teal and blue keep
// their meanings (W10).
import { useId } from "react";
import { layoutFlow } from "./flow/layout";
import type { KitProps } from "./registry";

export function FlowFigure({ data, alt }: KitProps<"flow">) {
  const laid = layoutFlow(data);
  const arrow = `arrow-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox={`0 0 ${laid.width} ${laid.height}`}
      width="100%"
      style={{ maxWidth: laid.width }}
      role="img"
      aria-label={alt}
      className="mx-auto block"
    >
      <defs>
        <marker
          id={arrow}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0L10 5L0 10z" style={{ fill: "var(--ink-3)" }} />
        </marker>
      </defs>
      {laid.groups.map((group) => (
        <g key={group.id}>
          <rect
            x={group.x}
            y={group.y}
            width={group.w}
            height={group.h}
            rx={12}
            style={{
              fill: "none",
              stroke: "var(--border-2)",
              strokeWidth: 1.5,
              strokeDasharray: "5 4",
            }}
          />
          <text
            x={group.x + 12}
            y={group.y + group.h - 8}
            className="font-mono"
            style={{ fontSize: 11, fill: "var(--ink-3)" }}
          >
            {group.label}
          </text>
        </g>
      ))}
      {laid.paths.map((path, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: two edges may join the same boxes
        <g key={i} data-edge="">
          <path
            d={path.d}
            markerEnd={`url(#${arrow})`}
            style={{ fill: "none", stroke: "var(--ink-3)", strokeWidth: 1.6 }}
          />
          {path.label && path.labelAt && (
            <text
              x={path.labelAt.x}
              y={path.labelAt.y + 4}
              textAnchor="middle"
              style={{ fontSize: 11, fill: "var(--ink-2)" }}
            >
              {path.label}
            </text>
          )}
        </g>
      ))}
      {laid.boxes.map((box) => (
        <g key={box.id} data-box="">
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            rx={9}
            style={{ fill: "var(--surface)", stroke: "var(--ink-2)", strokeWidth: 1.5 }}
          />
          {box.lines.map((line, i) => (
            <text
              key={line}
              x={box.x + box.w / 2}
              y={box.y + box.h / 2 + 4 + (i - (box.lines.length - 1) / 2) * 15}
              textAnchor="middle"
              style={{ fontSize: 12.5, fill: "var(--ink)" }}
            >
              {line}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}
