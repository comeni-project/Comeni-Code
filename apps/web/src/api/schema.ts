// Generated from apps/api/openapi.json by `npm run api-types`. Do not edit (M0 part 7 spec, P7.2).
export interface ApiSchemas {
  CheckOut: CheckOut;
  HealthOut: HealthOut;
  Message: Message;
  NeighbourOut: NeighbourOut;
  NodeOut: NodeOut;
  OptionOut: OptionOut;
  ProviderOut: ProviderOut;
  QuestionOut: QuestionOut;
  RegionOut: RegionOut;
  ResourceOut: ResourceOut;
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
  questions: QuestionOut[];
  region: RegionOut;
  related: NeighbourOut[];
  resources: ResourceOut[];
}
/**
 * A try question, its answer included: it is formative, and the page checks it (M3P1.4).
 *
 * Exam questions (T7.1) are scored, and their answers never leave the server.
 */
export interface QuestionOut {
  answer: number | null;
  ask: string;
  hints: string[];
  id: string;
  kind: string;
  options: OptionOut[] | null;
  rationale: string;
  tolerance: number | null;
  unit: string | null;
}
export interface OptionOut {
  right: boolean;
  text: string;
}
export interface RegionOut {
  id: string;
  name: string;
}
/**
 * One entry of the Learn it section (M3P1.2). Our sentence and a link, never their text.
 */
export interface ResourceOut {
  covers: string;
  display: string;
  kind: string;
  level: string;
  licence: string;
  part: string;
  provider: ProviderOut;
  url: string;
}
export interface ProviderOut {
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
