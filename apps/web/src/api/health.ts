// GET /api/health (M0 part 7 spec, P7.3). 200 and 503 both carry a HealthOut: 503 is an answer.
import type { HealthOut } from "./schema";

export const HEALTH_URL = "/api/health";

/** The API gave no health answer; `reason` says why, in words. */
export class HealthUnreachable extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`Can't reach the API: ${reason}`);
    this.name = "HealthUnreachable";
    this.reason = reason;
  }
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthOut> {
  let response: Response;
  try {
    response = await fetch(HEALTH_URL, {
      headers: { Accept: "application/json" },
      signal: signal ?? null,
    });
  } catch {
    throw new HealthUnreachable("network error");
  }
  if (response.status !== 200 && response.status !== 503) {
    throw new HealthUnreachable(`HTTP ${response.status}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new HealthUnreachable("the response wasn't JSON");
  }
  if (!isHealthOut(body)) {
    throw new HealthUnreachable("the response wasn't a health report");
  }
  return body;
}

// The types come from openapi.json; this only guards against something else answering on /api.
function isHealthOut(body: unknown): body is HealthOut {
  return (
    typeof body === "object" &&
    body !== null &&
    "status" in body &&
    "checks" in body &&
    Array.isArray(body.checks)
  );
}
