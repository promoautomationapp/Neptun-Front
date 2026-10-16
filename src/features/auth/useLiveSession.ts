import { useEffect, useRef } from "react";
import { ApiError } from "../../api/client";
import { getSession, userSchema, type User } from "./auth.api";

const sessionKey = (user: User | null) =>
  user ? JSON.stringify(userSchema.parse(user)) : "null";

/** Refresh access without unmounting the workspace or repeating the initial login check. */
export function useLiveSession(
  user: User | null,
  onChange: (user: User | null) => void,
) {
  const current = useRef({ user, onChange });
  current.current = { user, onChange };
  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const result = await getSession(controller.signal);
        if (
          !controller.signal.aborted &&
          sessionKey(result.user) !== sessionKey(current.current.user)
        )
          current.current.onChange(result.user);
      } catch (error) {
        if (
          !controller.signal.aborted &&
          error instanceof ApiError &&
          error.status === 401
        )
          current.current.onChange(null);
        // A temporary connection failure must not discard an authenticated workspace.
      } finally {
        pending = false;
      }
    }
    const timer = setInterval(() => void refresh(), 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user?.id]);
}
