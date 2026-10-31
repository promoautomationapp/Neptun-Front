import { expect, test } from "@playwright/test";

test("staff forms stay in dialogs with clear brand scope, usable category portals and bilingual labels", async ({
  page,
}) => {
  const errors: string[] = [];
  const writes: unknown[] = [];
  const staff = {
    id: "staff",
    email: "staff@example.test",
    name: "Team Staff",
    role: "staff",
    status: "active",
    isSupport: false,
    emailVerified: true,
    lastLoginAt: null,
  };
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/products/facets"))
        return route.fulfill({
          json: {
            categories: ["IT"],
            brands: [],
            sourceCategories: [],
            paths: [
              {
                category: "IT",
                subcategory: "Laptops",
                brand: "",
                categoryPath: "IT > Computers > Laptops",
              },
            ],
          },
        });
      if (
        path.includes("/team/users") &&
        route.request().method() === "PATCH"
      ) {
        const body = route.request().postDataJSON();
        writes.push(body);
        return route.fulfill({ json: { user: { ...staff, ...body } } });
      }
      if (path.endsWith("/team/users/invite")) {
        const body = route.request().postDataJSON();
        writes.push(body);
        return route.fulfill({
          json: {
            user: {
              ...staff,
              ...body,
              id: "new",
              status: "invited",
              emailVerified: false,
            },
          },
        });
      }
      if (path.endsWith("/team/users"))
        return route.fulfill({
          json: { users: [staff], emailConfigured: true },
        });
      return route.fulfill({ json: { products: [], assets: [] } });
    },
  );
  await page.route("**/__team-dialogs", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="team-dialogs-fixture"></div><script type="module" src="/tests/e2e/fixtures/team-dialogs.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__team-dialogs");
  await expect(page.getByText("Brands in GIFT CARD · 1")).toBeVisible();
  await page.getByRole("button", { name: "Brand", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "Unspecified brand", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "SAMSUNG", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Browse all brands", exact: true })
    .click();
  await page.getByRole("button", { name: "Brand", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "SAMSUNG", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "＋ Invite a user", exact: true })
    .click();
  const invite = page.getByRole("dialog", {
    name: "Invite a colleague",
    exact: true,
  });
  await expect(
    invite.getByRole("textbox", { name: "Full name", exact: true }),
  ).toBeFocused();
  await invite
    .getByRole("textbox", { name: "Full name", exact: true })
    .fill("New Staff");
  await invite
    .getByRole("textbox", { name: "Work email", exact: true })
    .fill("new@example.test");
  await invite
    .getByRole("button", { name: "Send invitation", exact: true })
    .click();
  await expect(invite).toHaveCount(0);
  expect(writes).toHaveLength(1);
  await expect(
    page.getByText("new@example.test", { exact: true }),
  ).toBeVisible();
  const staffRow = page
    .getByRole("row")
    .filter({ hasText: "staff@example.test" })
    .first();
  await staffRow.getByRole("button", { name: "Edit", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit user", exact: true });
  await expect(
    edit.getByRole("textbox", { name: "Full name", exact: true }),
  ).toHaveValue("Team Staff");
  await edit.getByRole("combobox", { name: "User role", exact: true }).click();
  await page.getByRole("option", { name: "PM", exact: true }).click();
  await edit.getByText("Workspace access", { exact: true }).click();
  await edit.getByRole("radio", { name: "Custom access", exact: true }).click();
  await edit
    .getByRole("radio", { name: "Selected branches", exact: true })
    .click();
  await edit
    .getByRole("button", { name: "Add category branch", exact: true })
    .click();
  const branch = page.getByRole("dialog", {
    name: "Add category branch",
    exact: true,
  });
  await branch.getByRole("searchbox").fill("Laptops");
  await branch
    .getByRole("button", { name: "IT > Computers > Laptops", exact: true })
    .click();
  await expect(
    edit.getByRole("button", {
      name: "Remove category branch: IT > Computers > Laptops",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(
    edit.getByRole("button", { name: "Save user", exact: true }),
  ).toBeInViewport();
  await expect(
    edit.getByRole("button", { name: "Cancel", exact: true }),
  ).toHaveCSS("background-color", "rgb(27, 45, 68)");
  await expect(
    edit.getByRole("button", { name: "Cancel", exact: true }),
  ).toHaveCSS("color", "rgb(230, 238, 248)");
  await page.screenshot({ path: "/tmp/neptun-team-dialog-dark.png" });
  const rect = await edit.boundingBox();
  expect(rect?.x).toBeGreaterThanOrEqual(0);
  expect((rect?.y || 0) + (rect?.height || 0)).toBeLessThanOrEqual(1000);
  await edit.getByRole("button", { name: "Save user", exact: true }).click();
  await expect(edit).toHaveCount(0);
  expect(writes).toHaveLength(2);
  expect(
    (writes[1] as { access: { catalogCategoryPaths: string[] } }).access
      .catalogCategoryPaths,
  ).toEqual(["IT > Computers > Laptops"]);
  await page
    .getByRole("combobox", { name: "Fixture language", exact: true })
    .selectOption("sq");
  await staffRow.getByRole("button", { name: "Redakto", exact: true }).click();
  const sq = page.getByRole("dialog", {
    name: "Redakto përdoruesin",
    exact: true,
  });
  await expect(
    sq.getByRole("textbox", { name: "Emri i plotë", exact: true }),
  ).toHaveValue("Team Staff");
  await expect(
    sq.getByRole("button", { name: "Ruaj përdoruesin", exact: true }),
  ).toBeVisible();
  await sq.getByRole("button", { name: "Anulo", exact: true }).click();
  expect(errors).toEqual([]);
});
