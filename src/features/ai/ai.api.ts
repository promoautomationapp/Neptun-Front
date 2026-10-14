import { z } from "zod";
import { request, ApiError } from "../../api/client";
import { jsonObject, jsonValue } from "../../domain/schemas";
const imageResult = z
  .object({
    image: z.string(),
    resultId: z.string().optional(),
    preparationRevision: z.number().optional(),
    annotationStyle: z.string().optional(),
    screenType: z.string().optional(),
    screenInches: z.number().nullable().optional(),
    inchesEmbedded: z.boolean().optional(),
    backgroundSignature: z.string().optional(),
  })
  .catchall(jsonValue);
const proofreadResult = z
  .object({
    changes: z
      .array(
        z.object({
          id: z.string(),
          original: z.string(),
          suggested: z.string(),
          reason: z.string(),
        }),
      )
      .default([]),
  })
  .catchall(jsonValue);
const schemas = {
  "ai-find-product-image": z.discriminatedUnion("found", [
    z.object({ found: z.literal(false), reason: z.string().optional() }),
    z.object({
      found: z.literal(true),
      image: z.string().min(1),
      sourceUrl: z.url(),
      imageUrl: z.url(),
      matchedName: z.string().min(1),
      matchedModel: z.string().optional(),
    }),
  ]),
  "ai-remove-background": imageResult,
  "ai-white-brand-logo": imageResult.extend({ url: z.string() }),
  "ai-generate-background": imageResult,
  "ai-lifestyle": imageResult,
  "ai-proofread": proofreadResult,
  "ai-suggest-placement": z
    .object({
      x: z.number(),
      y: z.number(),
      scale: z.number(),
      alreadyPresent: z.boolean(),
      reason: z.string(),
    })
    .catchall(jsonValue),
  "ai-detect-screen": z.discriminatedUnion("found", [
    z.object({ found: z.literal(false) }),
    z.object({
      found: z.literal(true),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }),
  ]),
};
export type AiPath = keyof typeof schemas;
export type ProductImageSearchResult = z.infer<
  (typeof schemas)["ai-find-product-image"]
>;
export type ProofreadChange = z.infer<
  typeof proofreadResult
>["changes"][number];
const ticketSchema = z
  .object({
    jobId: z.uuid().optional(),
    status: z.string(),
    result: jsonObject.optional(),
  })
  .catchall(jsonValue);
const jobSchema = z.object({
  status: z.string(),
  result: jsonObject.nullable(),
  error: z.string().nullable(),
});
function waitForPoll(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(finish, 1200);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}
export async function requestAi<P extends AiPath>(
  path: P,
  body: unknown,
  signal?: AbortSignal,
): Promise<z.infer<(typeof schemas)[P]>> {
  const ticket = await request(`/api/${path}`, ticketSchema, {
    method: "POST",
    body,
    signal,
  });
  const parse = (value: unknown) =>
    schemas[path].parse(value) as z.infer<(typeof schemas)[P]>;
  if (ticket.status === "succeeded" && ticket.result)
    return parse(ticket.result);
  if (!ticket.jobId)
    throw new ApiError("The AI job could not be started.", 502);
  for (;;) {
    await waitForPoll(signal);
    const job = await request(`/api/ai/jobs/${ticket.jobId}`, jobSchema, {
      signal,
    });
    if (job.status === "succeeded" && job.result) return parse(job.result);
    if (["failed", "cancelled", "uncertain"].includes(job.status))
      throw new ApiError(
        job.error ?? "AI preparation failed.",
        502,
        job.status === "uncertain" ? "AI_RESULT_UNCERTAIN" : "AI_JOB_FAILED",
      );
  }
}
