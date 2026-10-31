import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("Classic hero copy, prices, feature strip and editable footer match the reference proportions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1150, height: 1480 });
  await page.route("**/fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
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
          /* Renderer fallback remains available. */
        }
      }
      return route.fulfill({ status: 404, body: "" });
    },
  );
  await page.route("**/__classic-cover-layout", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="classic-cover-fixture"></div><script type="module" src="/tests/e2e/fixtures/classic-cover-layout.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__classic-cover-layout");
  await expect(page.locator(".brochure-product-image")).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  const geometry = await page.locator(".brochure-cover").evaluate((cover) => {
    const page = cover.getBoundingClientRect();
    const bounds = (element: Element | null) => {
      const rect = element!.getBoundingClientRect();
      return {
        x: ((rect.x - page.x) / page.width) * 100,
        y: ((rect.y - page.y) / page.width) * 100,
        width: (rect.width / page.width) * 100,
        height: (rect.height / page.width) * 100,
        bottom: ((rect.bottom - page.y) / page.width) * 100,
      };
    };
    const inkBottom = (element: Element) => {
      const box = bounds(element);
      const context = document.createElement("canvas").getContext("2d")!;
      const style = getComputedStyle(element);
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = context.measureText(element.textContent || "");
      return (
        box.bottom -
        ((metrics.fontBoundingBoxDescent - metrics.actualBoundingBoxDescent) /
          page.width) *
          100
      );
    };
    return [...cover.querySelectorAll(".brochure-product")].map((card) => ({
      photo: bounds(card.querySelector(".brochure-product-image")),
      codeInkBottom: inkBottom(card.querySelector(".brochure-product-code")!),
      installment: bounds(card.querySelector("[data-offer-price-divider]")),
      name: bounds(card.querySelector("[data-product-name]")),
      specs: bounds(card.querySelector(".brochure-specs")),
      badges: [
        ...card.querySelectorAll(".brochure-specs > .product-detail-block"),
      ].map(bounds),
      price: bounds(card.querySelector(".brochure-price")),
      divider: bounds(card.querySelector(".brochure-product-name-divider")),
    }));
  });
  const [hero, ...secondary] = geometry;
  expect(hero!.badges).toHaveLength(6);
  for (const card of geometry) {
    expect(card.price.width).toBeCloseTo(19.1, 1);
    expect(card.divider.height).toBeLessThan(0.1);
    expect(card.divider.y).toBeGreaterThan(card.name.y);
    expect(card.divider.y).toBeLessThan(card.name.bottom);
    expect(card.divider.y).toBeCloseTo(card.installment.y, 1);
    expect(new Set(card.badges.map((badge) => badge.y.toFixed(2))).size).toBe(
      1,
    );
    expect(card.badges[0]!.y).toBeGreaterThan(card.divider.bottom);
  }
  const heroGap = hero!.badges[0]!.y - hero!.divider.bottom;
  expect(heroGap).toBeGreaterThan(0.9);
  expect(heroGap).toBeLessThan(1.3);
  expect(
    (hero!.badges[0]!.x + hero!.badges.at(-1)!.x + hero!.badges.at(-1)!.width) /
      2,
  ).toBeCloseTo(50, 1);
  expect(
    hero!.badges.every((badge) => Math.abs(badge.width - 5.6) < 0.05),
  ).toBe(true);
  for (const card of secondary) {
    expect(card.badges).toHaveLength(6);
    expect(card.codeInkBottom).toBeLessThan(card.badges[0]!.y);
    const installmentLeft =
      card.price.x +
      card.price.width * (50.71918141454307 / 127.90621535448952);
    expect(card.badges.at(-1)!.x + card.badges.at(-1)!.width).toBeLessThan(
      installmentLeft,
    );
  }
  expect(secondary[0]!.badges[0]!.y).toBeCloseTo(secondary[1]!.badges[0]!.y, 1);
  const chrome = await page.addStyleTag({
    content:
      '.cs-product-tools,[data-export-hide="true"]{visibility:hidden!important}',
  });
  await page
    .locator("[data-classic-cover]")
    .screenshot({ path: "/tmp/neptun-classic-cover-reference.png" });
  await chrome.evaluate((element) => (element as HTMLElement).remove());
  await expect(page.locator(".brochure-footer-dates")).toContainText(
    "5 nëntor – 21 nëntor",
  );
  await expect(page.locator(".brochure-footer-payment strong")).toHaveText([
    "12 këste",
    "0% interes.",
  ]);
  await expect(page.locator(".brochure-footer-dates strong")).toHaveText(
    "Vlen 5 nëntor – 21 nëntor,",
  );
  await page
    .locator(".brochure-cover")
    .evaluate(
      (element) => ((element as HTMLElement).style.fontFamily = "monospace"),
    );
  expect(
    await page
      .locator(".reference-offer-footer")
      .evaluate((element) => getComputedStyle(element).fontFamily),
  ).toBe("monospace");
  await page
    .locator(".brochure-cover")
    .evaluate((element) =>
      (element as HTMLElement).style.removeProperty("font-family"),
    );

  const payment = page.getByRole("textbox", { name: "Footer payment text" });
  await payment.fill("Pagesë në 24 këste me 0% interes.");
  await payment.press("Enter");
  await expect(payment).toHaveText("Pagesë në 24 këste me 0% interes.");
  await expect(payment.locator("strong")).toHaveText([
    "24 këste",
    "0% interes.",
  ]);
  const validity = page.getByRole("textbox", { name: "Brochure dates text" });
  await validity.fill("Oferta vlen këtë javë.");
  await validity.press("Enter");
  await expect(validity).toHaveText("Oferta vlen këtë javë.");

  await page.getByRole("button", { name: "Toggle saved positions" }).click();
  const manual = page.locator(".cover-element-product-tv");
  expect(
    await manual.evaluate((element) => {
      const style = (element as HTMLElement).style;
      return [style.left, style.top, style.width, style.height];
    }),
  ).toEqual(["4%", "11%", "90%", "40%"]);
  const price = manual.locator(".brochure-price");
  expect(
    await price.evaluate((element) => {
      const style = (element as HTMLElement).style;
      return [style.width, style.transform];
    }),
  ).toEqual(["24%", "translate(-1cqw, 2cqw)"]);
  const badge = manual.locator('.brochure-specs > [data-detail-key="0"]');
  expect(
    await badge.evaluate((element) => {
      const style = (element as HTMLElement).style;
      return [style.width, style.height, style.maxWidth];
    }),
  ).toEqual(["18%", "6cqw", "none"]);
  const image = manual.locator(".brochure-product-image");
  expect(
    await image.evaluate((element) => (element as HTMLElement).style.transform),
  ).toBe("translate(-50%, -50%) scale(0.9)");
  await expect(manual.locator(".brochure-product")).not.toHaveAttribute(
    "data-default-layout",
  );
  expect(errors).toEqual([]);
});
