import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("single offers stay centered, footer numbers stay horizontal, and product menus escape page clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1040, height: 1050 });
  const errors: string[] = [];
  const aiCalls: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (/\/ai|lifestyle/.test(path)) aiCalls.push(path);
      if (path === "/api/assets/uploads")
        return route.fulfill({
          json: {
            id: "00000000-0000-4000-8000-000000000001",
            uploadUrl: "/api/assets/layer-upload",
            headers: {},
          },
        });
      if (path === "/api/assets/layer-upload")
        return route.fulfill({ status: 204 });
      if (path.endsWith("/confirm"))
        return route.fulfill({ json: { url: "/api/assets/new-layer.png" } });
      const prefix = path.startsWith("/api/assets/app/fonts/")
        ? "/api/assets/app/"
        : path.startsWith("/api/assets/legacy/")
          ? "/api/assets/legacy/"
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
          /* Optional fixture asset. */
        }
      }
      return route.fulfill({ json: { products: [], assets: [] } });
    },
  );
  await page.route("**/__single-product-workspace", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="single-product-fixture"></div><script type="module" src="/tests/e2e/fixtures/single-product-workspace.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__single-product-workspace");
  const composition = page.locator(".brochure-products");
  const card = page.locator(".brochure-product");
  for (const mode of ["missing", "apple", "classic"]) {
    await page.getByLabel("Case", { exact: true }).selectOption(mode);
    await expect(card).toHaveCount(1);
    const alignment = await card.evaluate((element) => {
      const r = element.getBoundingClientRect(),
        p = element.parentElement!.getBoundingClientRect();
      return {
        x: (r.left + r.width / 2 - p.left) / p.width,
        y: (r.top + r.height / 2 - p.top) / p.height,
        width: r.width / p.width,
        height: r.height / p.height,
      };
    });
    expect(alignment.x).toBeCloseTo(0.5, 2);
    expect(alignment.y).toBeCloseTo(0.5, 2);
    expect(alignment.width).toBeGreaterThan(0.62);
    expect(alignment.width).toBeLessThan(0.66);
    expect(alignment.height).toBeCloseTo(0.76, 2);
  }
  await page.getByLabel("Case", { exact: true }).selectOption("missing");
  await expect(page.locator(".missing-catalog-placeholder")).toBeVisible();
  for (const number of ["1", "12", "100"]) {
    await page.getByLabel("Page number fixture").fill(number);
    const pagination = page.locator(".october-page-number");
    await expect(pagination).toHaveText(number);
    const geometry = await pagination.evaluate((element) => {
      const r = element.getBoundingClientRect(),
        line = document
          .querySelector(".october-footer-rule")!
          .getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      return {
        rects: range.getClientRects().length,
        center: r.top + r.height / 2,
        lineCenter: line.top + line.height / 2,
        left: r.left,
        lineRight: line.right,
        whiteSpace: getComputedStyle(element).whiteSpace,
      };
    });
    expect(geometry.rects).toBe(1);
    expect(geometry.whiteSpace).toBe("nowrap");
    expect(Math.abs(geometry.center - geometry.lineCenter)).toBeLessThan(2);
    expect(geometry.left - geometry.lineRight).toBeGreaterThan(4);
  }
  await page
    .locator(".brochure-page")
    .screenshot({ path: "/tmp/neptun-single-product-centered.png" });
  await page
    .locator(".october-footer-number")
    .screenshot({ path: "/tmp/neptun-footer-number-100.png" });
  await page.getByLabel("Case", { exact: true }).selectOption("custom");
  await expect(page.locator(".brochure-page")).toHaveClass(
    /custom-card-layout/,
  );
  expect(
    await card.evaluate(
      (element) =>
        element.getBoundingClientRect().width /
        element.parentElement!.getBoundingClientRect().width,
    ),
  ).toBeLessThan(0.6);
  expect(
    await page
      .locator(".brochure-product-image")
      .evaluate((element) => (element as HTMLElement).style.transform),
  ).toContain("scale(0.82)");
  await page.getByLabel("Case", { exact: true }).selectOption("pair");
  const trigger = page.locator(".cs-product-tools > summary").last();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const menu = page.locator(".cs-product-menu-popover:visible");
  await expect(menu).toBeVisible();
  expect(
    await menu.evaluate((element) => element.closest(".brochure-page")),
  ).toBeNull();
  const rect = await menu.boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(8);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(1032);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(1042);
  await expect(
    menu.getByRole("button", { name: "Change image: Second headphones" }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/neptun-product-menu-portal.png" });
  await menu
    .getByRole("button", { name: "Add image layer: Second headphones" })
    .click();
  const editor = page.locator("[data-product-artwork-editor]");
  await expect(editor).toHaveAttribute("open");
  await expect(editor.getByLabel("Add image to this product")).toBeAttached();
  const details = page.getByRole("dialog", {
    name: "Product details",
    exact: true,
  });
  const live = details.getByRole("region", {
    name: "Product preview",
    exact: true,
  });
  await expect(live).toBeVisible();
  await details
    .getByRole("textbox", { name: "Detail value 1", exact: true })
    .fill("Bluetooth\nUpdated feature");
  await expect(live.locator(".brochure-specs")).toContainText(
    "Updated feature",
  );
  await details
    .getByRole("button", { name: "Move down 1", exact: true })
    .click();
  await expect(
    details.getByRole("textbox", { name: "Detail value 2", exact: true }),
  ).toHaveValue("Bluetooth\nUpdated feature");
  await details.screenshot({
    path: "artifacts/neptun-product-details-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await details.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await expect(details.getByRole("button",{ name:"Close",exact:true })).toBeInViewport();
  await details.screenshot({path: "artifacts/neptun-product-details-mobile.png"});
  await page.setViewportSize({ width: 1040, height: 1050 });

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await trigger.click();
  await menu
    .getByRole("button", { name: "Change image: Second headphones" })
    .click();
  await page
    .getByRole("button", { name: "Add image layer", exact: true })
    .click();
  await expect(editor).toHaveAttribute("open");
  const upload = editor.locator('input[type="file"]').last();
  await upload.setInputFiles({
    name: "Layer.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5b0scAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(editor.getByLabel("Image label 1")).toHaveValue("Layer");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    page.locator('.product-artwork-item img[src$="/api/assets/new-layer.png"]'),
  ).toHaveCount(1);
  await expect(page.locator(".brochure-product-image").last()).toHaveAttribute(
    "src",
    /^data:image\/svg\+xml/,
  );
  expect(aiCalls).toEqual([]);
  expect(errors).toEqual([]);
  await composition.screenshot({
    path: "/tmp/neptun-single-product-workspace.png",
  });
});
