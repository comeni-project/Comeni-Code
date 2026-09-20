// One way to read JSON from our API (M3 part 3 spec, M3P3.2).
//
// The API words its own failures — "The index has not been built yet.", "No topic with id 'x'." —
// so an error carries that sentence out to the page rather than a second vocabulary of ours.
// `health.ts` keeps its own fetch: 503 is an answer there, which is true nowhere else.

/** No usable answer from the API; `reason` is a sentence a page can print. */
export class ApiUnreachable extends Error {
  readonly reason: string;
  readonly status: number | undefined;

  constructor(reason: string, status?: number) {
    super(reason);
    this.name = "ApiUnreachable";
    this.reason = reason;
    this.status = status;
  }
}

function detailOf(body: unknown): string | undefined {
  if (typeof body === "object" && body !== null && "detail" in body) {
    const { detail } = body as { detail: unknown };
    if (typeof detail === "string" && detail.trim() !== "") return detail;
  }
  return undefined;
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: signal ?? null,
    });
  } catch {
    throw new ApiUnreachable("network error");
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiUnreachable("the response wasn't JSON", response.status);
  }
  if (!response.ok) {
    throw new ApiUnreachable(detailOf(body) ?? `HTTP ${response.status}`, response.status);
  }
  return body as T;
}
