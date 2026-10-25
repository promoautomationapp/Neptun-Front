import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Campaign } from "../../src/domain/models";

test("brochure browsing, footer editing, portrait wallpapers and dark controls stay usable", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  let campaign: Campaign = {
    id: "brochure-ux-browser",
    name: "October brochure",
    type: "October offers",
    version: 1,
    startDate: "2026-10-24",
    endDate: "2026-10-31",
    brochureFormat: "neptun1080x1350",
    includeStoresPage: false,
    showCoverLogo: true,
    coverLogoSource: "/api/assets/test-logo.svg",
    brandAssets: { neptun: "/api/assets/test-logo.svg" },
    showCoverBand: false,
    showCoverHeadline: false,
    coverBackgroundColor: "#354f7b",
    productBackgroundColor: "#354f7b",
    showInteriorFooter: true,
    products: Array.from({ length: 18 }, (_, i) => ({
      code: `TV-${i}`,
      name: `TV LED Samsung ${i + 1}`,
      brand: "SAMSUNG",
      category: "TV",
      subcategory: "TV",
      regular: 599,
      sale: 399,
      image: "/api/assets/test-tv.svg",
      aiReviewedImageSource: "/api/assets/test-tv.svg",
      brochurePage: i < 2 ? 1 : 2 + Math.floor((i - 2) / 8),
      specs: { Ekrani: '55"', Rezolucioni: "4K Ultra HD" },
      ...(i === 0
        ? {
            screenArtwork: {
              image: "/api/assets/test-portrait.svg",
              fit: "contain" as const,
            },
          }
        : {}),
    })),
    reviewComments: [
      {
        id: "thread",
        pageIndex: 0,
        pageLabel: "Cover",
        authorEmail: "pm@example.test",
        createdAt: "2026-10-24T17:00:00Z",
        text: "Move the footer up a little.",
        fixed: false,
        replies: [],
        position: { x: 30, y: 80 },
      },
    ],
  };
  const tv =
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520"><rect x="20" y="20" width="760" height="430" rx="3" fill="#111"/><rect x="28" y="28" width="744" height="414" fill="#25292e"/><path d="m120 448-25 50m580-50 25 50" stroke="#111" stroke-width="10"/></svg>';
  const portrait =
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="500"><rect width="200" height="500" fill="#f18456"/><circle cx="100" cy="170" r="60" fill="#ffe1b4"/><text x="100" y="330" text-anchor="middle" font-family="Arial" font-size="22">PORTRAIT</text></svg>';
  let aiCalls = 0;
  await page.addInitScript(() => localStorage.setItem("neptun-language", "en"));
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/ai")) aiCalls++;
      if (url.pathname === "/api/assets/uploads")
        return route.fulfill({
          json: {
            id: "00000000-0000-4000-8000-000000000001",
            uploadUrl: "/api/assets/test-upload",
            headers: {},
          },
        });
      if (url.pathname === "/api/assets/test-upload")
        return route.fulfill({ status: 204 });
      if (
        url.pathname ===
        "/api/assets/uploads/00000000-0000-4000-8000-000000000001/confirm"
      )
        return route.fulfill({
          json: { url: "/api/assets/test-uploaded-portrait.svg" },
        });
      if (
        url.pathname === "/api/assets/app/logo" ||
        url.pathname === "/api/assets/test-logo.svg"
      )
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="115"><text x="0" y="78" fill="white" font-family="Arial" font-size="88" font-weight="900">NEPTUN</text><path d="M5 100h455" stroke="#f3432b" stroke-width="8"/></svg>',
        });
      if (url.pathname.endsWith("/presence"))
        return route.fulfill({ json: { participants: [] } });
      if (
        url.pathname === "/api/assets/test-tv.svg" ||
        url.pathname === "/api/assets/test-portrait.svg" ||
        url.pathname === "/api/assets/test-uploaded-portrait.svg"
      )
        return route.fulfill({
          contentType: "image/svg+xml",
          body: url.pathname.includes("portrait") ? portrait : tv,
        });
      const prefix = url.pathname.startsWith("/api/assets/app/fonts/")
        ? "/api/assets/app/"
        : url.pathname.startsWith("/api/assets/legacy/")
          ? "/api/assets/legacy/"
          : "";
      if (prefix) {
        const file = resolve(
          "../neptun-campaign-studio/public",
          url.pathname.slice(prefix.length),
        );
        try {
          return await route.fulfill({ body: await readFile(file) });
        } catch {
          /* Optional assets retain their renderer fallback. */
        }
      }
      if (
        url.pathname === "/api/team/campaigns" &&
        route.request().method() === "POST"
      ) {
        const data = route.request().postDataJSON() as { campaign: Campaign };
        campaign = { ...data.campaign, version: (campaign.version || 1) + 1 };
        return route.fulfill({ json: { campaign } });
      }
      const responses: Record<string, unknown> = {
        "/api/team/session": {
          configured: true,
          user: {
            id: "ux-browser",
            name: "Studio reviewer",
            email: "staff@example.test",
            role: "staff",
            permissions: "editor",
            organizationId: "12345678-1234-4234-8234-123456789012",
            mustChangePassword: false,
          },
        },
        "/api/team/members": { members: [] },
        "/api/team/campaigns": { campaigns: [campaign] },
        "/api/team/campaigns/brochure-ux-browser": { campaign },
        "/api/team/settings": { settings: null, version: 0, updatedAt: null },
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
      return route.fulfill({ json: responses[url.pathname] || {} });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page
    .getByRole("button", { name: "Open campaign: October brochure" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your brochure" }),
  ).toBeVisible();
  const productImage = page
    .locator(".cs-preview-paper .brochure-product-image")
    .first();
  await productImage.dblclick();
  await expect(
    page.getByRole("dialog", { name: "Change product image" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Change TV screen image" }).click();
  await expect(
    page.getByRole("dialog", { name: "TV wallpaper" }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "TV wallpaper" })
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "new-wallpaper.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(portrait),
    });
  await expect(
    page.getByRole("img", { name: "Replacement screen image" }),
  ).toHaveAttribute("src", /\/api\/assets\/test-uploaded-portrait\.svg$/);
  await page
    .getByRole("button", { name: "Apply wallpaper", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Add this image to all TVs in the brochure?",
    }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "TV wallpaper" })
    .screenshot({ path: "artifacts/tv-wallpaper-preview.png" });
  await page.getByRole("button", { name: "All TVs (18)", exact: true }).click();
  await expect
    .poll(
      () =>
        campaign.products.filter(
          (item) =>
            item.screenArtwork?.image ===
            "/api/assets/test-uploaded-portrait.svg",
        ).length,
    )
    .toBe(18);
  const name = page.locator(".cs-preview-paper [data-product-name]").first();
  await name.fill("Samsung Smart TV");
  await page.getByRole("heading", { name: "Your brochure" }).click();
  await expect(name).toHaveText("Samsung Smart TV");
  await page.locator(".cs-preview-paper .brochure-price").first().click();
  const inlinePrice = page.getByRole("dialog", { name: "Edit price here" });
  await inlinePrice
    .getByRole("spinbutton", { name: "New offer price (€)" })
    .fill("449");
  await expect(inlinePrice.getByRole("status")).toContainText("25%");
  await inlinePrice.getByRole("button", { name: "Save", exact: true }).click();
  const badge = page.locator(".cs-preview-paper .red-reference-saving").first();
  await badge.dblclick();
  await expect(badge).toHaveAttribute("aria-label", /ZBRITJE.*25/);
  await badge.dblclick();
  await expect(badge).toHaveAttribute("aria-label", /KURSENI.*150/);
  const detail = page
    .locator(".cs-preview-paper .brochure-specs .product-detail-block")
    .first();
  const detailKey = await detail.getAttribute("data-detail-key");
  await detail.dblclick();
  const detailsDialog = page.getByRole("dialog", { name: "Product details" });
  await expect(detailsDialog).toBeVisible();
  const focusedField = detailsDialog
    .locator(`[data-detail-editor-key="${detailKey}"] input`)
    .last();
  await expect(focusedField).toBeFocused();
  await detailsDialog
    .getByRole("button", { name: "Close", exact: true })
    .click();
  const beforeResize = await productImage.boundingBox();
  await productImage.hover();
  const topLeft = page
    .locator(
      '.cs-preview-paper .cs-image-corner[data-resize-corner="top-left"]',
    )
    .first();
  const corner = await topLeft.boundingBox();
  if (!corner || !beforeResize)
    throw new Error("Image resize handles are missing");
  await page.mouse.move(
    corner.x + corner.width / 2,
    corner.y + corner.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(corner.x - 14, corner.y - 10, { steps: 5 });
  await page.mouse.up();
  const afterResize = await productImage.boundingBox();
  expect(afterResize!.width).toBeGreaterThan(beforeResize.width);
  expect(afterResize!.x + afterResize!.width).toBeCloseTo(
    beforeResize.x + beforeResize.width,
    0,
  );
  expect(afterResize!.y + afterResize!.height).toBeCloseTo(
    beforeResize.y + beforeResize.height,
    0,
  );
  await page.getByText("More actions", { exact: true }).click();
  await expect(page.locator(".cs-brochure-actions-menu[open]")).toHaveCount(1);
  await page.getByRole("heading", { name: "Your brochure" }).click();
  await expect(page.locator(".cs-brochure-actions-menu[open]")).toHaveCount(0);
  const beforePreviewAi = aiCalls;
  await page.getByRole("button", { name: "Preview only", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Brochure preview" });
  await expect(preview).toBeVisible();
  await expect(preview.locator(".cs-preview-thumbnails button")).toHaveCount(3);
  await page.keyboard.press("ArrowRight");
  await expect(
    preview.getByRole("button", { name: "Page 2", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("End");
  await expect(
    preview.getByRole("button", { name: "Next page" }),
  ).toBeDisabled();
  await preview.screenshot({ path: "artifacts/brochure-preview-light.png" });
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  expect(aiCalls).toBe(beforePreviewAi);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const pageButton = page.locator(".cs-pages-sidebar button").first();
  expect(
    await pageButton.evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe("rgb(255, 255, 255)");
  await pageButton.click();
  await page.getByRole("button", { name: "Design tools", exact: true }).click();
  const dateInput = page
    .getByLabel("Brochure dates text", { exact: true })
    .last();
  await dateInput.fill("Vlen 24–31 tetor 2026");
  await expect(page.locator(".brochure-footer-dates").first()).toHaveText(
    "Vlen 24–31 tetor 2026",
  );
  await page.getByRole("button", { name: "Close design tools" }).click();
  const footerInset = await page
    .locator(".cs-preview-paper .brochure-page")
    .first()
    .evaluate((node) => {
      const pageBox = node.getBoundingClientRect();
      const footerBox = node
        .querySelector(".brochure-footer-element")!
        .getBoundingClientRect();
      return ((pageBox.bottom - footerBox.bottom) * 1080) / pageBox.width;
    });
  expect(footerInset).toBeCloseTo(3, 1);
  const wallpaper = page
    .locator(".cs-preview-paper .brochure-screen-image")
    .first();
  await expect(wallpaper).toBeVisible();
  const styles = await wallpaper.evaluate((node) => ({
    fit: getComputedStyle(node).objectFit,
    background: getComputedStyle(node).backgroundColor,
  }));
  expect(styles).toEqual({ fit: "contain", background: "rgb(0, 0, 0)" });
  await page.getByRole("button", { name: /Comments 1/ }).click();
  await expect(
    page.getByRole("region", { name: "Page review comments" }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Filter comments" }),
  ).toBeVisible();
  await page.screenshot({
    path: "artifacts/brochure-comments-dark.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Edit brochure", exact: true })
    .click();
  await page.locator(".cs-product-tools summary").first().click();
  await expect(page.locator(".cs-product-tools[open]")).toHaveCount(1);
  await page
    .locator(".cs-editor-section")
    .screenshot({ path: "artifacts/brochure-editor-dark.png" });
  await page.getByRole("button", { name: "Design tools", exact: true }).click();
  await page.getByRole("tab", { name: "Format & layout", exact: true }).click();
  await page
    .getByRole("button", { name: /Use reference brochure preset/ })
    .click();
  await page.getByRole("button", { name: "Close design tools" }).click();
  await page.getByRole("button", { name: "Preview only", exact: true }).click();
  await page.keyboard.press("Home");
  await expect(
    preview.locator(".cs-preview-dialog-paper .cover-product-frame"),
  ).toHaveCount(3);
  const footerRow = await preview
    .locator(".cs-preview-dialog-paper .reference-offer-footer")
    .evaluate((node) => {
      const text = [
        ...node.querySelectorAll(
          ".brochure-footer-dates, .brochure-footer-payment",
        ),
      ].map((child) => child.getBoundingClientRect());
      return {
        tops: text.map((box) => box.top),
        surface: node
          .closest(".brochure-page")!
          .classList.contains("needs-contrast-surfaces"),
      };
    });
  expect(footerRow.tops[0]).toBeCloseTo(footerRow.tops[1]!, 0);
  expect(footerRow.surface).toBe(false);
  await preview.screenshot({ path: "artifacts/reference-cover-preset.png" });
  await page.keyboard.press("ArrowRight");
  const grid = preview.locator(
    ".cs-preview-dialog-paper .layout-tv8 .brochure-products",
  );
  await expect(grid.locator(":scope > article")).toHaveCount(8);
  const geometry = await grid.evaluate((node) => {
    const page = node.closest(".brochure-page")!.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    const cards = [...node.children].map((child) =>
      child.getBoundingClientRect(),
    );
    return {
      top: (box.top - page.top) / page.height,
      bottom: (page.bottom - box.bottom) / page.height,
      rows: cards.map((card) => Math.round(card.top)),
      widths: cards.map((card) => card.width),
    };
  });
  expect(geometry.top).toBeCloseTo(0.073, 2);
  expect(geometry.bottom).toBeCloseTo(0.018, 2);
  expect(geometry.rows[0]).toBe(geometry.rows[2]);
  expect(geometry.rows[3]).toBe(geometry.rows[4]);
  expect(geometry.rows[5]).toBe(geometry.rows[7]);
  expect(geometry.widths[3]).toBeGreaterThan(geometry.widths[0]! * 1.4);
  await preview.screenshot({ path: "artifacts/reference-tv-preset.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(preview).toBeVisible();
  await preview.screenshot({
    path: "artifacts/brochure-preview-mobile-dark.png",
  });
  expect(
    await preview.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  expect(failures).toEqual([]);
});
