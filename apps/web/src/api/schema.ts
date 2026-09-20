// Generated from apps/api/openapi.json by `npm run api-types`. Do not edit (M0 part 7 spec, P7.2).
export interface ApiSchemas {
  CheckOut: CheckOut;
  HealthOut: HealthOut;
  Message: Message;
  NeighbourOut: NeighbourOut;
  NodeOut: NodeOut;
  RegionOut: RegionOut;
  RouteOut: RouteOut;
  SpanOut: SpanOut;
  StopOut: StopOut;
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
export interface Message {
  detail: string;
}
/**
 * A neighbour as a card: enough for a node page's side panel (L5) without another request.
 */
export interface NeighbourOut {
  id: string;
  level: string;
  reason: string;
}
export interface NodeOut {
  body: string;
  claim: string;
  folder: string;
  goes_deeper: NeighbourOut[];
  id: string;
  level: string;
  minutes: number;
  needed_by: NeighbourOut[];
  needs: NeighbourOut[];
  region: RegionOut;
  related: NeighbourOut[];
}
export interface RegionOut {
  id: string;
  name: string;
}
export interface RouteOut {
  goals: string[];
  known: string[];
  minutes: number;
  span: SpanOut;
  stops: StopOut[];
}
export interface SpanOut {
  highest: string;
  lowest: string;
}
/**
 * A stop as the Route board draws it (L4), with why it is on this route (M2P2.2).
 */
export interface StopOut {
  id: string;
  level: string;
  minutes: number;
  needed_by: NeighbourOut[];
  region: RegionOut;
}
