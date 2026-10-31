import { expect, test } from "@playwright/test";

test("category hierarchy stays clear in dark mode and settings language changes preserve saved paths", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) =>
      route.fulfill({ json: { products: [], assets: [], brands: [] } }),
  );
  await page.route("**/__category-settings", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="category-settings-fixture"></div><script type="module" src="/tests/e2e/fixtures/category-settings.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__category-settings");
  await page
    .getByRole("button", { name: "Category & subcategory", exact: true })
    .click();
  const picker = page.getByRole("dialog", { name: "Category & subcategory" });
  await expect(picker.getByLabel("Selected category path")).toContainText(
    "Computers › Accessories › Cables › USB C",
  );
  await picker.getByRole("button", { name: "Expand all", exact: true }).click();
  await expect(
    picker.getByRole("button", {
      name: "Audio > Accessories > USB C · 1 products",
      exact: true,
    }),
  ).toBeVisible();
  await picker.getByRole("searchbox").fill("HDMI");
  await expect(
    picker.getByRole("button", {
      name: "Computers > Accessories > Cables > HDMI · 1 products",
      exact: true,
    }),
  ).toBeVisible();
  await picker
    .getByRole("button", { name: "Clear search", exact: true })
    .click();
  await expect(picker.getByRole("searchbox")).toBeFocused();
  await picker
    .getByRole("button", {
      name: "Computers > Accessories > Cables > HDMI · 1 products",
      exact: true,
    })
    .click();
  await expect(page.locator("[data-selected-path]")).toHaveText(
    "Computers > Accessories > Cables > HDMI",
  );
  await page.getByLabel("Fixture dark", { exact: true }).check();
  await page
    .getByRole("button", { name: "Category & subcategory", exact: true })
    .click();
  await expect(picker).toBeVisible();
  const palette = await picker.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    color: getComputedStyle(element).color,
    rect: element.getBoundingClientRect().toJSON(),
  }));
  expect(palette.background).toBe("rgb(27, 45, 68)");
  expect(palette.color).toBe("rgb(230, 238, 248)");
  expect(palette.rect.right).toBeLessThanOrEqual(1440);
  expect(palette.rect.bottom).toBeLessThanOrEqual(1000);
  await page.screenshot({ path: "/tmp/neptun-categories-dark.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Inside pages", exact: true }).click();
  await page
    .getByRole("tab", { name: "Category defaults", exact: true })
    .click();
  const search = page.getByRole("searchbox", {
    name: "Find category or subcategory",
    exact: true,
  });
  await search.fill("custom preserved");
  await page
    .getByRole("treeitem", { name: "Custom preserved category", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Selected category path" }),
  ).toContainText("Archived › Custom preserved category");
  await page.getByLabel("Fixture language", { exact: true }).selectOption("sq");
  await expect(
    page.getByRole("heading", { name: "Cilësimet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Faqet e brendshme", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Parazgjedhjet e kategorive dhe nënkategorive",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Custom preserved category",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Fixture language", { exact: true }).selectOption("en");
  const trigger = page.getByRole("combobox", {
    name: "Archived / Custom preserved category savings default",
    exact: true,
  });
  await trigger.click();
  await page
    .getByRole("option", { name: "Zbritje (%) — Discount %", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  const saved = JSON.parse(
    (await page.locator("[data-saved-settings]").textContent()) || "null",
  );
  expect(saved.categoryPathSavingModes).toEqual({
    "Archived > Custom preserved category": "percentage",
  });
  await expect(page.locator("[data-selected-path]")).toHaveText(
    "Computers > Accessories > Cables > HDMI",
  );
  expect(errors).toEqual([]);
});
