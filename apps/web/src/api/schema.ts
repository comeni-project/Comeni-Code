// Generated from apps/api/openapi.json by `npm run api-types`. Do not edit (M0 part 7 spec, P7.2).
/**
 * T10.1's five. A level describes a node, never a learner.
 */
export type Level = "first-steps" | "foundations" | "introductory" | "intermediate" | "advanced";
/**
 * In rank order: each role includes the ones before it.
 */
export type Role = "author" | "reviewer" | "operator";

export interface ApiSchemas {
  BlockIn: BlockIn;
  CalloutBlockOut: CalloutBlockOut;
  CheckOut: CheckOut;
  ChecklistOut: ChecklistOut;
  DraftNodeOut: DraftNodeOut;
  DraftOut: DraftOut;
  DraftSummaryOut: DraftSummaryOut;
  ExamIn: ExamIn;
  ExamQuestionIn: ExamQuestionIn;
  FieldsIn: FieldsIn;
  FilesOut: FilesOut;
  HealthOut: HealthOut;
  InsertBlockIn: InsertBlockIn;
  InviteIn: InviteIn;
  InviteOut: InviteOut;
  ItemOut: ItemOut;
  Level: Level;
  LinkIn: LinkIn;
  LinkOut: LinkOut;
  LinksIn: LinksIn;
  MeOut: MeOut;
  MemberOut: MemberOut;
  Message: Message;
  MoveBlockIn: MoveBlockIn;
  NeighbourOut: NeighbourOut;
  NewNodeIn: NewNodeIn;
  NodeOut: NodeOut;
  OpenIn: OpenIn;
  OptionIn: OptionIn;
  OptionOut: OptionOut;
  PendingInviteOut: PendingInviteOut;
  ProblemOut: ProblemOut;
  ProviderOut: ProviderOut;
  QuestionOut: QuestionOut;
  RefusedOut: RefusedOut;
  RegionOut: RegionOut;
  ResourceIn: ResourceIn;
  ResourceOut: ResourceOut;
  ResourcesIn: ResourcesIn;
  ResultOut: ResultOut;
  RevisionOut: RevisionOut;
  Role: Role;
  RoleIn: RoleIn;
  RouteOut: RouteOut;
  SavedOut: SavedOut;
  SearchOut: SearchOut;
  SideCardOut: SideCardOut;
  SpanOut: SpanOut;
  StopOut: StopOut;
  StudioExamQuestionOut: StudioExamQuestionOut;
  StudioOptionOut: StudioOptionOut;
  StudioQuestionOut: StudioQuestionOut;
  StudioResourceOut: StudioResourceOut;
  TeamMemberOut: TeamMemberOut;
  TextBlockOut: TextBlockOut;
  TryBlockOut: TryBlockOut;
  TryQuestionIn: TryQuestionIn;
  UpdateBlockIn: UpdateBlockIn;
  VerifyOut: VerifyOut;
}
/**
 * A block as the node's JSON shows it: `text` (markdown), `try` (question) or `callout`
 * (callout, title, markdown).
 */
