import { z } from "zod";
import { request } from "../../api/client";
const totals = z.object({
  requests: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  costUsd: z.number(),
  minimumUsd: z.number(),
  maximumUsd: z.number().nullable(),
  unknownCosts: z.number(),
  unknownTokens: z.number(),
  partialCosts: z.number(),
});
export const aiUsageSchema = z.object({
  timeZone: z.string(),
  currency: z.string(),
  pricingUrl: z.string(),
  pricingVersion: z.string(),
  summary: totals,
  operations: z.array(
    totals.extend({ operation: z.string(), model: z.string() }),
  ),
  timeline: z.array(totals.extend({ date: z.string() })),
  options: z.object({
    operations: z.array(z.string()),
    models: z.array(z.string()),
  }),
  records: z.array(
    z.object({
      id: z.string(),
      operation: z.string(),
      model: z.string(),
      inputTokens: z.number().nullable(),
      outputTokens: z.number().nullable(),
      costUsd: z.number().nullable(),
      minimumUsd: z.number().nullable(),
      maximumUsd: z.number().nullable(),
      costBasis: z.string(),
      createdAt: z.string(),
      status: z.string(),
      user: z.string().nullable(),
      source: z.string(),
      subject: z.string().default(""),
      requestId: z.string().nullable().default(null),
    }),
  ),
  total: z.number(),
});
export const mediaUsageSchema = z.object({
  driver: z.string(),
  bucketName: z.string().nullable(),
  bucket: z
    .object({ objects: z.number(), bytes: z.number(), checkedAt: z.string() })
    .nullable(),
  bucketError: z.boolean(),
  bucketPending: z.boolean().default(false),
  bucketStale: z.boolean().default(false),
  registered: z.object({ objects: z.number(), bytes: z.number() }),
  kinds: z.array(
    z.object({ kind: z.string(), count: z.number(), bytes: z.number() }),
  ),
  prepared: z.array(z.object({ operation: z.string(), count: z.number() })),
  linked: z.record(z.string(), z.number()),
});
export const dbUsageSchema = z.object({
  counts: z.record(z.string(), z.number()),
  bytes: z.number(),
  tables: z.array(z.object({ name: z.string(), bytes: z.number() })),
  checkedAt: z.string(),
});
export type AiUsage = z.infer<typeof aiUsageSchema>;
export type MediaUsage = z.infer<typeof mediaUsageSchema>;
export type DbUsage = z.infer<typeof dbUsageSchema>;
export function getAiUsage(params: URLSearchParams, signal?: AbortSignal) {
  return request(`/api/insights/ai?${params}`, aiUsageSchema, { signal });
}
export function getMediaUsage(signal?: AbortSignal) {
  return request("/api/insights/media", mediaUsageSchema, { signal });
}
export function getDbUsage(signal?: AbortSignal) {
  return request("/api/insights/database", dbUsageSchema, { signal });
}
