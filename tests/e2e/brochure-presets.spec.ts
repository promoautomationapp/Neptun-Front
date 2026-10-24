import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Campaign } from "../../src/domain/models";
import type { WorkspaceSettings } from "../../src/features/settings/settings.schema";

test("compact preset selection, enlarged previews and team designs work in dark mode and on mobile", async ({
  page,
}) => {
  let settings = JSON.parse(
    await readFile(resolve("src/features/settings/defaults.json"), "utf8"),
  ) as WorkspaceSettings;
  let version = 1;
  let created: Campaign | null = null;
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("neptun-studio-language", "en");
    localStorage.setItem("neptun-language", "en");
  });
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/team/settings") {
        if (route.request().method() === "PUT") {
          const input = route.request().postDataJSON() as {
            settings: WorkspaceSettings;
            expectedVersion: number;
          };
          expect(input.expectedVersion).toBe(version);
          settings = input.settings;
          version++;
        }
        return route.fulfill({
          json: { saved: true, settings, version, updatedAt: null },
        });
      }
      if (
        path === "/api/team/campaigns" &&
        route.request().method() === "POST"
      ) {
        const input = route.request().postDataJSON() as { campaign: Campaign };
        created = { ...input.campaign, version: 1 };
        return route.fulfill({ json: { campaign: created } });
      }
      const prefix = path.startsWith("/api/assets/app/fonts/")
        ? "/api/assets/app/"
        : path.startsWith("/api/assets/legacy/")
          ? "/api/assets/legacy/"
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
          return route.fulfill({
            status: 404,
            body: "Optional image unavailable",
          });
        }
      }
      if (path === "/api/assets/app/logo")
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="95"><text x="5" y="70" fill="white" font-family="Arial" font-size="70" font-weight="900">NEPTUN</text></svg>',
        });
      if (path.endsWith("/presence"))
        return route.fulfill({ json: { participants: [] } });
      const responses: Record<string, unknown> = {
        "/api/team/session": {
          configured: true,
          user: {
            id: "preset-reviewer",
            name: "Studio reviewer",
            email: "review@example.test",
            role: "admin",
            permissions: "admin",
            organizationId: "12345678-1234-4234-8234-123456789012",
            mustChangePassword: false,
          },
        },
        "/api/team/members": { members: [] },
        "/api/team/campaigns": { campaigns: created ? [created] : [] },
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
        "/api/catalog/brands": { brands: [] },
        "/api/brand-logos": {},
        "/api/notifications": { notifications: [], unreadCount: 0 },
      };
      return route.fulfill({ json: responses[path] || {} });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.getByRole("button", { name: "New campaign", exact: true }).click();
  let modal = page.getByRole("dialog", {
    name: "Create a campaign",
    exact: true,
  });
  await expect(modal).toBeVisible();
  await expect(
    modal.getByRole("button", { name: "Neptun Classic", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const thumbs = modal.locator(".cs-preset-thumb");
  expect((await thumbs.first().boundingBox())!.height).toBeLessThanOrEqual(110);
  expect(
    await thumbs
      .first()
      .evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe("rgb(255, 255, 255)");
  await modal.screenshot({ path: "artifacts/brochure-preset-picker-dark.png" });
  await modal
    .getByRole("button", { name: "Preview design Neptun Blue" })
    .click();
  const preview = page.getByRole("dialog", {
    name: "Brochure preview · Neptun Blue",
    exact: true,
  });
  await expect(preview).toBeVisible();
  await preview
    .getByRole("button", { name: "Product page", exact: true })
    .click();
  await expect(preview.locator(".brochure-output-page")).toBeVisible();
  await preview
    .getByRole("button", { name: "Use this design", exact: true })
    .click();
  await expect(preview).toHaveCount(0);
  await expect(
    modal.getByRole("button", { name: "Neptun Blue", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    modal.getByText(
      "Upload the first cover photograph. The NEPTUN logo and blue campaign band stay separate and editable.",
    ),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await modal.screenshot({
    path: "artifacts/brochure-preset-picker-mobile-dark.png",
  });
  expect(
    await modal.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("tab", { name: "Brochure designs", exact: true })
    .click();
  await page.getByRole("button", { name: "Neptun Blue", exact: true }).click();
  await page.getByLabel("Brochure preset name").fill("Team Blue");
  await page.getByLabel("Brochure preset name").press("Tab");
  await page
    .getByRole("checkbox", {
      name: "Automatically select this design for new brochures",
    })
    .check();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(
    page.getByText("Settings saved. New brochures will use these defaults."),
  ).toBeVisible();
  expect(settings.defaultBrochurePresetId).toBe("neptun-october");
  expect(
    settings.brochurePresets.find((preset) => preset.id === "neptun-october")!
      .name,
  ).toBe("Team Blue");
  await page
    .locator(".ns-settings-workspace")
    .screenshot({ path: "artifacts/brochure-preset-library-dark.png" });
  await page.getByRole("tab", { name: "Inside pages", exact: true }).click();
  await page
    .getByRole("tab", { name: "Prices & savings", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Default price design", exact: true })
    .click();
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  await page.getByRole("button", { name: "New campaign", exact: true }).click();
  modal = page.getByRole("dialog", { name: "Create a campaign", exact: true });
  await expect(
    modal.getByRole("button", { name: "Team Blue", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await modal
    .getByRole("button", { name: "Create campaign →", exact: true })
    .click();
  await expect.poll(() => created?.brochurePresetId).toBe("neptun-october");
  expect(created).toMatchObject({
    brochureVisualStyle: "october",
    offerStyle: "card",
    coverBackgroundImage: "",
    productBackgroundColor: "#e3e3e3",
  });
  expect(failures).toEqual([]);
});
