// The workbench tabs' card, note and hint, as the tab boards draw them (benchCard, benchNote,
// benchHint in .design/build_pages.mjs).
export const CARD =
  "flex flex-col gap-3.5 rounded-panel border border-border bg-surface px-5 py-[18px]";
export const NOTE = "text-[13px] leading-[1.5] text-ink-2";
export const HINT = "text-[12.5px] font-normal text-ink-3";
export const INPUT =
  "h-10 rounded-control border border-border-2 bg-surface px-3 text-[14px] font-normal text-ink outline-none focus:border-sel disabled:bg-bg disabled:text-ink-2";
/** An editor's label over its field, and the field's box (M4K.3). */
export const LABEL = "flex flex-col gap-1.5 text-[13px] font-medium";
export const BOX =
  "rounded-control border border-border-2 bg-surface px-3 py-2 text-[14px] font-normal outline-none focus:border-sel";
