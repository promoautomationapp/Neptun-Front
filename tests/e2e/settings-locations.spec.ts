import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { WorkspaceSettings } from "../../src/features/settings/settings.schema";

test("locations can be dragged, moved, edited, deleted and saved without opening each row", async ({
  page,
}) => {
  let settings = JSON.parse(
    await readFile("src/features/settings/defaults.json", "utf8"),
  ) as WorkspaceSettings;
  settings.stores = settings.stores.slice(0, 3);
  settings.stores[0]!.visible = false;
  const original = structuredClone(settings.stores);
  let version = 1,
    saves = 0;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem("neptun-studio-language", "en"),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/team/settings" && route.request().method() === "PUT") {
        const input = route.request().postDataJSON();
        expect(input.expectedVersion).toBe(version);
        settings = input.settings;
        version++;
        saves++;
      }
      const replies: Record<string, unknown> = {
        "/api/team/session": {
          configured: true,
          user: {
            id: "location-reviewer",
            name: "Reviewer",
            email: "locations@example.test",
            role: "admin",
            permissions: "admin",
            organizationId: "12345678-1234-4234-8234-123456789012",
            mustChangePassword: false,
          },
        },
        "/api/team/settings": { settings, version, updatedAt: null },
        "/api/team/campaigns": { campaigns: [] },
        "/api/team/members": { members: [] },
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
      return route.fulfill({ json: replies[path] || {} });
    },
  );
  const open = async () => {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByRole("tab", { name: "Stores page", exact: true }).click();
    await page
      .getByRole("tab", { name: "Stores & contacts", exact: true })
      .click();
  };
  await page.goto("/");
  await open();
  const rows = page.locator(".ns-location-list > li");
  await expect(rows).toHaveCount(3);
  const names = () =>
    rows.locator(".ns-location-copy strong").allTextContents();
  await expect(
    page.getByRole("button", {
      name: `Move ${original[0]!.name} up`,
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: `Edit location: ${original[0]!.name}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    rows.first().getByText(original[0]!.phone, { exact: true }),
  ).toBeVisible();

  const handle = await rows.first().locator(".ns-location-grip").boundingBox();
  const last = await rows.last().boundingBox();
  if (!handle || !last) throw new Error("Location handles must be visible");
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, last.y + last.height - 8, {
    steps: 14,
  });
  await expect(rows.last()).toHaveClass(/drop-after/);
  await page.mouse.up();
  expect(await names()).toEqual([
    original[1]!.name,
    original[2]!.name,
    original[0]!.name,
  ]);
  expect(saves).toBe(0);
  await page
    .getByRole("button", { name: `Move ${original[0]!.name} up`, exact: true })
    .click();
  await page
    .getByRole("button", {
      name: `Edit location: ${original[0]!.name}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Store name", exact: true })
    .fill("Updated location");
  await page
    .getByRole("button", {
      name: "Close location editor: Updated location",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: `Delete location: ${original[2]!.name}`,
      exact: true,
    })
    .click();
  await expect(rows).toHaveCount(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(rows).toHaveCount(3);
  await page.getByRole("button", { name: "Add location", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Store name", exact: true })
    .fill("New branch");
  await page
    .getByRole("textbox", { name: "City", exact: true })
    .fill("Prishtinë");
  await page
    .getByRole("textbox", { name: "Phone", exact: true })
    .fill("045 123 456");
  await page
    .getByRole("button", {
      name: "Close location editor: New branch",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect.poll(() => saves).toBe(1);
  expect(settings.stores.map((store) => store.name)).toEqual([
    original[1]!.name,
    "Updated location",
    original[2]!.name,
    "New branch",
  ]);
  expect(settings.stores[1]).toMatchObject({
    id: original[0]!.id,
    visible: false,
    phone: original[0]!.phone,
  });
  await page.reload();
  await open();
  await expect(rows).toHaveCount(4);
  expect(await names()).toEqual(settings.stores.map((store) => store.name));
  await page
    .getByRole("button", { name: "Switch to dark mode", exact: true })
    .click();
  await page
    .locator(".ns-locations")
    .screenshot({ path: "artifacts/settings-locations-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".ns-locations").scrollIntoViewIfNeeded();
  await expect(rows.first().locator(".ns-location-order")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".ns-locations")
    .screenshot({ path: "artifacts/settings-locations-mobile-dark.png" });
  await page.getByRole("button", { name: "SQ", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: `Fshij lokacionin: ${settings.stores[0]!.name}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Shto lokacion", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
