import { z } from "zod";
export const API_URL = String(import.meta.env.VITE_API_URL || "").replace(
  /\/$/,
  "",
);
export const SESSION_EXPIRED_EVENT = "neptun:session-expired";
function sessionExpired(path: string, response: Response, message?: string) {
  if (
    response.status === 401 &&
    path.startsWith("/api/") &&
    (!/^\/api\/team\/(?:login|change-password|invitations?|reset-password|forgot-password)(?:\/|\?|$)/.test(
      path,
    ) ||
      message === "Sign in to continue.")
  )
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
function retryAfterSeconds(
  header: string | null,
  body?: number,
): number | undefined {
  const seconds = header === null ? NaN : Number(header);
  const fromHeader =
    Number.isFinite(seconds) && seconds >= 0
      ? seconds
      : header
        ? (Date.parse(header) - Date.now()) / 1000
        : NaN;
  const value = Math.max(
    Number.isFinite(fromHeader) ? fromHeader : 0,
    body ?? 0,
  );
  return value > 0 ? Math.ceil(value) : undefined;
}
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new ApiError(
          "The connection is taking too long. Your existing work is kept.",
          408,
          "REQUEST_TIMEOUT",
        ),
      ),
    options.timeoutMs ?? 60_000,
  );
  let stopWaiting: () => void = () => undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    const onAbort = () =>
      reject(
        controller.signal.reason ?? new DOMException("Aborted", "AbortError"),
      );
    stopWaiting = () => controller.signal.removeEventListener("abort", onAbort);
    if (controller.signal.aborted) onAbort();
    else controller.signal.addEventListener("abort", onAbort, { once: true });
  });
  const run = async () => {
    controller.signal.throwIfAborted();
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      signal: controller.signal,
      headers:
        options.body !== undefined
          ? { "Content-Type": "application/json" }
          : undefined,
      body:
        options.body !== undefined
          ? JSON.stringify(
              /\/api\/(?:team\/(?:campaigns|posts|settings)|ai(?:-|\/jobs))/.test(
                path,
              )
                ? mapAssetUrls(options.body, false)
                : options.body,
            )
          : undefined,
    });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = z
        .object({
          error: z.string().optional(),
          code: z.string().optional(),
          retryAfterSeconds: z.number().positive().optional(),
        })
        .safeParse(result);
      sessionExpired(
        path,
        response,
        error.success ? error.data.error : undefined,
      );
      throw new ApiError(
        error.success
          ? (error.data.error ?? `Request failed (${response.status})`)
          : `Request failed (${response.status})`,
        response.status,
        error.success ? error.data.code : undefined,
        retryAfterSeconds(
          response.headers.get("Retry-After"),
          error.success ? error.data.retryAfterSeconds : undefined,
        ),
      );
    }
    return mapAssetUrls(schema.parse(result), true);
  };
  try {
    // Includes response-body reads; an opened connection is not a completed request.
    // Writes are never replayed here because the server may already have saved them.
    return await Promise.race([run(), interrupted]);
  } finally {
    clearTimeout(timer);
    stopWaiting();
    options.signal?.removeEventListener("abort", abort);
  }
}
export function resolveAsset(path: string): string {
  if (
    path.startsWith("/assets/") ||
    path.startsWith("/fonts/") ||
    path.startsWith("/catalog-images/")
  )
    return `${API_URL}/api/assets/legacy${path}`;
  return path.startsWith("/api/") ? `${API_URL}${path}` : path;
}
export async function apiFetch(
  input: RequestInfo | URL,
  options: RequestInit = {},
): Promise<Response> {
  const path =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const api = path.startsWith("/api/");
  const response = await fetch(api ? `${API_URL}${path}` : input, {
    ...options,
    ...(api ? { credentials: "include" as const } : {}),
  });
  if (api) sessionExpired(path, response);
  return response;
}
export async function uploadImage(file: File): Promise<string> {
  const intent = await request(
    "/api/assets/uploads",
    z.object({
      id: z.uuid(),
      uploadUrl: z.string(),
      headers: z.record(z.string(), z.string()),
    }),
    { method: "POST", body: { size: file.size, mimeType: file.type } },
  );
  const url = intent.uploadUrl.startsWith("/api/")
    ? `${API_URL}${intent.uploadUrl}`
    : intent.uploadUrl;
  const response = await fetch(url, {
    method: "PUT",
    headers: intent.headers,
    body: file,
    ...(intent.uploadUrl.startsWith("/api/")
      ? { credentials: "include" as const }
      : {}),
  });
  if (!response.ok) throw new ApiError("Image upload failed.", response.status);
  return (
    await request(
      `/api/assets/uploads/${intent.id}/confirm`,
      z.object({ url: z.string() }),
      { method: "POST" },
    )
  ).url;
}

/** The same relative asset URLs used by document writes and reconciliation. */
export function normalizeApiDocument<T>(value: T): T {
  return mapAssetUrls(value, false);
}
function mapAssetUrls<T>(value: T, absolute: boolean): T {
  const visit = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(visit);
    if (input && typeof input === "object")
      return Object.fromEntries(
        Object.entries(input).map(([key, item]) => [key, visit(item)]),
      );
    if (typeof input !== "string") return input;
    if (absolute && /^\/api\/(?:assets|ai-cutouts|brand-logos)\//.test(input))
      return `${API_URL}${input}`;
    if (!absolute && API_URL && input.startsWith(`${API_URL}/api/`))
      return input.slice(API_URL.length);
    return input;
  };
  return visit(value) as T;
}
