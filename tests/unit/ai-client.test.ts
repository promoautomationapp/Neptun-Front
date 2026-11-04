import type * as ApiClient from "../../src/api/client";
import { it, expect, vi, afterEach, beforeEach } from "vitest";
vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<typeof ApiClient>(
    "../../src/api/client",
  );
  return { ...actual, request: vi.fn() };
});
import { request, ApiError } from "../../src/api/client";
import { requestAi } from "../../src/features/ai/ai.api";
beforeEach(() => {
  vi.mocked(request).mockReset();
});
afterEach(() => vi.useRealTimers());
it("a completed cached image returns immediately without polling or cache controls", async () => {
  const api = vi.mocked(request);
  api.mockResolvedValueOnce({
    status: "succeeded",
    cached: true,
    result: { image: "/api/assets/saved" },
  });
  expect(
    await requestAi("ai-remove-background", { image: "/api/assets/source" }),
  ).toEqual({ image: "/api/assets/saved" });
  expect(api).toHaveBeenCalledTimes(1);
  expect(api.mock.calls[0]?.[2]?.method).toBe("POST");
});
it("queued requests poll with GET and never repeat their AI command", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000001",
    })
    .mockResolvedValueOnce({ status: "running", result: null, error: null })
    .mockResolvedValueOnce({
      status: "succeeded",
      result: { changes: [] },
      error: null,
    });
  const pending = requestAi("ai-proofread", {
    items: [{ id: "f0", text: "Copy" }],
  });
  await vi.advanceTimersByTimeAsync(2400);
  expect(await pending).toEqual({ changes: [] });
  expect(
    api.mock.calls.filter((call) => call[2]?.method === "POST"),
  ).toHaveLength(1);
  for (const call of api.mock.calls.slice(1))
    expect(call[2]?.method ?? "GET").toBe("GET");
});
it("an uncertain response is surfaced without another provider command", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000001",
    })
    .mockResolvedValueOnce({
      status: "uncertain",
      result: null,
      error: "Interrupted",
    });
  const pending = requestAi("ai-remove-background", {
    image: "/api/assets/source",
  });
  const assertion = expect(pending).rejects.toMatchObject({
    code: "AI_RESULT_UNCERTAIN",
  });
  await vi.advanceTimersByTimeAsync(1200);
  await assertion;
  expect(
    api.mock.calls.filter((call) => call[2]?.method === "POST"),
  ).toHaveLength(1);
});
it("a non-cutout transport failure does not automatically repeat its command", async () => {
  vi.mocked(request).mockRejectedValueOnce(new ApiError("Interrupted", 502));
  await expect(
    requestAi("ai-lifestyle", { image: "/api/assets/source" }),
  ).rejects.toThrow("Interrupted");
  expect(request).toHaveBeenCalledTimes(1);
});

it("bounds an unresponsive non-cutout command without repeating its POST", async () => {
  vi.useFakeTimers();
  vi.mocked(request).mockImplementationOnce(() => new Promise(() => {}));
  const result = requestAi("ai-lifestyle", { image: "/post-timeout" });
  const rejected = expect(result).rejects.toMatchObject({
    code: "AI_REQUEST_UNCONFIRMED",
  });
  await vi.advanceTimersByTimeAsync(45_000);
  await rejected;
  expect(request).toHaveBeenCalledOnce();
  expect(vi.mocked(request).mock.calls[0]?.[2]?.signal?.aborted).toBe(true);
});

it("recovers a temporary GET failure while submitting the AI command only once", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000002",
    })
    .mockRejectedValueOnce(new ApiError("Backend restarting", 503))
    .mockResolvedValueOnce({
      status: "succeeded",
      result: { image: "/api/assets/done" },
      error: null,
    });
  const result = requestAi("ai-remove-background", {
    image: "/temporary-status-error",
  });
  await vi.advanceTimersByTimeAsync(2400);
  expect(await result).toEqual({ image: "/api/assets/done" });
  expect(
    api.mock.calls.filter((call) => call[2]?.method === "POST"),
  ).toHaveLength(1);
  expect(api).toHaveBeenCalledTimes(3);
});

it("reattaches with GET after unavailable status checks, even when Retry requests regeneration", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000003",
    })
    .mockRejectedValue(new ApiError("Unavailable", 502));
  const result = requestAi("ai-remove-background", {
    image: "/retain-ticket",
    orientation: "landscape",
  });
  const rejected = expect(result).rejects.toMatchObject({
    code: "AI_JOB_PENDING",
  });
  await vi.advanceTimersByTimeAsync(22_000);
  await rejected;
  api.mockResolvedValueOnce({
    status: "succeeded",
    result: { image: "/api/assets/retained" },
    error: null,
  });
  const retry = requestAi("ai-remove-background", {
    image: "/retain-ticket",
    orientation: "square",
    retry: true,
  });
  await vi.advanceTimersByTimeAsync(1200);
  expect(await retry).toEqual({ image: "/api/assets/retained" });
  expect(
    api.mock.calls.filter((call) => call[2]?.method === "POST"),
  ).toHaveLength(1);
  expect(api.mock.calls.at(-1)?.[0]).toBe(
    "/api/ai/jobs/00000000-0000-4000-8000-000000000003",
  );
});

