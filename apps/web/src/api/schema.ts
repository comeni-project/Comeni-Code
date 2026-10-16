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
  ApproveIn: ApproveIn;
  BlockIn: BlockIn;
  BuildOut: BuildOut;
  CalloutBlockOut: CalloutBlockOut;
  CheckOut: CheckOut;
  ChecklistOut: ChecklistOut;
  DraftNodeOut: DraftNodeOut;
  DraftOut: DraftOut;
  DraftSummaryOut: DraftSummaryOut;
  EventOut: EventOut;
  ExamIn: ExamIn;
  ExamQuestionIn: ExamQuestionIn;
  ExampleBlockOut: ExampleBlockOut;
  FieldsIn: FieldsIn;
  FileChangeOut: FileChangeOut;
  FilesOut: FilesOut;
  GivenIn: GivenIn;
  HealthOut: HealthOut;
  IndexOut: IndexOut;
  InsertBlockIn: InsertBlockIn;
  InviteIn: InviteIn;
  InviteOut: InviteOut;
  ItemOut: ItemOut;
  LandingEntryOut: LandingEntryOut;
  LandingIn: LandingIn;
  LandingOut: LandingOut;
  Level: Level;
  LinkIn: LinkIn;
  LinkOut: LinkOut;
  LinkTargetOut: LinkTargetOut;
  LinksIn: LinksIn;
  MathBlockOut: MathBlockOut;
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
  QuestionChecksOut: QuestionChecksOut;
  QuestionOut: QuestionOut;
  QueueKeyOut: QueueKeyOut;
  QueuedDraftOut: QueuedDraftOut;
  ReadyDraftOut: ReadyDraftOut;
  RefusedOut: RefusedOut;
  RegionChoiceOut: RegionChoiceOut;
  RegionOut: RegionOut;
  RequestOut: RequestOut;
  RequestsOut: RequestsOut;
  ResourceIn: ResourceIn;
  ResourceOut: ResourceOut;
  ResourcesIn: ResourcesIn;
  ResultOut: ResultOut;
  ReviewContentOut: ReviewContentOut;
  ReviewFieldsOut: ReviewFieldsOut;
  ReviewItemOut: ReviewItemOut;
  ReviewOut: ReviewOut;
  ReviewQuestionOut: ReviewQuestionOut;
  RevisionOut: RevisionOut;
  Role: Role;
  RoleIn: RoleIn;
  RouteOut: RouteOut;
  SavedOut: SavedOut;
  SearchOut: SearchOut;
  SendBackIn: SendBackIn;
  SequenceBlockOut: SequenceBlockOut;
  SideCardOut: SideCardOut;
  SpanOut: SpanOut;
  StopOut: StopOut;
  StudioExamQuestionOut: StudioExamQuestionOut;
  StudioOptionOut: StudioOptionOut;
  StudioQuestionOut: StudioQuestionOut;
  StudioResourceOut: StudioResourceOut;
  SubmitIn: SubmitIn;
  TeamMemberOut: TeamMemberOut;
  TextBlockOut: TextBlockOut;
  TryBlockOut: TryBlockOut;
  TryQuestionIn: TryQuestionIn;
  UpdateBlockIn: UpdateBlockIn;
  VerdictIn: VerdictIn;
  VerdictsIn: VerdictsIn;
  VerifyOut: VerifyOut;
}
export interface ApproveIn {
  reason?: string;
  revision: number;
}
/**
 * A block as the node's JSON shows it: `text` (markdown), `try` (question), `callout`
 * (callout, title, markdown), `sequence` (letters), `math` (tex) or `example` (title,
 * markdown).
 */
