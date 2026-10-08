// The Markdown toolbar's one operation (M4K.3): put marks around the selection and keep the
// selection on the same words, now inside the marks.
export function wrap(
  text: string,
  start: number,
  end: number,
  before: string,
  after: string,
): { text: string; start: number; end: number } {
  return {
    text: text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end),
    start: start + before.length,
    end: end + before.length,
  };
}
