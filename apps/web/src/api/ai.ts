// Studio's AI routes (M5.1 spec, M5G.7). Every write answers the page's whole state.
import { getJson, sendJson } from "./client";
import type {
  AISettingsOut,
  ConnectionIn,
  SignInOut,
  SignInStateOut,
  SiteIn,
  UsageOut,
} from "./schema";

const BASE = "/api/studio/ai";
export type UsageRange = "today" | "week" | "month";

export const fetchAISettings = (signal?: AbortSignal) =>
  getJson<AISettingsOut>(`${BASE}/settings`, signal);
export const addConnection = (body: ConnectionIn) =>
  sendJson<AISettingsOut>("POST", `${BASE}/connections`, body);
export const removeConnection = (id: number) =>
  sendJson<AISettingsOut>("DELETE", `${BASE}/connections/${id}`);
export const testConnection = (id: number) =>
  sendJson<AISettingsOut>("POST", `${BASE}/connections/${id}/test`, {});
export const setSite = (key: string, body: SiteIn) =>
  sendJson<AISettingsOut>("PUT", `${BASE}/sites/${encodeURIComponent(key)}`, body);
export const startSignIn = () => sendJson<SignInOut>("POST", `${BASE}/chatgpt/sign-in`, {});
export const pollSignIn = () => getJson<SignInStateOut>(`${BASE}/chatgpt/sign-in`);
export const fetchUsage = (range: UsageRange, signal?: AbortSignal) =>
  getJson<UsageOut>(`${BASE}/usage?range=${range}`, signal);
