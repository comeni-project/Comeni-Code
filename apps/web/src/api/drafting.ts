// Draft-scoped AI proposals; the operator's installation usage is a different API.
import { getJson, sendJson } from "./client";
import type { CreateProposalIn, ProposalOut } from "./schema";

const base = (draft: string) => `/api/studio/drafts/${draft}/ai/proposals`;
export const fetchProposals = (draft: string, target: string, signal?: AbortSignal) =>
  getJson<ProposalOut[]>(`${base(draft)}?target=${encodeURIComponent(target)}`, signal);
export const fetchProposal = (draft: string, identity: string, signal?: AbortSignal) =>
  getJson<ProposalOut>(`${base(draft)}/${identity}`, signal);
export const createProposal = (draft: string, body: CreateProposalIn) =>
  sendJson<ProposalOut>("POST", base(draft), body);
export const discardProposal = (draft: string, identity: string) =>
  sendJson<ProposalOut>("POST", `${base(draft)}/${identity}/discard`, {});
