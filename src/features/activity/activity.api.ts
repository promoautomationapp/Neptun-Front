import { z } from "zod";
import { request } from "../../api/client";

export const activitySchema = z.object({
  timeZone: z.string(),
  scope: z.enum(["organization", "all-organizations"]).default("organization"),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  users: z.array(
    z.object({ id: z.string(), name: z.string(), email: z.string() }),
  ),
  actions: z.array(z.string()),
  records: z.array(
    z.object({
      id: z.string(),
      organization: z.object({ id: z.string(), name: z.string() }).optional(),
      actor: z.object({
        id: z.string().nullable(),
        name: z.string(),
        email: z.string(),
        role: z.string(),
      }),
      action: z.string(),
      targetType: z.string(),
      targetId: z.string().nullable(),
      method: z.string().nullable(),
      route: z.string().nullable(),
      ip: z.string().nullable(),
      statusCode: z.number().nullable(),
      outcome: z.enum(["success", "failure"]),
      durationMs: z.number().nullable(),
      requestId: z.string().nullable(),
      createdAt: z.string(),
      source: z.string(),
    }),
  ),
});
export type Activity = z.infer<typeof activitySchema>;
export function getActivity(params: URLSearchParams, signal?: AbortSignal) {
  return request(`/api/activity?${params}`, activitySchema, { signal });
}