export interface BlockIn {
  callout?: string;
  kind: "text" | "try" | "callout";
  markdown?: string;
  question?: string;
  title?: string;
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
export interface ChecklistOut {
  items: ItemOut[];
  passed: boolean;
}
export interface ItemOut {
  detail: string;
  passed: boolean;
  rule: string;
}
export interface DraftNodeOut {
  blocks: (TextBlockOut | TryBlockOut | CalloutBlockOut)[];
  claim: string;
  exam: StudioExamQuestionOut[];
  goes_deeper: LinkOut[];
  level: string;
  minutes: number;
  needs: LinkOut[];
  questions: StudioQuestionOut[];
  region: string;
  related: LinkOut[];
  resources: StudioResourceOut[];
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
export interface StudioExamQuestionOut {
  answer: number | null;
  ask: string;
  id: string;
  kind: string;
  level: string | null;
  options: StudioOptionOut[] | null;
  rationale: string;
  tolerance: number | null;
  unit: string;
}
export interface StudioOptionOut {
  misconception: string;
  right: boolean;
  text: string;
}
export interface LinkOut {
  node: string;
  reason: string;
}
/**
 * A try question; `options` for a choice, `answer` (with unit and tolerance) for a number.
 */
export interface StudioQuestionOut {
  answer: number | null;
  ask: string;
  hints: string[];
  id: string;
  kind: string;
  options: StudioOptionOut[] | null;
  rationale: string;
  tolerance: number | null;
  unit: string;
}
export interface StudioResourceOut {
  covers: string;
  display: string;
  kind: string;
  level: string;
  licence: string;
  part: string;
  provider: string;
  url: string;
  video: string;
}
/**
 * The node, or null with `problems` when its latest revision no longer reads against the
 * index's registries (#173).
 */
export interface DraftOut {
  base_digest: string;
  contributors: MemberOut[];
  folder: string;
  node: DraftNodeOut | null;
  node_id: string;
  problems: ProblemOut[];
  public_id: string;
  revision: number;
  state: string;
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
 * One problem, as `code-schema validate` reports it; `text` is its printed line.
 */
export interface ProblemOut {
  code: string;
  field: string | null;
  file: string;
  line: number | null;
  message: string;
  text: string;
}
export interface DraftSummaryOut {
  base_digest: string;
  contributors: MemberOut[];
  folder: string;
  node_id: string;
  public_id: string;
  revision: number;
  state: string;
}
export interface ExamIn {
  question: ExamQuestionIn;
  revision: number;
}
export interface ExamQuestionIn {
  answer?: number | null;
  ask: string;
  id: string;
  kind: "choice" | "number";
  level?: Level | null;
  options?: OptionIn[] | null;
  rationale: string;
  tolerance?: number | null;
  unit?: string;
}
export interface OptionIn {
  misconception?: string;
  right?: boolean;
  text: string;
}
export interface FieldsIn {
  claim?: string | null;
  level?: Level | null;
  minutes?: number | null;
  region?: string | null;
  revision: number;
  title?: string | null;
}
/**
 * A revision's files, exactly as they would land; `exam_yaml` is empty without a pool.
 */
export interface FilesOut {
  body_md: string;
  exam_yaml: string;
  node_yaml: string;
  number: number;
}
export interface HealthOut {
  checks: CheckOut[];
  status: "ok" | "down";
}
export interface InsertBlockIn {
  at: number;
  block: BlockIn;
  question?: TryQuestionIn | null;
  revision: number;
}
export interface TryQuestionIn {
  answer?: number | null;
  ask: string;
  hints: string[];
  id: string;
  kind: "choice" | "number";
  options?: OptionIn[] | null;
  rationale: string;
  tolerance?: number | null;
  unit?: string;
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
export interface LinkIn {
  node: string;
  reason: string;
}
export interface LinksIn {
  links: LinkIn[];
  revision: number;
}
export interface MeOut {
  user: MemberOut | null;
}
/**
 * An error answer: the sentence a person reads, and its diagnostic code (spec M4D.4).
 */
export interface Message {
  code: string;
  detail: string;
}
export interface MoveBlockIn {
  revision: number;
  to: number;
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
export interface NewNodeIn {
  claim: string;
  level: Level;
  minutes: number;
  region: string;
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
/**
 * An indexed node's id; or a new node's id with its first fields.
 */
export interface OpenIn {
  new?: NewNodeIn | null;
  node_id: string;
}
export interface PendingInviteOut {
  email: string;
  expires_at: string;
  public_id: string;
  role: string;
}
/**
 * A refused save: why, and every problem its files would have (M4W.3).
 */
export interface RefusedOut {
  code: string;
  detail: string;
  problems: ProblemOut[];
}
export interface ResourceIn {
  covers: string;
  display: string;
  kind: string;
  level: Level;
  licence: string;
  part?: string;
  provider: string;
  url: string;
  video?: string;
}
export interface ResourcesIn {
  resources: ResourceIn[];
  revision: number;
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
export interface RevisionOut {
  change: string;
  number: number;
  saved_at: string;
  saved_by: MemberOut | null;
}
export interface RoleIn {
  role: Role;
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
export interface SavedOut {
  draft: DraftOut;
  warnings: ProblemOut[];
}
export interface SearchOut {
  query: string;
  results: ResultOut[];
  unmatched: string[];
}
export interface TeamMemberOut {
  active: boolean;
  email: string;
  name: string;
  public_id: string;
  role: string;
}
export interface UpdateBlockIn {
  block: BlockIn;
  question?: TryQuestionIn | null;
  revision: number;
}
/**
 * `clean` when no problem refuses; warnings may still be listed (M4W.5).
 */
export interface VerifyOut {
  clean: boolean;
  problems: ProblemOut[];
}
