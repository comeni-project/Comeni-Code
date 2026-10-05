// GET /api/health (M0 part 7 spec, P7.3). 200 and 503 both carry a HealthOut: 503 is an answer.
import { ApiUnreachable, getJson } from "./client";
import type { HealthOut } from "./schema";

export const HEALTH_URL = "/api/health";

/** Only these carry a report; any other answer is said by its status, whatever its body. */
const REPORTED = [200, 503];

export async function fetchHealth(signal?: AbortSignal): Promise<HealthOut> {
  let body: unknown;
  try {
    body = await getJson<unknown>(HEALTH_URL, signal, REPORTED);
  } catch (error) {
    const status = error instanceof ApiUnreachable ? error.status : undefined;
    if (status !== undefined && !REPORTED.includes(status)) {
      throw new ApiUnreachable(`HTTP ${status}`, status);
    }
    throw error;
  }
  if (!isHealthOut(body)) {
    throw new ApiUnreachable("the response wasn't a health report");
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
