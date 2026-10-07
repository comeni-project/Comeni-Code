// Where to go after signing in: a path on this site, never back to an account page.
//
// The address is parsed as a browser would, so a backslash or a tab that turns `/…` into `//host`
// cannot leave the site (#234), and an account page is matched however it is spelled.
const HERE = "http://code.invalid";
const ACCOUNT_PAGES = ["/sign-in", "/join", "/reset-password"];

function decoded(path: string): string | null {
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

export function safeNext(raw: string | null): string {
  if (raw === null || !raw.startsWith("/")) return "/";
  const url = new URL(raw, HERE);
  const path = decoded(url.pathname);
  // `/.//host` normalises to the path `//host`, which a browser reads as another site.
  if (url.origin !== HERE || path === null || url.pathname.startsWith("//")) return "/";
  const account = ACCOUNT_PAGES.some((page) => path === page || path.startsWith(`${page}/`));
  return account ? "/" : `${url.pathname}${url.search}${url.hash}`;
}
