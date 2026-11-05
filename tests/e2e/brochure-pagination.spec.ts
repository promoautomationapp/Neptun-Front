import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

async function setup(page: Page) {
  const failures: string[] = [],
    aiCalls: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.route("**/fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const path = new URL(route.request().url()).pathname;
      if (/\/ai(?:-|\/|$)/.test(path)) aiCalls.push(path);
      if (path.includes("/presence"))
        return route.fulfill({ json: { participants: [] } });
      if (/\.(?:woff2?|otf|ttf)$/.test(path))
        return route.fulfill({ status: 404, body: "" });
      if (path.startsWith("/api/assets/"))
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="0" y="70" fill="#234a6d" font-size="65" font-family="Arial">NEPTUN</text></svg>',
        });
      return route.fulfill({ json: {} });
    },
  );
  await page.route("**/__brochure-pagination", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/brochure-pagination.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__brochure-pagination");
  await expect(
    page.locator(".cs-canvas-dock .cs-brochure-pagination"),
  ).toBeVisible();
  await expect(page.locator(".cs-brochure-pagination-dock")).toHaveCount(0);
  return { failures, aiCalls };
}
async function hittable(control: Locator) {
  await expect(control).toBeInViewport();
  await expect
    .poll(() =>
      control.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const target = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        return Boolean(target && (target === node || node.contains(target)));
      }),
    )
    .toBe(true);
}
async function snapshot(page: Page) {
  return JSON.parse(
    (await page.locator("#pagination-fixture-snapshot").textContent()) || "{}",
  ) as {
    products: Array<{ code: string; name: string; sale: number }>;
    exportPage: number | null;
  };
}
async function scrollBelowThumbnails(page: Page) {
  await page
    .locator(".cs-page-navigator")
    .evaluate((node) =>
      window.scrollTo(
        0,
        window.scrollY + node.getBoundingClientRect().bottom + 24,
      ),
    );
  await expect(page.locator(".cs-page-navigator")).not.toBeInViewport();
}

test("top toolbar pagination stays reachable below thumbnails, commits edits before switching and avoids document jumps", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 760 });
  const { failures, aiCalls } = await setup(page);
  const pager = page.locator(".cs-canvas-dock .cs-brochure-pagination");
  const picker = pager.getByRole("combobox", { name: "Go to page" });
  await expect(picker.locator("option")).toHaveCount(12);
  await expect(
    pager.getByRole("button", { name: "Previous page" }),
  ).toBeDisabled();
  await picker.selectOption("0");
  const paper = page.locator(".cs-preview-paper");
  const name = paper
    .getByRole("textbox", { name: "Product name", exact: true })
    .last();
  await name.fill("Edited before changing page");
  await scrollBelowThumbnails(page);
  const next = pager.getByRole("button", { name: "Next page" });
  await hittable(next);
  const beforeArrow = await page.evaluate(() => window.scrollY);
  await next.click();
  await expect(picker).toHaveValue("1");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeCloseTo(beforeArrow, 0);
  expect(
    (await snapshot(page)).products.find((item) => item.code === "offer-5")
      ?.name,
  ).toBe("Edited before changing page");
  await page.screenshot({ path: "artifacts/brochure-pagination-editor.png" });
  await paper.locator(".brochure-price").last().click();
  const price = paper.getByRole("dialog", { name: "Edit price here" });
  await price
    .getByRole("spinbutton", { name: "New offer price (€)" })
    .fill("349");
  await hittable(picker);
  const beforeSelect = await page.evaluate(() => window.scrollY);
  await picker.click();
  await picker.selectOption("8");
  await expect(picker).toHaveValue("8");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeCloseTo(beforeSelect, 0);
  expect(
    (await snapshot(page)).products.find((item) => item.code === "offer-9")
      ?.sale,
  ).toBe(349);
  await next.click();
  await expect(picker).toHaveValue("9");
  await next.click();
  await expect(picker).toHaveValue("10");
  await expect(next).toBeDisabled();
  await expect(paper.locator(".brochure-stores")).toHaveCount(1);
  await expect(
    page.locator(
      ".brochure-page .cs-brochure-pagination, .print-stack .cs-brochure-pagination",
    ),
  ).toHaveCount(0);
  await page.emulateMedia({ media: "print" });
  await expect(pager).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  expect(failures).toEqual([]);
  expect(aiCalls).toEqual([]);
});

