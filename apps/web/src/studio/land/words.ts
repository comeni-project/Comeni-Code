// Land's small words: how long ago, how often, who, which file.
import type { FileChangeOut, MemberOut } from "../../api/schema";

export function ago(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function every(seconds: number): string {
  if (seconds % 60 !== 0) return `every ${seconds} seconds`;
  const minutes = seconds / 60;
  return minutes === 1 ? "every minute" : `every ${minutes} minutes`;
}

export const who = (member: MemberOut | null) =>
  member === null ? "a former member" : member.name || member.email;

const MARK = { new: "+", changed: "~", removed: "-" } as Record<string, string>;
export const fileLabel = (file: FileChangeOut) => `${MARK[file.change] ?? ""}${file.file}`;
