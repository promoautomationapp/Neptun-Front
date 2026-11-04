// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import worker from "../../cloudflare/worker";
import { createHmac } from "node:crypto";

const origin = "https://neptun-backend.onrender.com";
const env = () => ({ API_ORIGIN: origin, ASSETS: { fetch: vi.fn() } });
afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare frontend API forwarding", () => {
  test("signs private metadata server-side and overwrites spoofed forwarding headers", async () => {
    const secret = "test-only-edge-key-32-characters-long";
    const outbound = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", outbound);
    await worker.fetch(
      new Request("https://studio.example.com/api/probe?q=1", {
        method: "POST",
        headers: {
          "CF-Connecting-IP": "203.0.113.42",
          "X-Neptun-Edge-Signature": "fake",
          "X-Neptun-Edge-Extra": "fake",
          "X-Forwarded-For": "1.2.3.4",
        },
        body: "{}",
      }),
      {
        ...env(),
        EDGE_PROXY_SECRET: secret,
        PUBLIC_APP_ORIGIN: "https://studio.example.com",
      },
    );
    const forwarded = outbound.mock.calls[0]?.[0] as Request;
    const timestamp = forwarded.headers.get("x-neptun-edge-timestamp");
    expect(forwarded.headers.get("x-neptun-edge-signature")).toBe(
      createHmac("sha256", secret)
        .update(
          [
            "v1",
            timestamp,
            "POST",
            "/api/probe?q=1",
            "203.0.113.42",
            "https://studio.example.com",
          ].join("\n"),
        )
        .digest("hex"),
    );
    expect(forwarded.headers.has("x-forwarded-for")).toBe(false);
    expect(forwarded.headers.has("x-neptun-edge-extra")).toBe(false);
  });
  test("blocks unapproved hosts and browser origins before reaching Render", async () => {
    const outbound = vi.fn();
    vi.stubGlobal("fetch", outbound);
    const bindings = {
      ...env(),
      PUBLIC_APP_ORIGIN: "https://studio.example.com",
    };
    expect(
      (
        await worker.fetch(
          new Request("https://other.example.com/api/team/session"),
          bindings,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await worker.fetch(
          new Request("https://studio.example.com/api/team/login", {
            headers: { Origin: "https://other.example.com" },
          }),
          bindings,
        )
      ).status,
    ).toBe(403);
    expect(outbound).not.toHaveBeenCalled();
  });
  test("preserves sign-in body, origin, cookies and secure Set-Cookie headers", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response('{"user":{}}', {
        status: 201,
        headers: {
          "Set-Cookie":
            "session=opaque; HttpOnly; Secure; SameSite=Lax; Path=/",
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const request = new Request("https://studio.example.com/api/team/login", {
      method: "POST",
      headers: {
        Origin: "https://studio.example.com",
        Cookie: "session=old",
        "Content-Type": "application/json",
        Host: "studio.example.com",
      },
      body: '{"email":"admin@example.test","password":"test-only"}',
    });
    const response = await worker.fetch(request, env());
    const forwarded = fetch.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(`${origin}/api/team/login`);
    expect(forwarded.method).toBe("POST");
    expect(await forwarded.text()).toContain('"email":"admin@example.test"');
    expect(forwarded.headers.get("Origin")).toBe("https://studio.example.com");
    expect(forwarded.headers.get("Cookie")).toBe("session=old");
    expect(forwarded.headers.has("Host")).toBe(false);
    expect(response.status).toBe(201);
    expect(response.headers.get("Set-Cookie")).toContain(
      "HttpOnly; Secure; SameSite=Lax",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      redirect: "manual",
      cache: "no-store",
    });
  });

  test("serves SPA routes and branding through the asset binding", async () => {
    const bindings = env();
    const response = new Response("frontend");
    bindings.ASSETS.fetch.mockResolvedValue(response);
    const outbound = vi.fn();
    vi.stubGlobal("fetch", outbound);
    for (const path of [
      "/classic",
      "/branding/neptun-logo.png",
      "/favicon.svg",
      "/api-example",
    ])
      expect(
        await worker.fetch(
          new Request(`https://studio.example.com${path}`),
          bindings,
        ),
      ).toBe(response);
    expect(outbound).not.toHaveBeenCalled();
  });

  test("keeps asset bytes, status and private cache headers intact", async () => {
    const pixels = new Uint8Array([1, 2, 3, 255]);
    const fetch = vi.fn().mockResolvedValue(
      new Response(pixels, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=31536000, immutable",
          Vary: "Cookie",
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await worker.fetch(
      new Request(
        "https://studio.example.com/api/assets/photo?url=https://untrusted.example",
      ),
      env(),
    );
    expect(new URL((fetch.mock.calls[0]?.[0] as Request).url).origin).toBe(
      origin,
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pixels);
    expect(response.headers.get("Cache-Control")).toContain("private");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("CDN-Cache-Control")).toBe("no-store");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "no-store",
    );
  });

  test.each([
    ["/api/team/session", "GET", 200],
    ["/api/documents", "GET", 200],
    ["/api/assets/uploads", "POST", 201],
    ["/api/assets/photo", "GET", 403],
    ["/api/assets/photo", "GET", 404],
    ["/api/assets/photo", "GET", 429],
  ])("never browser-caches %s %s status %s", async (path, method, status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("private data", {
          status,
          headers: {
            "Cache-Control": "public, max-age=31536000, immutable",
            Expires: "Thu, 01 Jan 2099 00:00:00 GMT",
            Vary: "Origin",
          },
        }),
      ),
    );
    const reply = await worker.fetch(
      new Request(`https://studio.example.com${path}`, { method }),
      env(),
    );
    expect(reply.status).toBe(status);
    expect(await reply.text()).toBe("private data");
    expect(reply.headers.get("Cache-Control")).toBe("private, no-store");
    expect(reply.headers.has("Expires")).toBe(false);
    expect(reply.headers.get("Vary")).toBe("origin, cookie, authorization");
    expect(reply.headers.get("Cloudflare-CDN-Cache-Control")).toBe("no-store");
  });

  test("does not cache an upstream connection failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const reply = await worker.fetch(
      new Request("https://studio.example.com/api/team/session"),
      env(),
    );
    expect(reply.status).toBe(502);
    expect(reply.headers.get("Cache-Control")).toBe("private, no-store");
  });

  test("returns a controlled error for a missing, insecure or looping upstream", async () => {
    const outbound = vi.fn();
    vi.stubGlobal("fetch", outbound);
    for (const address of [
      "",
      "http://backend.example",
      "https://user:password@backend.example",
      "https://studio.example.com",
      `${origin}/other-path`,
    ]) {
      const response = await worker.fetch(
        new Request("https://studio.example.com/api/team/session"),
        { ...env(), API_ORIGIN: address },
      );
      expect(response.status).toBe(503);
    }
    expect(outbound).not.toHaveBeenCalled();
  });
});