it("bounds stalled status requests and keeps the durable job available for a later check", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000004",
    })
    .mockImplementation(() => new Promise(() => {}));
  const result = requestAi("ai-remove-background", { image: "/stalled-get" });
  const rejected = expect(result).rejects.toMatchObject({
    code: "AI_JOB_PENDING",
  });
  await vi.advanceTimersByTimeAsync(565_000);
  await rejected;
  expect(api).toHaveBeenCalledTimes(13);
  expect(
    api.mock.calls.filter((call) => call[2]?.method === "POST"),
  ).toHaveLength(1);
});

it("stops waiting forever for a queued job without sending another provider command", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000005",
    })
    .mockResolvedValue({ status: "queued", result: null, error: null });
  const result = requestAi("ai-remove-background", {
    image: "/never-started-job",
  });
  const rejected = expect(result).rejects.toMatchObject({
    code: "AI_JOB_PENDING",
  });
  await vi.advanceTimersByTimeAsync(20 * 60_000 + 1200);
  await rejected;
  expect(
    api.mock.calls.filter((call) => call[2]?.method === "POST"),
  ).toHaveLength(1);
});

it("surfaces an incomplete terminal response instead of endlessly polling", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000006",
    })
    .mockResolvedValueOnce({ status: "succeeded", result: null, error: null });
  const result = requestAi("ai-remove-background", {
    image: "/missing-result",
  });
  const rejected = expect(result).rejects.toMatchObject({
    code: "AI_JOB_PENDING",
  });
  await vi.advanceTimersByTimeAsync(1200);
  await rejected;
  expect(api).toHaveBeenCalledTimes(2);
});

it("aborts an in-flight status check without discarding its resumable job", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000007",
    })
    .mockImplementationOnce(() => new Promise(() => {}));
  const controller = new AbortController();
  const result = requestAi(
    "ai-remove-background",
    { image: "/abort-status" },
    controller.signal,
  );
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(1200);
  controller.abort();
  await rejected;
  expect(api.mock.calls[1]?.[2]?.signal?.aborted).toBe(true);
  expect(
    api.mock.calls.filter((call) => call[2]?.method === "POST"),
  ).toHaveLength(1);
});

it("reuses an unconfirmed regeneration command ID and original output size on manual retry", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api.mockImplementation(() => new Promise(() => {}));
  const first = requestAi("ai-remove-background", {
    image: "/unconfirmed-regeneration",
    orientation: "portrait",
    retry: true,
    regenerate: true,
    rejectedImage: "/bad-previous-result",
  });
  const rejected = expect(first).rejects.toMatchObject({
    code: "AI_REQUEST_UNCONFIRMED",
  });
  await vi.advanceTimersByTimeAsync(188_000);
  await rejected;
  api
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000009",
    })
    .mockResolvedValueOnce({
      status: "succeeded",
      result: { image: "/api/assets/safe-retry" },
      error: null,
    });
  const retry = requestAi("ai-remove-background", {
    image: "/unconfirmed-regeneration",
    orientation: "square",
    retry: true,
    regenerate: true,
    rejectedImage: "/bad-previous-result",
  });
  await vi.advanceTimersByTimeAsync(1200);
  expect(await retry).toEqual({ image: "/api/assets/safe-retry" });
  const posts = api.mock.calls.filter((call) => call[2]?.method === "POST");
  const originalBody = posts[0]?.[2]?.body as Record<string, unknown>;
  expect(originalBody.commandId).toMatch(/^[a-f0-9-]{36}$/);
  expect(posts).toHaveLength(5);
  for (const post of posts) expect(post[2]?.body).toEqual(originalBody);
  expect(originalBody.orientation).toBe("portrait");
  expect(originalBody).toMatchObject({
    regenerate: true,
    rejectedImage: "/bad-previous-result",
  });
  api.mockResolvedValueOnce({
    status: "succeeded",
    result: { image: "/api/assets/new-version" },
  });
  await requestAi("ai-remove-background", {
    image: "/unconfirmed-regeneration",
    orientation: "portrait",
    retry: true,
    regenerate: true,
    rejectedImage: "/bad-previous-result",
  });
  expect(
    (api.mock.calls.at(-1)?.[2]?.body as Record<string, unknown>).commandId,
  ).not.toBe(originalBody.commandId);
});

