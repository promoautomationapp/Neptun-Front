import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("preset modal edits save and reload independently with live previews and mobile Albanian controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
        const file = resolve(
          "../neptun-campaign-studio/public",
          path.slice(prefix.length),
        );
        try {
          return await route.fulfill({
            body: await readFile(file),
            contentType: file.endsWith(".otf")
              ? "font/otf"
              : file.endsWith(".svg")
                ? "image/svg+xml"
                : "image/png",
          });
        } catch {
          /* Fixture uses renderer fallback for unavailable old assets. */
        }
      }
      return route.fulfill({ json: { products: [], brands: [], assets: [] } });
    },
  );
  await page.route("**/__preset-design-editor", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="preset-design-editor"></div><script type="module" src="/tests/e2e/fixtures/preset-design-editor.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__preset-design-editor");
  await page.evaluate(() => document.fonts.ready);
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
      modal.getByLabel("Settings preview", { exact: true }),
    ).toBeVisible();
    await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  }
  await page.getByRole("button", { name: "Edit design", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Edit design", exact: true });
  await modal
    .getByRole("textbox", { name: "Design name", exact: true })
    .fill("Independent working design");
  for (const group of await modal.locator("details.ns-settings-group").all()) {
    if (!(await group.evaluate((el) => (el as HTMLDetailsElement).open)))
      await group.locator("summary").click();
  }
  await modal
    .getByLabel("Cover background color", { exact: true })
    .fill("#aabbcc");
  await expect(
    modal.locator(".ns-preview-paper-slot .brochure-format-frame"),
  ).toHaveCSS("background-color", "rgb(170, 187, 204)");
  await modal.locator(".cs-modal-body").evaluate((el) => (el.scrollTop = 0));
  await page.screenshot({ path: "/tmp/neptun-preset-editor-en-cover-top.png" });
  await modal
    .getByLabel("Cover background color", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/neptun-preset-editor-en-cover.png" });
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
  await sq.locator(".ns-preview-paper-slot").scrollIntoViewIfNeeded();
  await expect(
    sq.getByRole("button", { name: "Ruaj dizajnin", exact: true }),
  ).toBeInViewport();
  const previewControls = await sq
    .locator(".ns-preview-pages")
    .evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      scroll: el.scrollWidth,
    }));
  expect(previewControls.scroll).toBeLessThanOrEqual(previewControls.width + 2);
  await page.screenshot({
    path: "/tmp/neptun-preset-editor-sq-mobile-preview.png",
  });
  await sq.getByRole("tab", { name: "Faqja e dyqaneve", exact: true }).click();
  await sq
    .getByRole("tab", { name: "Dyqanet dhe kontaktet", exact: true })
    .click();
  await sq.getByRole("button", { name: "Shto lokacion", exact: true }).click();
  await sq
    .getByRole("textbox", { name: "Emri i dyqanit", exact: true })
    .fill("Dyqan i ri");
  await expect(
    sq.getByRole("button", { name: "Ruaj dizajnin", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "/tmp/neptun-preset-editor-sq-mobile-fields.png",
  });
  await sq.getByRole("button", { name: "Anulo", exact: true }).click();
  expect(errors).toEqual([]);
});
