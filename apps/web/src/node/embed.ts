// Playing a resource in the page (M3P5.3).

/** Seconds in `m:ss` or `h:mm:ss`, as code_schema.fields.seconds reads a part. */
function seconds(stamp: string): number | null {
  const parts = stamp.trim().split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

/**
 * Where the player for `video` (`player:id`) plays from, starting and ending at `part` when
 * there is one. youtube-nocookie keeps YouTube's cookies off the page until the learner plays.
 */
export function playerSrc(video: string, part: string): string | null {
  const [player, id] = video.split(":");
  if (player !== "youtube" || id === undefined || id === "") return null;
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  const [from, to] = part.split(/[–-]/).map(seconds);
  if (from === null || from === undefined || to === null || to === undefined) return src;
  return `${src}?${new URLSearchParams({ start: String(from), end: String(to) })}`;
}
