import { expect, test } from "@playwright/test";

test("preset modal edits save and reload independently with live previews and mobile Albanian controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) =>
      route.fulfill({ json: { products: [], brands: [], assets: [] } }),
  );
  await page.route("**/__preset-design-editor", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="preset-design-editor"></div><script type="module" src="/tests/e2e/fixtures/preset-design-editor.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__preset-design-editor");
  const existing = await page.locator("[data-existing]").textContent();
  await page
    .getByRole("tab", { name: "Brochure designs", exact: true })
    .click();
  for (const name of [
    "Featured Product Collection",
    "UUU · Brand Edition",
    "UUU · Catalogue Edition",
    "Unified Collection",
    "Hajde! · Online Offers",
    "Private design",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("button", { name: "Edit design", exact: true })
      .click();
    const modal = page.getByRole("dialog", {
      name: "Edit design",
      exact: true,
    });
    await expect(
      modal.getByRole("tab", { name: "Brochure designs", exact: true }),
    ).toHaveCount(0);
    await expect(
      modal.getByRole("tab", { name: "Inside pages", exact: true }),
    ).toBeVisible();
    await expect(
      modal.getByRole("tab", { name: "Stores page", exact: true }),
    ).toBeVisible();
    await expect(
      modal.getByRole("region", { name: "Settings preview", exact: true }),
    ).toHaveCount(0);
    await expect(
      modal.getByLabel("Settings preview", { exact: true }),
    ).toBeVisible();
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await page.getByRole("button", { name: "Edit design", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Edit design", exact: true });
  await modal
    .getByRole("textbox", { name: "Design name", exact: true })
    .fill("Independent working design");
  await modal
    .locator("details.ns-settings-group")
    .evaluateAll((groups) =>
      groups.forEach((group) => ((group as HTMLDetailsElement).open = true)),
    );
  await modal
    .getByLabel("Cover background color", { exact: true })
    .fill("#aabbcc");
  await expect(
    modal.locator(".ns-preview-paper-slot .brochure-cover"),
  ).toHaveCSS("background-color", "rgb(170, 187, 204)");
  await modal.getByRole("tab", { name: "Stores page", exact: true }).click();
  await modal
    .getByRole("tab", { name: "Stores & contacts", exact: true })
    .click();
  await expect(modal.locator(".ns-locations")).toContainText("Private store");
  await expect(modal.locator(".ns-locations")).not.toContainText(
    "Global store",
  );
  await modal
    .getByRole("button", { name: "Add location", exact: true })
    .click();
  await modal
    .getByRole("textbox", { name: "Store name", exact: true })
    .fill("New design store");
  await modal
    .getByRole("textbox", { name: "City", exact: true })
    .fill("New city");
  await expect(modal.locator(".ns-preview-paper-slot")).toContainText(
    "New design store",
  );
  await expect(
    modal.getByRole("button", { name: "Save design", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "/tmp/neptun-preset-editor-en-desktop.png" });
  await modal.getByRole("button", { name: "Save design", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(page.locator("[data-saved]")).not.toHaveText("null");
  const saved = JSON.parse(
    (await page.locator("[data-saved]").textContent()) || "null",
  );
  expect(saved.stores).toHaveLength(1);
  expect(saved.stores[0].name).toBe("Global store");
  const edited = saved.brochurePresets.find(
    (p: { id: string }) => p.id === "custom-private",
  );
  expect(edited.name).toBe("Independent working design");
  expect(edited.design.coverBackgroundColor).toBe("#aabbcc");
  expect(
    edited.design.storesSnapshot.stores.map((s: { name: string }) => s.name),
  ).toEqual(["Private store", "New design store"]);
  expect(Object.keys(edited.design.storesSnapshot).sort()).toEqual([
    "contact",
    "stores",
  ]);
  expect(saved.brochurePresets).toHaveLength(1);
  await expect(page.locator("[data-existing]")).toHaveText(existing || "");
  await page.reload();
  await page
    .getByRole("tab", { name: "Brochure designs", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Independent working design", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit design", exact: true }).click();
  await expect(
    modal.getByLabel("Cover background color", { exact: true }),
  ).toHaveValue("#aabbcc");
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("combobox", { name: "Fixture language", exact: true })
    .selectOption("sq");
  await page
    .getByRole("checkbox", { name: "Fixture dark", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Redakto dizajnin", exact: true })
    .click();
  const sq = page.getByRole("dialog", {
    name: "Redakto dizajnin",
    exact: true,
  });
  await expect(
    sq.getByRole("button", { name: "Ruaj dizajnin", exact: true }),
  ).toBeInViewport();
  const geometry = await sq.evaluate((el) => ({
    width: el.getBoundingClientRect().width,
    scroll: el.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(geometry.width).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 2);
  await page.screenshot({ path: "/tmp/neptun-preset-editor-sq-mobile.png" });
  await sq.getByRole("button", { name: "Anulo", exact: true }).click();
  expect(errors).toEqual([]);
});
