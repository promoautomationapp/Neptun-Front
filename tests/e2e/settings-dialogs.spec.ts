import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("settings navigation uses themed modals and refresh recovers local edits without browser alerts", async ({
  page,
}) => {
  const settings = JSON.parse(
    await readFile(resolve("src/features/settings/defaults.json"), "utf8"),
  );
  const nativeDialogs: string[] = [];
  const errors: string[] = [];
  let saves = 0;
  page.on("dialog", async (dialog) => {
    nativeDialogs.push(dialog.type());
    await dialog.dismiss();
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem("neptun-studio-language", "en"),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/team/settings" && route.request().method() === "PUT")
        saves++;
      const replies: Record<string, unknown> = {
        "/api/team/session": {
          configured: true,
          user: {
            id: "settings-modal-reviewer",
            name: "Reviewer",
            email: "review@example.test",
            role: "admin",
            permissions: "admin",
            organizationId: "12345678-1234-4234-8234-123456789012",
            mustChangePassword: false,
          },
        },
        "/api/team/members": { members: [] },
        "/api/team/campaigns": { campaigns: [] },
        "/api/team/settings": { settings, version: 1, updatedAt: null },
        "/api/products": {
          products: [],
          total: 0,
          limit: 100,
          offset: 0,
          nextOffset: null,
        },
        "/api/products/facets": {
          categories: [],
          brands: [],
          paths: [],
          sourceCategories: [],
        },
        "/api/brand-logos": {},
        "/api/notifications": { notifications: [], unreadCount: 0 },
      };
      if (path === "/api/assets/app/logo")
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="10" y="75" fill="white" font-size="70">NEPTUN</text></svg>',
        });
      return route.fulfill({ json: replies[path] || {} });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("tab", { name: "Brochure designs", exact: true })
    .click();
  const name = page.getByLabel("Brochure preset name");
  const original = await name.inputValue();
  await name.fill("Draft design");
  await name.press("Tab");
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  const modal = page.getByRole("dialog", {
    name: "Unsaved settings",
    exact: true,
  });
  await expect(modal).toBeVisible();
  await expect(
    modal.getByRole("button", { name: "Keep editing", exact: true }),
  ).toBeFocused();
  await modal
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(name).toHaveValue("Draft design");
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(name).toHaveValue("Draft design");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  await expect(modal).toBeVisible();
  expect(
    await modal.evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe("rgb(255, 255, 255)");
  await modal.screenshot({ path: "artifacts/settings-unsaved-modal-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await modal.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await modal.screenshot({
    path: "artifacts/settings-unsaved-modal-mobile.png",
  });
  await modal
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(modal).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("tab", { name: "Brochure designs", exact: true })
    .click();
  await expect(name).toHaveValue(original);
  await name.fill("Draft after refresh");
  await name.press("Tab");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(sessionStorage).some((key) =>
          key.startsWith("neptun-settings-draft:"),
        ),
      ),
    )
    .toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("tab", { name: "Brochure designs", exact: true })
    .click();
  await expect(name).toHaveValue("Draft after refresh");
  expect(saves).toBe(0);
  expect(nativeDialogs).toEqual([]);
  expect(errors).toEqual([]);
});