it("recovers a lost cutout POST confirmation with the same command and one server generation", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  const commands = new Set<string>();
  let submissions = 0;
  api.mockImplementation(async (_path, _schema, options) => {
    if (options?.method === "POST") {
      submissions += 1;
      commands.add((options.body as { commandId: string }).commandId);
      if (submissions === 1) return new Promise(() => {});
      return {
        status: "queued",
        jobId: "00000000-0000-4000-8000-000000000010",
      };
    }
    return {
      status: "succeeded",
      result: { image: "/api/assets/confirmed-once" },
      error: null,
    };
  });
  const retry = vi.fn();
  const result = requestAi(
    "ai-remove-background",
    { image: "/lost-confirmation", orientation: "portrait", retry: true },
    undefined,
    { onRetry: retry },
  );
  await vi.advanceTimersByTimeAsync(47_400);
  expect(await result).toEqual({ image: "/api/assets/confirmed-once" });
  expect(commands.size).toBe(1);
  const posts = api.mock.calls.filter((call) => call[2]?.method === "POST");
  expect(posts).toHaveLength(2);
  expect(posts[1]?.[2]?.body).toEqual(posts[0]?.[2]?.body);
  expect(posts[0]?.[2]?.signal?.aborted).toBe(true);
  expect(retry.mock.calls).toEqual([[1, 3]]);
});

it("resumes unavailable cutout status checks with numbered recovery rounds and no new POST", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api.mockResolvedValueOnce({
    status: "queued",
    jobId: "00000000-0000-4000-8000-000000000011",
  });
  for (let index = 0; index < 6; index += 1)
    api.mockRejectedValueOnce(new ApiError("Connection timed out", 408));
  api.mockResolvedValueOnce({
    status: "succeeded",
    result: { image: "/api/assets/reconnected" },
    error: null,
  });
  const retry = vi.fn();
  const result = requestAi(
    "ai-remove-background",
    { image: "/get-recovery" },
    undefined,
    { onRetry: retry },
  );
  await vi.advanceTimersByTimeAsync(12_000);
  expect(await result).toEqual({ image: "/api/assets/reconnected" });
  expect(retry.mock.calls).toEqual([
    [1, 3],
    [2, 3],
  ]);
  const posts = api.mock.calls.filter((call) => call[2]?.method === "POST");
  expect(posts).toHaveLength(1);
  expect(new Set(api.mock.calls.slice(1).map((call) => call[0]))).toEqual(
    new Set(["/api/ai/jobs/00000000-0000-4000-8000-000000000011"]),
  );
});

it("caps cutout POST recovery at three attempts and retains the same command for a later manual check", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api.mockRejectedValue(new TypeError("Network unavailable"));
  const retry = vi.fn();
  const result = requestAi(
    "ai-remove-background",
    { image: "/post-recovery-cap" },
    undefined,
    { onRetry: retry },
  );
  const rejected = expect(result).rejects.toThrow("Network unavailable");
  await vi.advanceTimersByTimeAsync(7_200);
  await rejected;
  expect(retry.mock.calls).toEqual([
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
  expect(api).toHaveBeenCalledTimes(4);
  const firstBody = api.mock.calls[0]?.[2]?.body;
  for (const call of api.mock.calls) expect(call[2]?.body).toEqual(firstBody);
  api.mockResolvedValueOnce({
    status: "succeeded",
    result: { image: "/api/assets/late-confirmation" },
  });
  expect(
    await requestAi("ai-remove-background", {
      image: "/post-recovery-cap",
      retry: true,
    }),
  ).toEqual({ image: "/api/assets/late-confirmation" });
  expect(api.mock.calls.at(-1)?.[2]?.body).toEqual(firstBody);
});

it("shares one three-recovery budget across command confirmation and status polling", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api
    .mockRejectedValueOnce(new TypeError("Connection lost"))
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000012",
    })
    .mockRejectedValue(new ApiError("Status timed out", 408));
  const retry = vi.fn();
  const result = requestAi(
    "ai-remove-background",
    { image: "/shared-recovery-cap" },
    undefined,
    { onRetry: retry },
  );
  const rejected = expect(result).rejects.toMatchObject({
    code: "AI_JOB_PENDING",
  });
  await vi.advanceTimersByTimeAsync(18_000);
  await rejected;
  expect(retry.mock.calls).toEqual([
    [1, 3],
    [2, 3],
    [3, 3],
  ]);
  expect(
    api.mock.calls.filter((call) => call[2]?.method === "POST"),
  ).toHaveLength(2);
  expect(
    api.mock.calls.filter((call) => call[2]?.method !== "POST"),
  ).toHaveLength(9);
});

