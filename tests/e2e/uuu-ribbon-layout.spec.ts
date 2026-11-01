import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("UUU ribbon joins its cover gradient along one diagonal at editing and thumbnail sizes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1100, height: 1100 });
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const prefix = path.startsWith("/api/assets/legacy/")
        ? "/api/assets/legacy/"
        : path.startsWith("/api/assets/app/fonts/")
          ? "/api/assets/app/"
          : "";
      if (prefix) {
        try {
          return await route.fulfill({
            body: await readFile(
              resolve(
                "../neptun-campaign-studio/public",
                path.slice(prefix.length),
              ),
            ),
          });
        } catch {
          return route.fulfill({ status: 404, body: "" });
        }
      }
      return route.fulfill({ json: {} });
    },
  );
  await page.route("**/__uuu-ribbon-layout", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/e2e/fixtures/uuu-ribbon-layout.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__uuu-ribbon-layout");
  await expect(
    page.locator("[data-ribbon-preset] .brochure-cover"),
  ).toHaveCount(4);
  await page.evaluate(() => document.fonts.ready);
  const covers = page.locator("[data-ribbon-preset] .brochure-cover");
  for (const cover of await covers.all()) {
    const geometry = await cover.evaluate((element) => {
      const ribbon = element.querySelector(
        ".october-cover-ribbon > svg",
      ) as SVGSVGElement;
      const body = element.querySelector(".october-cover-body")!;
      const bodyRect = body.getBoundingClientRect();
      const points = getComputedStyle(body)
        .clipPath.match(/[\d.]+/g)!
        .map(Number);
      const ribbonPoint = (x: number, y: number) =>
        new DOMPoint(x, y).matrixTransform(ribbon.getScreenCTM()!);
      const artwork = element.querySelector(".october-default-band > img")!;
      const artRect = artwork.getBoundingClientRect();
      const artPoints = getComputedStyle(artwork)
        .clipPath.match(/[\d.]+/g)!
        .map(Number);
      const lowerEdgeAt = (x: number) => {
        const left = ribbonPoint(0, 190),
          right = ribbonPoint(1080, 130);
        return (
          left.y + ((x - left.x) / (right.x - left.x)) * (right.y - left.y)
        );
      };
      const message = element.querySelector(".cover-element-message > p")!;
      const style = getComputedStyle(message);
      const matrix = new DOMMatrix(style.transform);
      return {
        bodyLeft: bodyRect.top + (bodyRect.height * points[1]!) / 100,
        bodyRight: bodyRect.top + (bodyRect.height * points[3]!) / 100,
        ribbonLeft: lowerEdgeAt(bodyRect.left),
        ribbonRight: lowerEdgeAt(bodyRect.right),
        artLeft: artRect.top + (artRect.height * artPoints[7]!) / 100,
        artRight: artRect.top + (artRect.height * artPoints[5]!) / 100,
        artRibbonLeft: lowerEdgeAt(artRect.left),
        artRibbonRight: lowerEdgeAt(artRect.right),
        angle: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
        alignment: style.textAlign,
        messageSurface: getComputedStyle(message.parentElement!)
          .backgroundColor,
      };
    });
    expect(Math.abs(geometry.bodyLeft - geometry.ribbonLeft)).toBeLessThan(0.1);
    expect(Math.abs(geometry.bodyRight - geometry.ribbonRight)).toBeLessThan(
      0.1,
    );
    expect(Math.abs(geometry.artLeft - geometry.artRibbonLeft)).toBeLessThan(
      0.1,
    );
    expect(Math.abs(geometry.artRight - geometry.artRibbonRight)).toBeLessThan(
      0.1,
    );
    expect(geometry.bodyLeft).toBeGreaterThan(geometry.bodyRight);
    expect(geometry.angle).toBeCloseTo(-3.18, 2);
    expect(geometry.alignment).toBe("left");
    expect(geometry.messageSurface).toBe("rgba(0, 0, 0, 0)");
  }
  const custom = page.locator("[data-custom-ribbon]");
  await expect(custom.locator(".october-cover-body-default")).toHaveCount(0);
  await expect(custom.locator(".october-default-band")).toHaveCount(0);
  expect(
    await custom.locator(".cover-element-message").evaluate((element) => {
      const style = (element as HTMLElement).style;
      return [style.left, style.top, style.width, style.height];
    }),
  ).toEqual(["50%", "44%", "40%", "6%"]);
  await page
    .locator('[data-ribbon-preset="neptun-uuu-gray"]')
    .screenshot({ path: "/tmp/neptun-uuu-ribbon-corrected.png" });
  expect(errors).toEqual([]);
});
