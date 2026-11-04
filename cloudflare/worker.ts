export interface FrontendWorkerEnv {
  API_ORIGIN: string;
  PUBLIC_APP_ORIGIN?: string;
  EDGE_PROXY_SECRET?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

function privateApiResponse(
  response: Response,
  request: Request,
  path: string,
): Response {
  const reply = new Response(response.body, response);
  const policy = response.headers.get("Cache-Control") || "";
  const browserCacheableAsset =
    ["GET", "HEAD"].includes(request.method) &&
    path.startsWith("/api/assets/") &&
    (response.ok || response.status === 304) &&
    /(?:^|,)\s*private\s*(?:,|$)/i.test(policy) &&
    /(?:^|,)\s*immutable\s*(?:,|$)/i.test(policy) &&
    !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(policy);

  // Owned media can reuse its existing private browser cache. Sessions,
  // documents, mutations and errors must never be stored by the browser.
  if (!browserCacheableAsset) {
    reply.headers.set("Cache-Control", "private, no-store");
    reply.headers.delete("Expires");
    const vary = new Set(
      (reply.headers.get("Vary") || "")
        .split(",")
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    );
    if (!vary.has("*")) {
      vary.add("cookie");
      vary.add("authorization");
      reply.headers.set("Vary", [...vary].join(", "));
    }
  }
  reply.headers.set("CDN-Cache-Control", "no-store");
  reply.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  return reply;
}

/** Static frontend plus a fixed upstream API; no database or media credentials. */
export default {
  async fetch(request: Request, env: FrontendWorkerEnv): Promise<Response> {
    const incoming = new URL(request.url);
    if (incoming.pathname !== "/api" && !incoming.pathname.startsWith("/api/"))
      return env.ASSETS.fetch(request);

    const allowedOrigin = env.PUBLIC_APP_ORIGIN || incoming.origin;
    if (
      incoming.origin !== allowedOrigin ||
      (request.headers.has("Origin") &&
        request.headers.get("Origin") !== allowedOrigin) ||
      (!request.headers.has("Origin") &&
        request.headers.get("Sec-Fetch-Site") === "cross-site")
    )
      return privateApiResponse(
        Response.json(
          { error: "Request origin is not allowed." },
          { status: 403 },
        ),
        request,
        incoming.pathname,
      );

    let origin: URL;
    try {
      origin = new URL(env.API_ORIGIN);
      if (
        origin.protocol !== "https:" ||
        origin.username ||
        origin.password ||
        origin.pathname !== "/" ||
        origin.search ||
        origin.hash ||
        origin.origin === incoming.origin
      )
        throw new Error("Invalid upstream origin.");
    } catch {
      return privateApiResponse(
        Response.json(
          { error: "The backend address is not configured." },
          { status: 503 },
        ),
        request,
        incoming.pathname,
      );
    }

    // Assign the path rather than resolving user input against the base URL,
    // so query parameters and unusual paths cannot change the upstream host.
    const target = new URL(origin.origin);
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    const upstream = new Request(target, request);
    upstream.headers.delete("Host");
    // Overwrite reserved metadata, including any browser-supplied lookalikes.
    for (const name of [...upstream.headers.keys()])
      if (
        name.startsWith("x-neptun-edge-") ||
        ["forwarded", "x-forwarded-for", "x-real-ip"].includes(name)
      )
        upstream.headers.delete(name);
    if (env.EDGE_PROXY_SECRET) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const clientIp = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
      const payload = [
        "v1",
        timestamp,
        request.method,
        target.pathname + target.search,
        clientIp,
        incoming.origin,
      ].join("\n");
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(env.EDGE_PROXY_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(payload),
      );
      upstream.headers.set("X-Neptun-Edge-Timestamp", timestamp);
      upstream.headers.set("X-Neptun-Edge-Client-IP", clientIp);
      upstream.headers.set("X-Neptun-Edge-Origin", incoming.origin);
      upstream.headers.set(
        "X-Neptun-Edge-Signature",
        [...new Uint8Array(signature)]
          .map((value) => value.toString(16).padStart(2, "0"))
          .join(""),
      );
    }
    try {
      return privateApiResponse(
        await fetch(upstream, { redirect: "manual", cache: "no-store" }),
        request,
        incoming.pathname,
      );
    } catch {
      return privateApiResponse(
        Response.json(
          { error: "Could not reach the backend. Please try again." },
          { status: 502 },
        ),
        request,
        incoming.pathname,
      );
    }
  },
};