it("aborts recovery backoff immediately without another request", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api.mockRejectedValue(new TypeError("Connection lost"));
  const controller = new AbortController();
  const retry = vi.fn();
  const result = requestAi(
    "ai-remove-background",
    { image: "/abort-recovery-backoff" },
    controller.signal,
    { onRetry: retry },
  );
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  await vi.advanceTimersByTimeAsync(0);
  expect(retry.mock.calls).toEqual([[1, 3]]);
  controller.abort();
  await rejected;
  await vi.advanceTimersByTimeAsync(10_000);
  expect(api).toHaveBeenCalledOnce();
});

it.each([
  [401, undefined],
  [403, undefined],
  [404, undefined],
  [422, undefined],
  [502, "AI_JOB_FAILED"],
  [502, "AI_RESULT_UNCERTAIN"],
] as const)(
  "does not recover a terminal cutout response (%s, %s)",
  async (status, code) => {
    const retry = vi.fn();
    vi.mocked(request).mockRejectedValueOnce(
      new ApiError("Terminal response", status, code),
    );
    await expect(
      requestAi(
        "ai-remove-background",
        { image: `/terminal-${status}-${code}` },
        undefined,
        { onRetry: retry },
      ),
    ).rejects.toMatchObject({ status, code });
    expect(request).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
  },
);

it.each(["failed", "cancelled", "uncertain"])(
  "does not retry a %s cutout job or start a new generation",
  async (status) => {
    vi.useFakeTimers();
    const api = vi.mocked(request);
    api
      .mockResolvedValueOnce({
        status: "queued",
        jobId: "00000000-0000-4000-8000-000000000013",
      })
      .mockResolvedValueOnce({
        status,
        result: null,
        error: "Image quality check did not pass",
      });
    const retry = vi.fn();
    const result = requestAi(
      "ai-remove-background",
      { image: `/terminal-job-${status}` },
      undefined,
      { onRetry: retry },
    );
    const rejected = expect(result).rejects.toMatchObject({
      code: status === "uncertain" ? "AI_RESULT_UNCERTAIN" : "AI_JOB_FAILED",
    });
    await vi.advanceTimersByTimeAsync(1200);
    await rejected;
    expect(api).toHaveBeenCalledTimes(2);
    expect(retry).not.toHaveBeenCalled();
  },
);

it("includes cutout POST timeout and recovery in the original twenty-minute wait budget", async () => {
  vi.useFakeTimers();
  const started = Date.now();
  const api = vi.mocked(request);
  api
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000014",
    })
    .mockResolvedValue({ status: "running", result: null, error: null });
  const retry = vi.fn();
  const result = requestAi(
    "ai-remove-background",
    { image: "/bounded-total-recovery" },
    undefined,
    { onRetry: retry },
  );
  const rejected = expect(result).rejects.toMatchObject({
    code: "AI_JOB_PENDING",
  });
  await vi.advanceTimersByTimeAsync(20 * 60_000);
  await rejected;
  expect(Date.now() - started).toBe(20 * 60_000);
  expect(retry.mock.calls).toEqual([[1, 3]]);
  expect(
    api.mock.calls.filter((call) => call[2]?.method === "POST"),
  ).toHaveLength(2);
});

it("keeps the original three-failed-check behavior for non-cutout jobs", async () => {
  vi.useFakeTimers();
  const api = vi.mocked(request);
  api
    .mockResolvedValueOnce({
      status: "queued",
      jobId: "00000000-0000-4000-8000-000000000015",
    })
    .mockRejectedValue(new ApiError("Status unavailable", 503));
  const retry = vi.fn();
  const result = requestAi("ai-proofread", { items: [] }, undefined, {
    onRetry: retry,
  });
  const rejected = expect(result).rejects.toMatchObject({
    code: "AI_JOB_PENDING",
  });
  await vi.advanceTimersByTimeAsync(3600);
  await rejected;
  expect(api).toHaveBeenCalledTimes(4);
  expect(retry).not.toHaveBeenCalled();
});

it.each([401, 403, 404])(
  "stops cutout polling immediately when the existing job returns %s",
  async (status) => {
    vi.useFakeTimers();
    const api = vi.mocked(request);
    api
      .mockResolvedValueOnce({
        status: "queued",
        jobId: "00000000-0000-4000-8000-000000000016",
      })
      .mockRejectedValueOnce(new ApiError("Job unavailable", status));
    const retry = vi.fn();
    const result = requestAi(
      "ai-remove-background",
      { image: `/unauthorized-status-${status}` },
      undefined,
      { onRetry: retry },
    );
    const rejected = expect(result).rejects.toMatchObject({ status });
    await vi.advanceTimersByTimeAsync(1200);
    await rejected;
    expect(api).toHaveBeenCalledTimes(2);
    expect(retry).not.toHaveBeenCalled();
  },
);
