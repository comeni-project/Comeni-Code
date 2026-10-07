// The accounts API (M4.3 spec, M4A.1–M4A.4): who is signed in, invites, and the team.
import { getJson, sendJson } from "./client";
import type { InviteOut, MeOut, PendingInviteOut, TeamMemberOut } from "./schema";

/** The roles in rank order: each includes the ones before it (roles.py). */
export const ROLES = ["author", "reviewer", "operator"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  author: "Author",
  reviewer: "Reviewer",
  operator: "Operator",
};

/** Whether a member holding `held` may do what `wanted` may: the web's one copy of the rule. */
export function canActAs(held: string, wanted: Role): boolean {
  const rank = ROLES.indexOf(held as Role);
  return rank >= 0 && rank >= ROLES.indexOf(wanted);
}

const token = (value: string) => encodeURIComponent(value);

export const fetchMe = (signal?: AbortSignal) => getJson<MeOut>("/api/me", signal);

export const fetchInvite = (value: string, signal?: AbortSignal) =>
  getJson<InviteOut>(`/api/invites/${token(value)}`, signal);

/** Hold the invite in the session, so the sign-up that follows takes it (M4A.2). */
export const acceptInvite = (value: string) =>
  sendJson<InviteOut>("POST", `/api/invites/${token(value)}/accept`);

export const fetchMembers = (signal?: AbortSignal) =>
  getJson<TeamMemberOut[]>("/api/team/members", signal);

export const fetchInvites = (signal?: AbortSignal) =>
  getJson<PendingInviteOut[]>("/api/team/invites", signal);

export const sendInvite = (email: string, role: Role) =>
  sendJson<PendingInviteOut>("POST", "/api/team/invites", { email, role });

export const withdrawInvite = (publicId: string) =>
  sendJson<undefined>("DELETE", `/api/team/invites/${publicId}`);

export const changeRole = (publicId: string, role: Role) =>
  sendJson<TeamMemberOut>("PATCH", `/api/team/members/${publicId}`, { role });

export const deactivate = (publicId: string) =>
  sendJson<TeamMemberOut>("POST", `/api/team/members/${publicId}/deactivate`);
