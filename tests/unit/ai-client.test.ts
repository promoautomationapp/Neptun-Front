import type * as ApiClient from "../../src/api/client";
import { it, expect, vi, afterEach } from "vitest";
vi.mock("../../src/api/client", async () => {
  const actual = await vi.importActual<typeof ApiClient>(
    "../../src/api/client",
  );
  return { ...actual, request: vi.fn() };
});
import { request, ApiError } from "../../src/api/client";
import { requestAi } from "../../src/features/ai/ai.api";
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