export interface BlockIn {
  callout?: string;
  kind: "text" | "try" | "callout" | "sequence" | "math" | "example";
  letters?: string;
  markdown?: string;
  question?: string;
  tex?: string;
  title?: string;
}
export interface BuildOut {
  commit: string;
  created_at: string;
  digest: string;
  node_count: number;
  outcome: string;
  problems: string[];
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
/**
 * The checklist, the problems behind it and each exam question's checks, so Checks is one
 * request (M4K.6, M4P.4).
 */
export interface ChecklistOut {
  items: ItemOut[];
  passed: boolean;
  problems?: ProblemOut[];
  questions?: QuestionChecksOut[];
}
export interface ItemOut {
  detail: string;
  passed: boolean;
  rule: string;
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
  question?: string | null;
  text: string;
}
/**
 * One exam question's checks (M4P.4).
 */
export interface QuestionChecksOut {
  id: string;
  items: ItemOut[];
}
export interface DraftNodeOut {
  blocks: (
    TextBlockOut | TryBlockOut | CalloutBlockOut | SequenceBlockOut | MathBlockOut | ExampleBlockOut
  )[];
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
/**
 * DNA, RNA or protein letters, drawn in groups of ten (M4.8c spec, M4Q.2).
 */
export interface SequenceBlockOut {
  kind: "sequence";
  letters: string;
}
/**
 * A display formula in TeX (M6.2 spec, M6MX.1).
 */
export interface MathBlockOut {
  kind: "math";
  tex: string;
}
/**
 * A worked example: its title and Markdown (M6MX.2).
 */
export interface ExampleBlockOut {
  kind: "example";
  markdown: string;
  title: string;
}
/**
 * An exam question as the builder edits it (M4Q.5): its stem as blocks and as the text the
 * file holds, and whether the live index holds it unchanged.
 */
export interface StudioExamQuestionOut {
  accept: string[];
  answer: number | string | null;
  claim: string;
  exact: boolean;
  id: string;
  kind: string;
  level: string | null;
  options: StudioOptionOut[] | null;
  rationale: string;
  state: "approved" | "draft";
  stem: (
    TextBlockOut | TryBlockOut | CalloutBlockOut | SequenceBlockOut | MathBlockOut | ExampleBlockOut
  )[];
  stem_text: string;
  steps: string[] | null;
  title: string;
  tolerance: number | null;
  unit: string;
}
export interface StudioOptionOut {
  misconception: string;
  plain: boolean;
  right: boolean;
  text: string;
}
export interface LinkOut {
  node: string;
  reason: string;
}
/**
 * A try question; `options` for a choice, `answer` with unit and tolerance for a number, or
 * as text with `accept` and `exact` for a sequence; `steps` for an order (M4Q.5).
 */
export interface StudioQuestionOut {
  accept: string[];
  answer: number | string | null;
  ask: string;
  exact: boolean;
  hints: string[];
  id: string;
  kind: string;
  options: StudioOptionOut[] | null;
  rationale: string;
  steps: string[] | null;
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
  landing?: string | null;
  node: DraftNodeOut | null;
  node_id: string;
  problems: ProblemOut[];
  public_id: string;
  requests?: RequestsOut | null;
  revision: number;
  state: string;
  submitted_revision: number | null;
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
 * The last send back, while the draft has not been submitted again (M4.9a spec, M4V.4).
 */
export interface RequestsOut {
  at: string;
  by: MemberOut | null;
  items: RequestOut[];
  reason: string;
}
export interface RequestOut {
  key: string;
  kind: string;
  note: string;
  now: string | null;
}
export interface DraftSummaryOut {
  base_digest: string;
  contributors: MemberOut[];
  folder: string;
  landing?: string | null;
  node_id: string;
  public_id: string;
  revision: number;
  state: string;
  submitted_revision: number | null;
}
/**
 * One entry of a draft's log (M4R.5).
 */
export interface EventOut {
  answered: number | null;
  at: string;
  blocks: number | null;
  by: MemberOut | null;
  kind: string;
  reason: string;
  revision: number | null;
  self_approved: boolean;
  wrong: number | null;
}
export interface ExamIn {
  question: ExamQuestionIn;
  revision: number;
}
export interface ExamQuestionIn {
  accept?: string[];
  answer?: number | string | null;
  claim?: string;
  exact?: boolean;
  id: string;
  kind: "choice" | "number" | "sequence" | "order";
  level?: Level | null;
  options?: OptionIn[] | null;
  rationale: string;
  stem: BlockIn[];
  steps?: string[] | null;
  title: string;
  tolerance?: number | null;
  unit?: string;
}
export interface OptionIn {
  misconception?: string;
  plain?: boolean;
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
export interface FileChangeOut {
  change: string;
  file: string;
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
/**
 * An option's index for a choice, a number for a number. Taken as any JSON value, so that
 * `true` or "1" reach the grader and are refused as CA0218, not coerced.
 */
export interface GivenIn {
  given: unknown;
}
export interface HealthOut {
  checks: CheckOut[];
  status: "ok" | "down";
}
export interface IndexOut {
  behind: boolean;
  checked_at: string | null;
  follow_seconds: number;
  latest: BuildOut | null;
  live: BuildOut | null;
  main_head: string | null;
  regions: RegionChoiceOut[];
}
export interface RegionChoiceOut {
  id: string;
  name: string;
}
export interface InsertBlockIn {
  at: number;
  block: BlockIn;
  question?: TryQuestionIn | null;
  revision: number;
}
export interface TryQuestionIn {
  accept?: string[];
  answer?: number | string | null;
  ask: string;
  exact?: boolean;
  hints: string[];
  id: string;
  kind: "choice" | "number" | "sequence" | "order";
  options?: OptionIn[] | null;
  rationale: string;
  steps?: string[] | null;
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
export interface LandingEntryOut {
  draft: string;
  dropped_code: string;
  dropped_reason: string;
  live: boolean;
  node_id: string;
  revision: number;
}
export interface LandingIn {
  drafts: string[];
}
export interface LandingOut {
  branch: string;
  entries: LandingEntryOut[];
  landed: boolean;
  main_head: string;
  public_id: string;
  pull_number: number | null;
  pull_url: string;
  reason: string;
  started_at: string;
  started_by: MemberOut | null;
  state: string;
}
export interface LinkIn {
  node: string;
  reason: string;
}
/**
 * A node a link may name: a landed node, or a live draft of a new one (M6.1 spec, M6LD.4).
 */
export interface LinkTargetOut {
  draft: boolean;
  id: string;
  title: string;
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
  blocks: (
    TextBlockOut | TryBlockOut | CalloutBlockOut | SequenceBlockOut | MathBlockOut | ExampleBlockOut
  )[];
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
 * `options` for a choice; `answer`, a number with its unit and tolerance or a sequence's text
 * with what else it accepts; `steps` for an order, in the right order — the page shuffles them
 * (M4.8c spec, M4Q.5). Exam questions (T7.1) are scored, and their answers never leave the
 * server.
 */
export interface QuestionOut {
  accept: string[];
  answer: number | string | null;
  ask: string;
  exact: boolean;
  hints: string[];
  id: string;
  kind: string;
  options: OptionOut[] | null;
  rationale: string;
  steps: string[] | null;
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
export interface QueueKeyOut {
  answered: boolean | null;
  key: string;
  kind: string;
  label: string;
  verdict: string | null;
}
/**
 * A draft in the review queue (M4.9b spec, M4RS.1): its keys and your verdicts, no content.
 */
export interface QueuedDraftOut {
  contributors: MemberOut[];
  keys: QueueKeyOut[];
  node_id: string;
  public_id: string;
  reads: boolean;
  revision: number;
  submitted_at: string;
  title: string;
}
/**
 * An approved draft no landing holds, as Land lists it (M4.9c spec, M4LS.1).
 */
export interface ReadyDraftOut {
  approved_by: MemberOut | null;
  files: FileChangeOut[];
  folder: string;
  needs: string[];
  node_id: string;
  public_id: string;
  region: string;
  revision: number;
  self_approved: boolean;
}
/**
 * A refusal: why, every problem the draft's files would have (M4W.3), and for a checklist
 * that fails, its items (M4.5 spec, M4R.6).
 */
export interface RefusedOut {
  code: string;
  detail: string;
  items?: ItemOut[];
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
/**
 * A key's content, by kind (M4V.4); a question's key only once answered.
 */
export interface ReviewContentOut {
  block:
    | (
        | TextBlockOut
        | TryBlockOut
        | CalloutBlockOut
        | SequenceBlockOut
        | MathBlockOut
        | ExampleBlockOut
      )
    | null;
  fields: ReviewFieldsOut | null;
  question: ReviewQuestionOut | null;
  resource: StudioResourceOut | null;
}
/**
 * The `node` key's content: the node's own fields and its links (M4V.1).
 */
export interface ReviewFieldsOut {
  claim: string;
  goes_deeper: LinkOut[];
  level: string;
  minutes: number;
  needs: LinkOut[];
  region: string;
  related: LinkOut[];
  title: string;
}
/**
 * One question of the submitted revision, as its reviewer sees it: the key and rationale only
 * once they have answered it (M4R.4). A choice is answered by its option's index.
 */
export interface ReviewQuestionOut {
  ask: string;
  given: unknown;
  hints: string[];
  id: string;
  kind: string;
  options: string[] | null;
  pool: "try" | "exam";
  rationale: string | null;
  right: boolean | null;
  right_option: number | null;
  right_steps: string[] | null;
  stem: (
    TextBlockOut | TryBlockOut | CalloutBlockOut | SequenceBlockOut | MathBlockOut | ExampleBlockOut
  )[];
  steps: string[] | null;
  tolerance: number | null;
  unit: string;
  value: number | string | null;
}
/**
 * One key of your review (M4V.4): its content, your verdict and note, and what it was before
 * this draft when it changed (M4.9b spec, M4RS.2).
 */
export interface ReviewItemOut {
  before: ReviewContentOut | null;
  block:
    | (
        | TextBlockOut
        | TryBlockOut
        | CalloutBlockOut
        | SequenceBlockOut
        | MathBlockOut
        | ExampleBlockOut
      )
    | null;
  change: string;
  fields: ReviewFieldsOut | null;
  key: string;
  kind: string;
  note: string;
  question: ReviewQuestionOut | null;
  resource: StudioResourceOut | null;
  verdict: string | null;
}
export interface ReviewOut {
  items: ReviewItemOut[];
  revision: number;
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
export interface SendBackIn {
  reason?: string;
  revision?: number | null;
}
export interface SubmitIn {
  revision: number;
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
export interface VerdictIn {
  key: string;
  note?: string;
  verdict: ("approved" | "changes") | null;
}
export interface VerdictsIn {
  revision: number;
  verdicts: VerdictIn[];
}
/**
 * `clean` when no problem refuses; warnings may still be listed (M4W.5).
 */
export interface VerifyOut {
  clean: boolean;
  problems: ProblemOut[];
}