test("Tab commits a valid inline price before keyboard activation of the page arrow", async ({
  page,
}) => {
  const { failures, aiCalls } = await setup(page);
  const pager = page.locator(".cs-canvas-dock .cs-brochure-pagination");
  const picker = pager.getByRole("combobox", { name: "Go to page" });
  await picker.selectOption("0");
  const paper = page.locator(".cs-preview-paper");
  await paper.locator(".brochure-price").last().click();
  const price = paper.getByRole("dialog", { name: "Edit price here" });
  const input = price.getByRole("spinbutton", { name: "New offer price (€)" });
  await input.fill("329");
  await input.press("Tab");
  await expect(
    price.getByRole("button", { name: "Save", exact: true }),
  ).toBeFocused();
  expect(
    (await snapshot(page)).products.find((item) => item.code === "offer-5")
      ?.sale,
  ).toBe(399);
  await page.keyboard.press("Tab");
  await expect(price).toHaveCount(0);
  expect(
    (await snapshot(page)).products.find((item) => item.code === "offer-5")
      ?.sale,
  ).toBe(329);
  const next = pager.getByRole("button", { name: "Next page" });
  await next.evaluate((node) =>
    (node as HTMLElement).focus({ preventScroll: true }),
  );
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(picker).toHaveValue("1");
  expect(
    (await snapshot(page)).products.find((item) => item.code === "offer-5")
      ?.sale,
  ).toBe(329);
  expect(failures).toEqual([]);
  expect(aiCalls).toEqual([]);
});

test("preview pagination handles long brochures without moving the document and returns to the chosen editor page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 760 });
  const { failures, aiCalls } = await setup(page);
  const editorPicker = page
    .locator(".cs-canvas-dock .cs-brochure-pagination")
    .getByRole("combobox", { name: "Go to page" });
  await editorPicker.selectOption("7");
  await page
    .getByRole("button", { name: "Open full preview", exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: "Brochure preview" });
  const pager = preview.locator(
    ".cs-preview-dialog-header .cs-brochure-pagination",
  );
  await expect(preview.locator(".cs-preview-dialog-footer")).toHaveCount(0);
  const picker = pager.getByRole("combobox", { name: "Go to page" });
  await expect(picker).toHaveValue("7");
  await expect(picker.locator("option")).toHaveCount(12);
  const initialY = await page.evaluate(() => window.scrollY);
  await preview
    .locator(".cs-preview-thumbnails")
    .evaluate((node) => (node.scrollTop = node.scrollHeight));
  await hittable(pager.getByRole("button", { name: "Next page" }));
  await pager.getByRole("button", { name: "Next page" }).click();
  await expect(picker).toHaveValue("8");
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeCloseTo(initialY, 0);
  await picker.selectOption("10");
  await expect(pager.getByRole("button", { name: "Next page" })).toBeDisabled();
  await expect(
    preview.locator('.cs-preview-thumbnails [aria-current="page"]'),
  ).toHaveAttribute("aria-label", "Stores & details");
  await expect(
    preview.locator(".cs-preview-dialog-paper .cs-brochure-pagination"),
  ).toHaveCount(0);
  await picker.selectOption("4");
  await preview.getByRole("button", { name: "Back to editing" }).click();
  await expect(editorPicker).toHaveValue("4");
  await page
    .getByRole("button", { name: "Open full preview", exact: true })
    .click();
  const reopened = page.getByRole("dialog", { name: "Brochure preview" });
  await expect(
    reopened.getByRole("combobox", { name: "Go to page" }),
  ).toHaveValue("4");
  await reopened
    .getByRole("combobox", { name: "Go to page" })
    .selectOption("0");
  await reopened.getByRole("button", { name: "Download brochure" }).click();
  await expect.poll(async () => (await snapshot(page)).exportPage).toBe(1);
  expect(failures).toEqual([]);
  expect(aiCalls).toEqual([]);
});

test("excluded stores stay editable while preview and arrow bounds include only printable pages", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Exclude stores page" }).click();
  const pager = page.locator(".cs-canvas-dock .cs-brochure-pagination");
  const picker = pager.getByRole("combobox", { name: "Go to page" });
  await expect(
    picker.getByRole("option", { name: "Stores & details · Not included" }),
  ).toHaveCount(1);
  await picker.selectOption("9");
  await expect(pager.getByRole("button", { name: "Next page" })).toBeDisabled();
  await picker.selectOption("10");
  await expect(pager).toContainText("—/11");
  await expect(page.locator(".cs-preview-excluded-label")).toBeVisible();
  await expect(
    pager.getByRole("button", { name: "Previous page" }),
  ).toBeEnabled();
  await pager.getByRole("button", { name: "Previous page" }).click();
  await expect(picker).toHaveValue("9");
  await page
    .getByRole("button", { name: "Open full preview", exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: "Brochure preview" });
  await expect(
    preview.getByRole("combobox", { name: "Go to page" }).locator("option"),
  ).toHaveCount(11);
  await expect(
    preview.getByRole("option", { name: /Stores & details/ }),
  ).toHaveCount(0);
  await expect(
    preview.getByRole("button", { name: "Next page" }),
  ).toBeDisabled();
});

