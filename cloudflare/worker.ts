export interface FrontendWorkerEnv {
  API_ORIGIN: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

/** Static frontend plus a fixed upstream API; no database or media credentials. */
export default {
  async fetch(request: Request, env: FrontendWorkerEnv): Promise<Response> {
    const incoming = new URL(request.url);
    if (incoming.pathname !== "/api" && !incoming.pathname.startsWith("/api/"))
      return env.ASSETS.fetch(request);

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
      return Response.json(
        { error: "The backend address is not configured." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Assign the path rather than resolving user input against the base URL,
    // so query parameters and unusual paths cannot change the upstream host.
    const target = new URL(origin.origin);
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    const upstream = new Request(target, request);
    upstream.headers.delete("Host");
    try {
      return await fetch(upstream, { redirect: "manual", cache: "no-store" });
    } catch {
      return Response.json(
        { error: "Could not reach the backend. Please try again." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
  },
};
