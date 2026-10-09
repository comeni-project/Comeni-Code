// One way to read JSON from our API (M3 part 3 spec, M3P3.2).
//
// The API words its own failures — "The index has not been built yet.", "No topic with id 'x'." —
// so an error carries that sentence out to the page rather than a second vocabulary of ours.
// `health.ts` keeps its own fetch: 503 is an answer there, which is true nowhere else.

/**
 * No usable answer from the API; `reason` is a sentence a page can print, and `body` the error's
 * JSON when there was one (a refused save's problems, M4K.3).
 */
export class ApiUnreachable extends Error {
  readonly reason: string;
  readonly status: number | undefined;
  readonly body: unknown;

  constructor(reason: string, status?: number, body?: unknown) {
    super(reason);
    this.name = "ApiUnreachable";
    this.reason = reason;
    this.status = status;
    this.body = body;
  }
}

function detailOf(body: unknown): string | undefined {
  if (typeof body === "object" && body !== null && "detail" in body) {
    const { detail } = body as { detail: unknown };
    if (typeof detail === "string" && detail.trim() !== "") return detail;
  }
  return undefined;
}

/**
 * The JSON body of `url`. A status outside 2xx rejects with the API's own sentence, unless it is
 * one of `accept`: health answers 503 with a report worth reading.
 */
export async function getJson<T>(
  url: string,
  signal?: AbortSignal,
  accept: readonly number[] = [],
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: signal ?? null,
    });
  } catch {
    throw new ApiUnreachable("network error");
  }
  return readAnswer<T>(response, accept);
}

/** The JSON of an answer, or why there is none, as `getJson` and `sendJson` both read it. */
async function readAnswer<T>(response: Response, accept: readonly number[]): Promise<T> {
  const usable = response.ok || accept.includes(response.status);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // An error page that is not JSON (nginx's 502 while the API is down) is still its status.
    throw new ApiUnreachable(
      usable ? "the response wasn't JSON" : `HTTP ${response.status}`,
      response.status,
    );
  }
  if (!usable) {
    throw new ApiUnreachable(detailOf(body) ?? `HTTP ${response.status}`, response.status, body);
  }
  return body as T;
}

/**
 * Django's CSRF cookie, which every write carries back as `X-CSRFToken` (M4S.3). It is readable
 * on purpose; the session cookie is the HttpOnly one.
 */
export function csrfToken(): string {
  const prefix = "csrftoken=";
  const found = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return found === undefined ? "" : decodeURIComponent(found.slice(prefix.length));
}

/**
 * Write to the API (M4S.3): JSON in, JSON out (nothing for a 204), failures worded as `getJson`
 * words them; `accept` lists statuses whose body is an answer, not a failure.
 */
export async function sendJson<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
  accept: readonly number[] = [],
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken(),
      },
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch {
    throw new ApiUnreachable("network error");
  }
  // A write may answer 204, nothing; a read never should (health says "HTTP 204" for one).
  if (response.status === 204) return undefined as T;
  return readAnswer<T>(response, accept);
}

/**
 * What a page prints when a question failed: the API's own sentence when it answered (a 404's
 * "No topic with id …"), else that the API could not be reached, and why.
 */
export const sentenceOf = (error: Error): string =>
  error instanceof ApiUnreachable && error.status !== undefined
    ? error.reason
    : `Can't reach the API · ${error instanceof ApiUnreachable ? error.reason : "unexpected error"}`;
