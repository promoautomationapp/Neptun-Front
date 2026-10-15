import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { request } from "../../src/api/client";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("releases a stalled write without repeating a possibly saved mutation", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn<typeof globalThis.fetch>(
    () => new Promise<Response>(() => undefined),
  );
  vi.stubGlobal("fetch", fetch);
  const pending = request("/api/team/campaigns", z.object({}), {
    method: "POST",
    body: { campaign: { id: "example" } },
    timeoutMs: 50,
  });
  const rejected = expect(pending).rejects.toMatchObject({
    code: "REQUEST_TIMEOUT",
  });
  await vi.advanceTimersByTimeAsync(50);
  await rejected;
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
});

it("also bounds a response whose headers arrived but JSON body never finishes", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: () => new Promise(() => undefined) })),
  );
  const pending = request("/api/team/campaigns", z.object({}), {
    timeoutMs: 50,
  });
  const rejected = expect(pending).rejects.toMatchObject({
    code: "REQUEST_TIMEOUT",
  });
  await vi.advanceTimersByTimeAsync(50);
  await rejected;
});

it("preserves caller cancellation and clears request deadline resources", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => undefined)),
  );
  const controller = new AbortController();
  const pending = request("/api/team/campaigns", z.object({}), {
    signal: controller.signal,
  });
  const reason = new DOMException("Left this screen", "AbortError");
  const rejected = expect(pending).rejects.toBe(reason);
  controller.abort(reason);
  await rejected;
  expect(vi.getTimerCount()).toBe(0);
});
