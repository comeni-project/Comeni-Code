// GET /api/health (M0 part 7 spec, P7.3). 200 and 503 both carry a HealthOut: 503 is an answer.
import { ApiUnreachable, getJson } from "./client";
import type { HealthOut } from "./schema";

export const HEALTH_URL = "/api/health";

export async function fetchHealth(signal?: AbortSignal): Promise<HealthOut> {
  const body = await getJson<unknown>(HEALTH_URL, signal, [503]);
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
