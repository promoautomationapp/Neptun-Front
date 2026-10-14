import { z } from "zod";
export const API_URL = String(import.meta.env.VITE_API_URL || "").replace(
  /\/$/,
  "",
);
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    signal: options.signal,
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
      .object({ error: z.string().optional(), code: z.string().optional() })
      .safeParse(result);
    throw new ApiError(
      error.success
        ? (error.data.error ?? `Request failed (${response.status})`)
        : `Request failed (${response.status})`,
      response.status,
      error.success ? error.data.code : undefined,
    );
  }
  return mapAssetUrls(schema.parse(result), true);
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
export function apiFetch(
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
  return fetch(api ? `${API_URL}${path}` : input, {
    ...options,
    ...(api ? { credentials: "include" as const } : {}),
  });
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
