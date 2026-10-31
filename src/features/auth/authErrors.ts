import { ApiError } from "../../api/client";

const publicMessages = new Set([
  "Incorrect email or password.",
  "Your current password is incorrect.",
  "Choose a password different from your current password.",
  "Your password changed in another session. Sign in again.",
  "This link has expired.",
  "This link is invalid or has expired.",
  "This link or verification code is invalid or has expired.",
  "This link or code is invalid or has expired. Request a new one.",
  "Create your password before requesting a verification code.",
]);

/** Public account screens never expose transport or internal server errors. */
export function authErrorMessage(
  error: unknown,
  fallback = "Could not complete this request. Please try again.",
): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (
    /failed to fetch|fetch failed|networkerror|network request failed|load failed|failed to load|econnrefused|err_network/i.test(
      message,
    ) ||
    (error instanceof ApiError && [0, 502, 503, 504].includes(error.status))
  )
    return "We couldn’t connect to Neptun. Check your connection and try again.";
  if (error instanceof ApiError) {
    if (error.status === 408 || error.code === "REQUEST_TIMEOUT")
      return "The connection is taking longer than expected. Please try again.";
    if (error.status === 429)
      return "Too many attempts. Please wait a few minutes, then try again.";
    if (publicMessages.has(message)) return message;
    if (error.status >= 500)
      return "Neptun is temporarily unavailable. Please try again shortly.";
  }
  return fallback;
}
