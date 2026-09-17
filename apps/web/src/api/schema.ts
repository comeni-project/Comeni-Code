// Generated from apps/api/openapi.json by `npm run api-types`. Do not edit (M0 part 7 spec, P7.2).
export interface ApiSchemas {
  CheckOut: CheckOut;
  HealthOut: HealthOut;
}
export interface CheckOut {
  duration_ms: number;
  name: string;
  status: "ok" | "down";
}
export interface HealthOut {
  checks: CheckOut[];
  status: "ok" | "down";
}
