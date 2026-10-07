// Where to go after signing in: a path on this site, never back to an account page.
const ACCOUNT_PAGES = ["/sign-in", "/join", "/reset-password"];

export function safeNext(raw: string | null): string {
  if (raw === null || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return ACCOUNT_PAGES.some((page) => raw === page || raw.startsWith(`${page}/`)) ? "/" : raw;
}