test("dark mobile pagination stays within the screen with reachable touch controls in editing and preview", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 640 });
  const { failures, aiCalls } = await setup(page);
  await page.getByRole("button", { name: "Use dark mode" }).click();
  const pager = page.locator(".cs-canvas-dock .cs-brochure-pagination");
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await hittable(pager.getByRole("button", { name: "Next page" }));
  const metrics = await pager.evaluate((node) => ({
    rect: node.getBoundingClientRect().toJSON(),
    viewport: innerWidth,
    overflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    background: getComputedStyle(node).backgroundColor,
    color: getComputedStyle(node).color,
    targets: [...node.querySelectorAll("button")].map((button) => ({
      width: button.getBoundingClientRect().width,
      height: button.getBoundingClientRect().height,
    })),
  }));
  expect(metrics.rect.left).toBeGreaterThanOrEqual(0);
  expect(metrics.rect.right).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  expect(metrics.background).not.toBe("rgb(255, 255, 255)");
  expect(
    metrics.targets.every(
      (target) => target.width >= 44 && target.height >= 44,
    ),
  ).toBe(true);
  await pager.getByRole("button", { name: "Next page" }).click();
  await expect(pager.getByRole("combobox", { name: "Go to page" })).toHaveValue(
    "0",
  );
  await page
    .getByRole("button", { name: "Open full preview", exact: true })
    .click();
  const preview = page.getByRole("dialog", { name: "Brochure preview" });
  const previewPager = preview.locator(
    ".cs-preview-dialog-header .cs-brochure-pagination",
  );
  await expect(preview.locator(".cs-preview-dialog-footer")).toHaveCount(0);
  await hittable(previewPager.getByRole("button", { name: "Next page" }));
  await previewPager.getByRole("button", { name: "Next page" }).click();
  await expect(
    previewPager.getByRole("combobox", { name: "Go to page" }),
  ).toHaveValue("1");
  const previewBounds = await previewPager.boundingBox();
  expect(previewBounds!.x).toBeGreaterThanOrEqual(0);
  expect(previewBounds!.x + previewBounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "artifacts/brochure-pagination-preview-dark.png",
  });
  await preview.getByRole("button", { name: "Back to editing" }).click();
  await expect(pager.getByRole("combobox", { name: "Go to page" })).toHaveValue(
    "1",
  );
  expect(failures).toEqual([]);
  expect(aiCalls).toEqual([]);
});

test("clean preview stays in place, removes edit lines and keeps pagination reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 760 });
  const { failures, aiCalls } = await setup(page);
  const paper = page.locator(".cs-preview-paper");
  const pager = page.locator(".cs-canvas-dock .cs-brochure-pagination");
  await pager.getByRole("combobox", { name: "Go to page" }).selectOption("0");
  await scrollBelowThumbnails(page);
  const before = await paper.boundingBox();
  const snapshotBefore = await snapshot(page);
  await page.getByRole("button", { name: "Preview only", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Brochure preview" }),
  ).toHaveCount(0);
  await expect(page.locator(".cs-page-preview.inline-preview")).toBeVisible();
  await expect(paper.locator('[contenteditable="true"]')).toHaveCount(0);
  await expect(paper.locator(".cs-product-tools")).toHaveCount(0);
  const after = await paper.boundingBox();
  expect(after!.width).toBeCloseTo(before!.width, 0);
  expect(after!.height).toBeCloseTo(before!.height, 0);
  expect(after!.y).toBeCloseTo(before!.y, 0);
  expect(await snapshot(page)).toEqual(snapshotBefore);
  await hittable(pager.getByRole("button", { name: "Next page" }));
  await pager.getByRole("button", { name: "Next page" }).click();
  await expect(pager.getByRole("combobox", { name: "Go to page" })).toHaveValue(
    "1",
  );
  await page.screenshot({ path: "artifacts/brochure-inline-preview.png" });
  await page
    .getByRole("button", { name: "Back to editing", exact: true })
    .click();
  await expect(paper.locator(".cs-product-tools").first()).toBeVisible();
  expect(failures).toEqual([]);
  expect(aiCalls).toEqual([]);
});

for (const viewport of [
  { width: 1440, height: 760 },
  { width: 390, height: 640 },
]) {
  test(`top page navigation remains usable when the rest of the toolbar is collapsed at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const { failures, aiCalls } = await setup(page);
    const dock = page.locator(".cs-canvas-dock");
    const pager = dock.locator(".cs-brochure-pagination");
    const picker = pager.getByRole("combobox", { name: "Go to page" });
    const before = await snapshot(page);
    await dock
      .getByRole("button", { name: "Hide toolbar", exact: true })
      .click();
    await expect(
      dock.getByRole("button", { name: "Show toolbar", exact: true }),
    ).toBeVisible();
    await expect(pager).toBeVisible();
    await hittable(pager.getByRole("button", { name: "Next page" }));
    await pager.getByRole("button", { name: "Next page" }).click();
    await expect(picker).toHaveValue("0");
    await picker.selectOption("4");
    await expect(picker).toHaveValue("4");
    await pager.getByRole("button", { name: "Previous page" }).click();
    await expect(picker).toHaveValue("3");
    await expect(
      page.locator(".cs-brochure-pagination-dock, .cs-preview-dialog-footer"),
    ).toHaveCount(0);
    expect(await snapshot(page)).toEqual(before);
    await dock
      .getByRole("button", { name: "Show toolbar", exact: true })
      .click();
    await expect(picker).toHaveValue("3");
    await expect(
      dock.getByRole("button", { name: "Pointer", exact: true }),
    ).toBeVisible();
    expect(failures).toEqual([]);
    expect(aiCalls).toEqual([]);
  });
}
