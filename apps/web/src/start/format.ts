// The words the route command already uses (code_weaver/cli.py: _shown_time, _shown_level), so
// the page and the terminal say the same thing about the same route (M3 part 3 spec).

export function shownTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `about ${minutes} min`;
  return rest === 0 ? `about ${hours} h` : `about ${hours} h ${rest} min`;
}

export function shownLevel(level: string): string {
  const words = level.replace("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const shownStops = (count: number) => `${count} ${count === 1 ? "stop" : "stops"}`;
