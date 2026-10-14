// @vitest-environment node
import { afterEach, describe, expect, test, vi } from "vitest";
import worker from "../../cloudflare/worker";

const origin = "https://neptun-backend.onrender.com";
const env = () => ({ API_ORIGIN: origin, ASSETS: { fetch: vi.fn() } });
afterEach(() => vi.unstubAllGlobals());

describe("Cloudflare frontend API forwarding", () => {
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
    const fetch = vi
      .fn()
      .mockResolvedValue(
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
