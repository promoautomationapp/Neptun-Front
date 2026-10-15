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
it("a transport failure does not silently repeat a potentially billable command", async () => {
  vi.mocked(request).mockRejectedValueOnce(new ApiError("Interrupted", 502));
  await expect(
    requestAi("ai-remove-background", { image: "/api/assets/source" }),
  ).rejects.toThrow("Interrupted");
  expect(request).toHaveBeenCalledTimes(1);
});

it("bounds an unresponsive command request without automatically repeating its POST", async () => {
  vi.useFakeTimers();
  vi.mocked(request).mockImplementationOnce(() => new Promise(() => {}));
  const result = requestAi("ai-remove-background", { image: "/post-timeout" });
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
    .mockRejectedValueOnce(new ApiError("Unavailable", 502))
    .mockRejectedValueOnce(new ApiError("Unavailable", 502))
    .mockRejectedValueOnce(new ApiError("Unavailable", 502));
  const result = requestAi("ai-remove-background", {
    image: "/retain-ticket",
    orientation: "landscape",
  });
  const rejected = expect(result).rejects.toMatchObject({
    code: "AI_JOB_PENDING",
  });
  await vi.advanceTimersByTimeAsync(3600);
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
  await vi.advanceTimersByTimeAsync(140_000);
  await rejected;
  expect(api).toHaveBeenCalledTimes(4);
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
