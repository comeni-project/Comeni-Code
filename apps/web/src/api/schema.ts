// Generated from apps/api/openapi.json by `npm run api-types`. Do not edit (M0 part 7 spec, P7.2).
/**
 * In rank order: each role includes the ones before it.
 */
export type Role = "author" | "reviewer" | "operator";

export interface ApiSchemas {
  CalloutBlockOut: CalloutBlockOut;
  CheckOut: CheckOut;
  HealthOut: HealthOut;
  InviteIn: InviteIn;
  InviteOut: InviteOut;
  MeOut: MeOut;
  MemberOut: MemberOut;
  Message: Message;
  NeighbourOut: NeighbourOut;
  NodeOut: NodeOut;
  OptionOut: OptionOut;
  PendingInviteOut: PendingInviteOut;
  ProviderOut: ProviderOut;
  QuestionOut: QuestionOut;
  RegionOut: RegionOut;
  ResourceOut: ResourceOut;
  ResultOut: ResultOut;
  Role: Role;
  RouteOut: RouteOut;
  SearchOut: SearchOut;
  SideCardOut: SideCardOut;
  SpanOut: SpanOut;
  StopOut: StopOut;
  TextBlockOut: TextBlockOut;
  TryBlockOut: TryBlockOut;
}
export interface CalloutBlockOut {
  callout: "misconception" | "caveat" | "convention";
  kind: "callout";
  markdown: string;
  title: string;
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
export interface InviteIn {
  email: string;
  role: Role;
}
/**
 * What an invitee sees before signing up.
 */
export interface InviteOut {
  email: string;
  role: string;
}
export interface MeOut {
  user: MemberOut | null;
}
/**
 * A member, named by public id; the integer key never leaves the database (M4A.1).
 */
export interface MemberOut {
  email: string;
  name: string;
  public_id: string;
  role: string;
}
/**
 * An error answer: the sentence a person reads, and its diagnostic code (spec M4D.4).
 */
export interface Message {
  code: string;
  detail: string;
}
/**
 * A neighbour as a card: enough for a node page's side panel (L5) without another request.
 */
export interface NeighbourOut {
  id: string;
  level: string;
  reason: string;
  title: string;
}
export interface NodeOut {
  blocks: (TextBlockOut | TryBlockOut | CalloutBlockOut)[];
  claim: string;
  folder: string;
  goes_deeper: SideCardOut[];
  id: string;
  level: string;
  minutes: number;
  needed_by: SideCardOut[];
  needs: SideCardOut[];
  questions: QuestionOut[];
  region: RegionOut;
  related: SideCardOut[];
  resources: ResourceOut[];
  title: string;
}
export interface TextBlockOut {
  kind: "text";
  markdown: string;
}
/**
 * Where a try question sits; the question itself is in `questions`.
 */
export interface TryBlockOut {
  kind: "try";
  question: string;
}
/**
 * A neighbour on the node page, with its time: the L5 side column's *level · N min*.
 */
export interface SideCardOut {
  id: string;
  level: string;
  minutes: number;
  reason: string;
  title: string;
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
  video: string | null;
}
export interface ProviderOut {
  id: string;
  name: string;
}
export interface PendingInviteOut {
  email: string;
  expires_at: string;
  public_id: string;
  role: string;
}
/**
 * A candidate as the Start board's *Is this what you mean?* panel shows it (L1).
 */
export interface ResultOut {
  claim: string;
  id: string;
  level: string;
  minutes: number;
  region: RegionOut;
  title: string;
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
  claim: string;
  id: string;
  level: string;
  minutes: number;
  needed_by: NeighbourOut[];
  region: RegionOut;
  title: string;
}
export interface SearchOut {
  query: string;
  results: ResultOut[];
  unmatched: string[];
}
