import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { WorkspaceSettings } from "../../src/features/settings/settings.schema";
test("shared Settings work in the browser, retain the original font and fit mobile", async ({
  page,
}) => {
  let settings = JSON.parse(
    await readFile(resolve("src/features/settings/defaults.json"), "utf8"),
  ) as WorkspaceSettings;
  let version = 1;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/team/session")
        return route.fulfill({
          json: {
            configured: true,
            user: {
              id: "qa",
              email: "qa@example.test",
              role: "pm",
              organizationId: "12345678-1234-4234-8234-123456789012",
              permissions: "admin",
              mustChangePassword: false,
            },
          },
        });
      if (url.pathname === "/api/products/facets")
        return route.fulfill({
          json: {
            categories: ["TV"],
            brands: ["Samsung"],
            paths: [{ category: "TV", subcategory: "OLED", brand: "Samsung" }],
          },
        });
      if (url.pathname === "/api/team/settings") {
        if (route.request().method() === "PUT") {
          const input = route.request().postDataJSON() as {
            settings: unknown;
            expectedVersion: number;
          };
          expect(input.expectedVersion).toBe(version);
          settings = input.settings as WorkspaceSettings;
          version++;
          return route.fulfill({
            json: {
              saved: true,
              settings,
              version,
              updatedAt: new Date().toISOString(),
            },
          });
        }
        return route.fulfill({ json: { settings, version, updatedAt: null } });
      }
      const prefix = url.pathname.startsWith("/api/assets/app/fonts/")
        ? "/api/assets/app"
        : url.pathname.startsWith("/api/assets/legacy/")
          ? "/api/assets/legacy"
          : "";
      if (prefix && process.env.NEPTUN_REFERENCE_DIR) {
        const file = resolve(
          process.env.NEPTUN_REFERENCE_DIR,
          "public",
          url.pathname.slice(prefix.length + 1),
        );
        const root = resolve(process.env.NEPTUN_REFERENCE_DIR, "public") + "/";
        if (file.startsWith(root))
          return route.fulfill({
            body: await readFile(file),
            contentType: file.endsWith(".otf")
              ? "font/otf"
              : file.endsWith(".ttf")
                ? "font/ttf"
                : file.endsWith(".svg")
                  ? "image/svg+xml"
                  : "image/png",
          });
      }
      return route.fulfill({
        status: 404,
        body: "Not available in this isolated UI test",
      });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  if (process.env.NEPTUN_REFERENCE_DIR) {
    await page.evaluate(async () => {
      await document.fonts.load('16px "SkolaSans"');
      await document.fonts.ready;
    });
    expect(
      await page.evaluate(() => document.fonts.check('16px "SkolaSans"')),
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        Array.from(document.fonts).some(
          (face) =>
            face.family.replace(/['"]/g, "") === "SkolaSans" &&
            face.status === "loaded",
        ),
      ),
    ).toBe(true);
  }
  await expect(page.getByLabel("Default cover style")).toHaveValue(
    "blueRibbon",
  );
  const screenshotDirectory = process.env.NEPTUN_SCREENSHOT_DIR;
  if (screenshotDirectory)
    await page.screenshot({
      path: resolve(screenshotDirectory, "settings-design.png"),
      fullPage: true,
    });
  await page.getByRole("tab", { name: "Logos & icons" }).click();
  await page
    .locator("summary")
    .filter({ hasText: "Product brand logos" })
    .click();
  await page.getByLabel("Search product brands").fill("samsung");
  await page
    .getByRole("checkbox", { name: "Hide SAMSUNG logo", exact: true })
    .check();
  await expect(
    page.getByText("The logo is hidden. Product cards show SAMSUNG as text."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Prices & categories" }).click();
  await page.locator("summary").filter({ hasText: "TV ·" }).click();
  await page
    .getByLabel("TV savings default", { exact: true })
    .selectOption("percentage");
  await page.getByRole("tab", { name: "Stores & contacts" }).click();
  await page
    .getByRole("checkbox", { name: "Show store phone", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "Move Royal Mall up" }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Show store phone", exact: true }),
  ).not.toBeChecked();
  if (screenshotDirectory)
    await page.screenshot({
      path: resolve(screenshotDirectory, "settings-stores.png"),
      fullPage: true,
    });
  await page.getByRole("tab", { name: "Format & layout" }).click();
  await page.getByLabel("Default brochure format").selectOption("a4");
  await page.getByRole("tab", { name: "Campaign types" }).click();
  await page
    .getByRole("checkbox", {
      name: "Show Black Friday when creating brochures",
    })
    .uncheck();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(
    page.getByText("Settings saved. New brochures will use these defaults."),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("tab", { name: "Format & layout" }).click();
  await expect(page.getByLabel("Default brochure format")).toHaveValue("a4");
  await page.getByRole("tab", { name: "Prices & categories" }).click();
  await page.locator("summary").filter({ hasText: "TV ·" }).click();
  await expect(
    page.getByLabel("TV savings default", { exact: true }),
  ).toHaveValue("percentage");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Campaign types" }).click();
  await expect(page.getByLabel("Default campaign type")).toHaveValue(
    "campaign-type-2",
  );
  if (screenshotDirectory)
    await page.screenshot({
      path: resolve(screenshotDirectory, "settings-mobile.png"),
      fullPage: true,
    });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
