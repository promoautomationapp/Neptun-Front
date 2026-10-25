import { expect, test } from "@playwright/test";

test("Blue details match the phone column and horizontal product rows while retaining reference pricing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 1500 });
  await page.route("**/fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => route.fulfill({ status: 404, body: "" }),
  );
  await page.route("**/__blue-detail-layout", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="blue-detail-fixture"></div><script type="module" src="/tests/e2e/fixtures/blue-detail-layout.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__blue-detail-layout");
  const cards = page.locator("#blue-detail-fixture .brochure-product");
  await expect(cards).toHaveCount(4);
  await expect(cards.first()).toHaveClass(/\bdetails-left\b/);
  await expect(cards.first().locator(".brochure-specs")).toHaveAttribute(
    "data-detail-layout",
    "left",
  );
  const phone = await cards.first().evaluate((card) => {
    const specs = card.querySelector(".brochure-specs")!;
    const image = card.querySelector(".brochure-product-image")!;
    const details = specs.getBoundingClientRect(),
      photo = image.getBoundingClientRect();
    return {
      direction: getComputedStyle(specs).flexDirection,
      detailsRight: details.right,
      photoMiddle: photo.x + photo.width / 2,
    };
  });
  expect(phone.direction).toBe("column");
  expect(phone.detailsRight).toBeLessThan(phone.photoMiddle);
  for (const index of [1, 2, 3]) {
    const card = cards.nth(index);
    await expect(card).not.toHaveClass(/\bdetails-left\b/);
    await expect(card.locator(".brochure-specs")).toHaveAttribute(
      "data-detail-layout",
      "strip",
    );
    const geometry = await card.evaluate((node) => {
      const photo = node
        .querySelector(".brochure-product-image-wrap")!
        .getBoundingClientRect();
      const strip = node.querySelector(".brochure-specs")!;
      const details = strip.getBoundingClientRect();
      const bottom = node
        .querySelector(".brochure-product-bottom")!
        .getBoundingClientRect();
      const blocks = [...strip.querySelectorAll(".product-detail-block")].map(
        (block) => block.getBoundingClientRect(),
      );
      const border = getComputedStyle(
        strip.querySelector(".product-detail-block")!,
      );
      return {
        direction: getComputedStyle(strip).flexDirection,
        imageBottom: photo.bottom,
        detailTop: details.top,
        detailBottom: details.bottom,
        bottomTop: bottom.top,
        sameRow: blocks.every(
          (block) => Math.abs(block.top - blocks[0]!.top) < 1,
        ),
        borderColor: border.borderTopColor,
        borderWidth: parseFloat(border.borderTopWidth),
        radius: parseFloat(border.borderTopLeftRadius),
      };
    });
    expect(geometry.direction).toBe("row");
    expect(geometry.detailTop).toBeGreaterThanOrEqual(geometry.imageBottom - 1);
    expect(geometry.bottomTop).toBeGreaterThanOrEqual(
      geometry.detailBottom - 1,
    );
    expect(geometry.sameRow).toBe(true);
    expect(geometry.borderColor).toBe("rgb(0, 57, 112)");
    expect(geometry.borderWidth).toBeGreaterThan(0);
    expect(geometry.radius).toBeGreaterThan(0);
    await expect(card.locator(".reference-price-card")).toHaveCount(1);
  }
  const price = cards.nth(2).locator(".reference-price-svg");
  const fills = await price
    .locator("path")
    .evaluateAll((paths) => paths.map((path) => getComputedStyle(path).fill));
  expect(fills).toContain("rgb(0, 56, 112)");
  expect(fills).toContain("rgb(230, 232, 232)");
  await page
    .locator("#blue-detail-fixture")
    .screenshot({ path: "artifacts/blue-detail-layout.png" });
});
