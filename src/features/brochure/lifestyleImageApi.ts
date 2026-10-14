import { z } from "zod";
import { request } from "../../api/client";
import { requestAi } from "../ai/ai.api";
import type { Product } from "../../domain/models";
const quota = z.object({ month: z.string(), used: z.number(), limit: z.number(), attempts: z.number(), attemptLimit: z.number() });
export type LifestyleQuota = z.infer<typeof quota>;
export interface LifestyleRequest { prompt: string; image?: string; context: "brochure" | "tv"; orientation: "portrait" | "landscape"; products?: Product[]; regenerate?: boolean; }
export const lifestyleQuota = () => request("/api/ai/lifestyle/quota", quota);
export const generateLifestyle = (body: LifestyleRequest) => requestAi("ai-lifestyle", body);
export const acceptLifestyle = (id: string) => request(`/api/ai/lifestyle/${id}/accept`, quota.extend({ accepted: z.boolean() }), { method: "POST" });
