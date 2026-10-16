import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLiveSession } from "../../src/features/auth/useLiveSession";
import type { User } from "../../src/features/auth/auth.api";
const user: User = {
  id: "staff",
  name: "Staff",
  email: "staff@example.test",
  role: "staff",
  permissions: "editor",
  organizationId: "00000000-0000-4000-8000-000000000000",
  mustChangePassword: false,
  isSupport: false,
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("deduplicates focus events, preserves sessions through network failure and revokes disabled accounts", async () => {
  let resolve!: (response: Response) => void;
  const api = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    )
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ configured: true, user: null })),
    );
  vi.stubGlobal("fetch", api);
  const changed = vi.fn();
  renderHook(() => useLiveSession(user, changed));
  expect(api).not.toHaveBeenCalled();
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(api).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(new Response(JSON.stringify({ configured: true, user })));
  });
  expect(changed).not.toHaveBeenCalled();
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(changed).not.toHaveBeenCalled();
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(changed).toHaveBeenCalledWith(null);
});
it("polls only visible pages and aborts an outstanding request on unmount", async () => {
  vi.useFakeTimers();
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("hidden");
  let signal: AbortSignal | undefined;
  const api = vi.fn((_input, init?: RequestInit) => {
    signal = init?.signal || undefined;
    return new Promise<Response>(() => {});
  });
  vi.stubGlobal("fetch", api);
  const view = renderHook(() => useLiveSession(user, vi.fn()));
  await act(async () => {
    vi.advanceTimersByTime(60_000);
  });
  expect(api).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(api).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(signal?.aborted).toBe(true);
});
