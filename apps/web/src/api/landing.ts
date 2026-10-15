// Landing (M4.6, M4.9c): the drafts ready to land, the landings, one landing, start and close.
import { getJson, sendJson } from "./client";
import type { LandingOut, ReadyDraftOut } from "./schema";

const LANDINGS = "/api/studio/landings";

export const fetchReady = (signal?: AbortSignal) =>
  getJson<ReadyDraftOut[]>(`${LANDINGS}/ready`, signal);

export const fetchLandings = (signal?: AbortSignal) => getJson<LandingOut[]>(LANDINGS, signal);

export const fetchLanding = (id: string, signal?: AbortSignal) =>
  getJson<LandingOut>(`${LANDINGS}/${id}`, signal);

export const startLanding = (drafts: string[]) =>
  sendJson<LandingOut>("POST", LANDINGS, { drafts });

export const closeLanding = (id: string) => sendJson<LandingOut>("POST", `${LANDINGS}/${id}/close`);

/** Still on its way: pending, open, or merged and not yet in the index (M4.9c spec, M4LS.2). */
export const moving = (landing: LandingOut) =>
  landing.state === "pending" ||
  landing.state === "open" ||
  (landing.state === "merged" && !landing.landed);
