import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
test("five reference designs keep exact backgrounds, layouts, branding and empty campaign photo slots", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1760, height: 1100 });
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
          return route.fulfill({
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
  await page.route("**/__preset-gallery", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/e2e/fixtures/preset-gallery.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__preset-gallery");
  await expect(page.locator("[data-preset]")).toHaveCount(5);
  for (const id of ["neptun-current", "neptun-gradient-all"])
    await expect(
      page.locator(
        `[data-preset="${id}"] .brochure-cover .cover-product-frame`,
      ),
    ).toHaveCount(3);
  for (const id of ["neptun-october", "neptun-uuu-gray"])
    await expect(
      page.locator(`[data-preset="${id}"] .cover-element-band img`),
    ).toHaveAttribute("src", "/brochure-presets/october/uuu-hajde.svg");
  const blue = page.locator('[data-preset="neptun-october"]');
  expect(
    await blue
      .locator(".brochure-output-page")
      .first()
      .evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe("rgb(27, 64, 117)");
  expect(
    await blue
      .locator(".brochure-output-page")
      .last()
      .evaluate((e) => getComputedStyle(e).backgroundColor),
  ).toBe("rgb(27, 64, 117)");
  for (const id of ["neptun-current", "neptun-uuu-gray", "neptun-online"])
    expect(
      await page
        .locator(`[data-preset="${id}"] .brochure-output-page`)
        .last()
        .evaluate((e) => getComputedStyle(e).backgroundColor),
    ).toBe("rgb(227, 227, 227)");
  const all = page.locator('[data-preset="neptun-gradient-all"]');
  const gradient = await all
    .locator(".brochure-output-page")
    .first()
    .evaluate((e) => getComputedStyle(e).backgroundImage);
  expect(gradient).toBe(
    "linear-gradient(rgb(35, 65, 115), rgb(134, 179, 222))",
  );
  expect(
    await all
      .locator(".brochure-output-page")
      .last()
      .evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toBe(gradient);
  const horizontal = page.locator('[data-preset="neptun-uuu-gray"]');
  expect(
    await horizontal
      .locator(".october-cover-body")
      .evaluate((e) => getComputedStyle(e).backgroundImage),
  ).toBe("linear-gradient(90deg, rgb(35, 65, 115), rgb(134, 179, 222))");
  await expect(
    page.locator('[data-preset="neptun-online"] .cover-online-word'),
  ).toHaveCSS("color", "rgb(255, 66, 40)");
  await expect(page.locator(".october-cover-photo>img")).toHaveCount(0);
  expect(
    (
      await page
        .locator(".cover-element-message, .cover-element-headline")
        .allTextContents()
    ).join(" "),
  ).not.toMatch(/tetor|October|vjesht/i);
  await page.screenshot({
    path: "artifacts/neptun-five-presets.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
