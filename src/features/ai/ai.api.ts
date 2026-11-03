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
const REQUEST_TIMEOUT_MS = 45_000;
const JOB_WAIT_TIMEOUT_MS = 20 * 60_000;
const MAX_POLL_FAILURES = 3;
const MAX_IMAGE_RECOVERIES = 3;
export interface AiRequestOptions {
  onRetry?: (attempt: number, max: number) => void;
}
// Retain jobs when only the browser's wait failed. Clicking Retry reattaches to
// the durable job with GET instead of requesting another billable generation.
type UnfinishedCommand = { commandId: string; body: unknown; jobId?: string };
const unfinishedJobs = new Map<string, UnfinishedCommand>();

function jobKey(path: AiPath, body: unknown) {
  const params =
    body && typeof body === "object" && !Array.isArray(body)
      ? Object.fromEntries(
          Object.entries(body).filter(
            ([key]) =>
              key !== "retry" &&
              !(path === "ai-remove-background" && key === "orientation"),
          ),
        )
      : body;
  return JSON.stringify([path, params]);
}

function boundedAiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
  },
) {
  const timeoutMs = Math.min(
    REQUEST_TIMEOUT_MS,
    options.timeoutMs ?? REQUEST_TIMEOUT_MS,
  );
  return new Promise<T>((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(
        options.signal.reason ?? new DOMException("Aborted", "AbortError"),
      );
      return;
    }
    const controller = new AbortController();
    let settled = false;
    const finish = (error: unknown, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(value as T);
    };
    const abort = () => {
      const error =
        options.signal?.reason ?? new DOMException("Aborted", "AbortError");
      controller.abort(error);
      finish(error);
    };
    const timer = setTimeout(() => {
      const error = new ApiError(
        options.method === "POST"
          ? "The preparation request could not be confirmed. It may still finish in the background."
          : "The preparation status could not be reached in time.",
        408,
        options.method === "POST"
          ? "AI_REQUEST_UNCONFIRMED"
          : "AI_POLL_TIMEOUT",
      );
      controller.abort(error);
      finish(error);
    }, timeoutMs);
    options.signal?.addEventListener("abort", abort, { once: true });
    void request(path, schema, {
      ...options,
      timeoutMs,
      signal: controller.signal,
    }).then(
      (value) => finish(null, value),
      (error) => finish(error),
    );
  });
}

function pendingJobError() {
  return new ApiError(
    "Preparation has not finished yet or its status is temporarily unavailable. You can keep editing and check the existing job again later.",
    408,
    "AI_JOB_PENDING",
  );
}

function temporaryPollFailure(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError &&
      !["AI_RESULT_UNCERTAIN", "AI_JOB_FAILED"].includes(error.code || "") &&
      (error.status === 408 || error.status === 429 || error.status >= 500))
  );
}

function waitForPoll(signal?: AbortSignal, delay = 1200): Promise<void> {
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
    const timer = setTimeout(finish, delay);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}
export async function requestAi<P extends AiPath>(
  path: P,
  body: unknown,
  signal?: AbortSignal,
  options: AiRequestOptions = {},
): Promise<z.infer<(typeof schemas)[P]>> {
  const recoverImageTransport = path === "ai-remove-background";
  let deadline = recoverImageTransport
    ? Date.now() + JOB_WAIT_TIMEOUT_MS
    : Infinity;
  let recoveryAttempts = 0;
  const requestBudget = () => Math.max(1, deadline - Date.now());
  async function recover(error: unknown) {
    if (
      !recoverImageTransport ||
      !temporaryPollFailure(error) ||
      recoveryAttempts >= MAX_IMAGE_RECOVERIES ||
      Date.now() >= deadline
    )
      return false;
    recoveryAttempts += 1;
    options.onRetry?.(recoveryAttempts, MAX_IMAGE_RECOVERIES);
    await waitForPoll(
      signal,
      Math.min(recoveryAttempts * 1200, requestBudget()),
    );
    if (Date.now() >= deadline) throw pendingJobError();
    return true;
  }
  const parse = (value: unknown) =>
    schemas[path].parse(value) as z.infer<(typeof schemas)[P]>;
  const key = jobKey(path, body);
  let command = unfinishedJobs.get(key);
  if (!command) {
    command = { commandId: crypto.randomUUID(), body };
    // Keep the command before submitting: its response may be lost after the
    // server accepts it. The same command ID makes an explicit retry safe too.
    unfinishedJobs.set(key, command);
  }
  if (!command.jobId) {
    let ticket: z.infer<typeof ticketSchema>;
    for (;;) {
      try {
        ticket = await boundedAiRequest(`/api/${path}`, ticketSchema, {
          method: "POST",
          body: {
            ...(command.body as Record<string, unknown>),
            commandId: command.commandId,
          },
          signal,
          timeoutMs: requestBudget(),
        });
        break;
      } catch (error) {
        if (signal?.aborted) throw error;
        if (
          error instanceof ApiError &&
          ((error.status >= 400 &&
            error.status < 500 &&
            ![408, 429].includes(error.status)) ||
            ["AI_RESULT_UNCERTAIN", "AI_JOB_FAILED"].includes(error.code || ""))
        )
          unfinishedJobs.delete(key);
        // A lost confirmation may follow an accepted generation. Reuse the
        // exact command ID and body so the server reattaches to that work.
        if (await recover(error)) continue;
        throw error;
      }
    }
    if (ticket.status === "succeeded" && ticket.result) {
      unfinishedJobs.delete(key);
      return parse(ticket.result);
    }
    if (!ticket.jobId)
      throw new ApiError("The AI job could not be started.", 502);
    command.jobId = ticket.jobId;
  }
  const jobId = command.jobId;
  if (!recoverImageTransport) deadline = Date.now() + JOB_WAIT_TIMEOUT_MS;
  let pollFailures = 0;
  for (;;) {
    if (Date.now() >= deadline) throw pendingJobError();
    await waitForPoll(signal, Math.min(1200, requestBudget()));
    if (Date.now() >= deadline) throw pendingJobError();
    let job: z.infer<typeof jobSchema>;
    try {
      job = await boundedAiRequest(`/api/ai/jobs/${jobId}`, jobSchema, {
        signal,
        timeoutMs: requestBudget(),
      });
      pollFailures = 0;
    } catch (error) {
      if (signal?.aborted) throw error;
      // A session/organization change must not leave another user's old ticket
      // attached to future commands. Authorization is still enforced server-side.
      if (error instanceof ApiError && [401, 403, 404].includes(error.status))
        unfinishedJobs.delete(key);
      if (!temporaryPollFailure(error)) throw error;
      if (++pollFailures >= MAX_POLL_FAILURES) {
        // Recovery resumes this GET loop and its existing deadline; it never
        // submits another generation or restarts the twenty-minute wait.
        if (!(await recover(error))) throw pendingJobError();
        pollFailures = 0;
      }
      continue;
    }
    if (job.status === "succeeded" && job.result) {
      const result = parse(job.result);
      unfinishedJobs.delete(key);
      return result;
    }
    if (["failed", "cancelled", "uncertain"].includes(job.status)) {
      unfinishedJobs.delete(key);
      throw new ApiError(
        job.error ?? "AI preparation failed.",
        502,
        job.status === "uncertain" ? "AI_RESULT_UNCERTAIN" : "AI_JOB_FAILED",
      );
    }
    if (!["queued", "running"].includes(job.status)) throw pendingJobError();
  }
}
