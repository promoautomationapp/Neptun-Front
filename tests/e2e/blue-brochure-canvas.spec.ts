import { expect, test } from "@playwright/test";
import type { Campaign, Product } from "../../src/domain/models";
import type * as BrochurePresetsModule from "../../src/features/brochure/brochurePresets";
import type * as SettingsModule from "../../src/features/settings/settings.schema";

const image = (kind: string) => `/api/assets/canvas-${kind}.svg`;
function offer(
  code: string,
  name: string,
  extra: Partial<Product> = {},
): Product {
  return {
    code,
    name,
    brand: "LG",
    image: image("tv"),
    regular: 499,
    sale: 399,
    cutoutStatus: "done",
    skipAiCutout: true,
    aiReviewedImageSource: image("tv"),
    brochureDetails: ["4K UHD", "Smart TV", "HDR10"],
    warranty: "2 VITE",
    ...extra,
  };
}
function svg(kind: string) {
  if (kind === "phone")
    return '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="550"><rect x="20" y="10" width="260" height="530" rx="36" fill="#242936"/><rect x="28" y="18" width="244" height="514" rx="30" fill="#85a7df"/><circle cx="150" cy="220" r="75" fill="#bfccec"/></svg>';
  if (kind === "mac")
    return '<svg xmlns="http://www.w3.org/2000/svg" width="650" height="420"><rect x="50" y="20" width="550" height="350" rx="15" fill="#262a30"/><rect x="62" y="32" width="526" height="326" fill="#7bb9be"/><path d="M5 375h640l-35 30H40Z" fill="#c8cbd0"/></svg>';
  if (kind === "accessory")
    return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect x="20" y="70" width="360" height="170" rx="14" fill="#3c4550"/><path d="M45 105h310M45 145h310M45 185h310" stroke="#8cb9d3" stroke-width="15"/></svg>';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520"><rect x="20" y="20" width="760" height="430" rx="4" fill="#121920"/><rect x="28" y="28" width="744" height="414" fill="#76acd5"/><circle cx="420" cy="225" r="130" fill="#90c4e0"/><path d="m120 448-25 50m580-50 25 50" stroke="#111" stroke-width="10"/></svg>';
}

test("Blue brochure supports text and pinned comments anywhere, independent pagination and six-page previews", async ({
  page,
}) => {
  test.setTimeout(45000);
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  let campaign: Campaign = {
    id: "blue-canvas-browser",
    version: 1,
    name: "Blue weekend offers",
    type: "Seasonal offers",
    startDate: "2027-06-12",
    endDate: "2027-06-18",
    products: [
      offer("cover-tv", "Cover TV"),
      offer("cover-phone", "Cover phone", {
        brand: "Samsung",
        image: image("phone"),
      }),
      ...Array.from({ length: 4 }, (_, index) =>
        offer(`tv-${index}`, `LG TV ${index}`, {
          category: "TV",
          subcategory: "Televizorë",
          specs: { Ekrani: `${43 + index * 10}"` },
        }),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        offer(`iphone-${index}`, `iPhone ${16 + index}`, {
          brand: "Apple",
          category: "Smartphone",
          subcategory: "iPhone",
          image: image("phone"),
          aiReviewedImageSource: image("phone"),
          brochureDetails: ["Memorje: 256 GB", 'Ekrani: 6.3"'],
          warranty: "1 VIT",
        }),
      ),
      ...Array.from({ length: 2 }, (_, index) =>
        offer(`mac-${index}`, `MacBook Air ${index}`, {
          brand: "Apple",
          category: "Laptop",
          subcategory: "MacBook",
          image: image("mac"),
          aiReviewedImageSource: image("mac"),
          brochureDetails: ["Apple M5 Chip", "SSD: 512 GB", 'Ekrani: 13"'],
          warranty: "1 VIT",
        }),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        offer(`accessory-${index}`, `Gaming keyboard ${index}`, {
          brand: "Logitech",
          category: "Gaming",
          subcategory: "Gaming accessories",
          image: image("accessory"),
          aiReviewedImageSource: image("accessory"),
          brochureDetails: ["Wireless", "Bluetooth", "Mechanical"],
          warranty: "1 VIT",
        }),
      ),
    ],
    reviewComments: [],
    storesSnapshot: {
      stores: [
        {
          city: "Prishtinë",
          name: "Central Park",
          address: "Rruga e qytetit",
          phone: "046 828 000",
        },
      ],
      contact: { email: "info@example.test", website: "https://example.test" },
    },
  };
  let aiCalls = 0;
  await page.addInitScript(() => localStorage.setItem("neptun-language", "en"));
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.includes("/ai")) aiCalls++;
      const kind = /\/canvas-(\w+)\.svg$/.exec(url.pathname)?.[1];
      if (kind)
        return route.fulfill({ contentType: "image/svg+xml", body: svg(kind) });
      if (url.pathname.endsWith("/presence"))
        return route.fulfill({ json: { participants: [] } });
      if (url.pathname.startsWith("/api/assets/")) {
        if (/\.(?:woff2?|ttf|otf)$/.test(url.pathname))
          return route.fulfill({ status: 404, body: "" });
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="115"><text x="0" y="78" fill="#164a75" font-family="Arial" font-size="88" font-weight="900">NEPTUN</text><path d="M5 100h455" stroke="#f3432b" stroke-width="8"/></svg>',
        });
      }
      if (
        url.pathname === "/api/team/campaigns" &&
        route.request().method() === "POST"
      ) {
        const body = route.request().postDataJSON() as { campaign: Campaign };
        campaign = { ...body.campaign, version: (campaign.version || 1) + 1 };
        return route.fulfill({ json: { campaign } });
      }
      if (url.pathname === `/api/team/campaigns/${campaign.id}/review`) {
        const body = route.request().postDataJSON() as {
          action: string;
          pageIndex: number;
          pageLabel: string;
          text: string;
          position: { x: number; y: number };
        };
        if (body.action === "comment")
          campaign = {
            ...campaign,
            version: (campaign.version || 1) + 1,
            reviewComments: [
              ...(campaign.reviewComments || []),
              {
                id: "canvas-comment",
                pageIndex: body.pageIndex,
                pageLabel: body.pageLabel,
                text: body.text,
                position: body.position,
                authorEmail: "staff@example.test",
                createdAt: "2027-06-01T10:00:00Z",
                fixed: false,
                replies: [],
              },
            ],
          };
        return route.fulfill({ json: { campaign } });
      }
      const responses: Record<string, unknown> = {
        "/api/team/session": {
          configured: true,
          user: {
            id: "canvas-reviewer",
            name: "Canvas reviewer",
            email: "staff@example.test",
            role: "staff",
            permissions: "editor",
            organizationId: "12345678-1234-4234-8234-123456789012",
            mustChangePassword: false,
          },
        },
        "/api/team/members": { members: [] },
        "/api/team/campaigns": { campaigns: [campaign] },
        [`/api/team/campaigns/${campaign.id}`]: { campaign },
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
  // Let Vite resolve the app's JSON imports, as in the real creation flow.
  await page.goto("/");
  const seeded = await page.evaluate(async (serialized) => {
    const value = JSON.parse(serialized) as Campaign;
    const presetPath = "/src/features/brochure/brochurePresets.ts";
    const settingsPath = "/src/features/settings/settings.schema.ts";
    const presets = (await import(presetPath)) as typeof BrochurePresetsModule;
    const settings = (await import(settingsPath)) as typeof SettingsModule;
    presets.applyBrochurePreset(
      value,
      presets
        .availableBrochurePresets(settings.resolveSettings(null))
        .find((preset) => preset.id === "neptun-october")!,
    );
    value.pages = { 0: { backgroundColor: "#14263d" } };
    const television = value.products.find(
      (product) => product.code === "tv-0",
    )!;
    television.brochureDetails = [
      { key: "resolution", text: "4K UHD" },
      { key: "processor", text: "Quad Core Processor" },
      { key: "hdr", text: "HDR10" },
    ];
    television.detailBlockStyles = { resolution: "filled" };
    return JSON.stringify(value);
  }, JSON.stringify(campaign));
  campaign = JSON.parse(seeded) as Campaign;
  const openCampaign = async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page
      .getByRole("button", { name: "Open campaign: Blue weekend offers" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your brochure" }),
    ).toBeVisible();
  };
  await openCampaign();
  await expect(page.locator(".cs-pages-sidebar > button")).toHaveCount(6);
  const paper = page.locator(".cs-preview-paper");
  await page.keyboard.press("t");
  await expect(
    page.getByRole("button", { name: "Add text anywhere", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await paper
    .locator(".brochure-page")
    .first()
    .click({ position: { x: 160, y: 190 } });
  const text = paper.locator("[data-text-layer]");
  await expect(text).toHaveCount(1);
  await expect(text).toBeFocused();
  await text.fill("Weekend offers for everyone");
  await text.press("Enter");
  await expect
    .poll(() => campaign.pageArtworks?.cover?.[0]?.text)
    .toBe("Weekend offers for everyone");
  await openCampaign();
  await expect(paper.locator("[data-text-layer]")).toHaveText(
    "Weekend offers for everyone",
  );
  await page.keyboard.press("c");
  await expect(
    page.getByRole("button", { name: "Comment anywhere", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const layer = paper.locator(".cs-comment-layer");
  const box = await layer.boundingBox();
  if (!box) throw new Error("Comment placement overlay is missing");
  await layer.click({ position: { x: box.width * 0.7, y: box.height * 0.24 } });
  const comment = page.getByRole("dialog", { name: "Add a comment here" });
  await expect(comment).toBeVisible();
  await comment
    .getByRole("textbox")
    .fill("Check this exact spot on the cover.");
  await comment
    .getByRole("button", { name: "Post comment", exact: true })
    .click();
  await expect
    .poll(() => campaign.reviewComments?.[0]?.text)
    .toBe("Check this exact spot on the cover.");
  expect(campaign.reviewComments?.[0]?.pageIndex).toBe(0);
  expect(campaign.reviewComments?.[0]?.position?.x).toBeCloseTo(70, 0);
  await page.getByRole("button", { name: "Pointer", exact: true }).click();
  await expect(paper.locator(".cs-comment-layer")).toHaveCount(0);
  await expect(
    paper.locator('[data-text-layer][contenteditable="true"]'),
  ).toHaveCount(1);
  const pages = page.locator(".cs-pages-sidebar > button");
  await pages.nth(1).click();
  await expect(paper.locator(".brochure-product")).toHaveCount(4);
  const customPage = paper.locator(".brochure-interior.brochure-october");
  await expect(customPage).not.toHaveClass(/\blight\b/);
  const customInk = await customPage.evaluate((node) => {
    const styles = (selector: string) =>
      getComputedStyle(node.querySelector(selector)!);
    const filled = styles('[data-detail-key="resolution"]');
    return {
      copy: styles(".brochure-product-copy").color,
      name: styles("[data-product-name]").color,
      filled: { background: filled.backgroundColor, color: filled.color },
      outline: styles('[data-detail-key="processor"]').backgroundColor,
    };
  });
  expect(customInk).toEqual({
    copy: "rgb(255, 255, 255)",
    name: "rgb(255, 255, 255)",
    filled: { background: "rgb(255, 255, 255)", color: "rgb(28, 64, 117)" },
    outline: "rgba(0, 0, 0, 0)",
  });
  await page.getByRole("button", { name: "Design tools", exact: true }).click();
  await page
    .getByRole("tab", { name: "Background & cover", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Footer line", exact: true })
    .uncheck();
  await expect(paper.locator(".october-footer-rule")).toHaveCount(0);
  await expect(paper.locator(".october-footer-logo")).toHaveCount(1);
  await expect(paper.locator(".october-page-number")).toHaveText("2");
  await expect.poll(() => campaign.pages?.[0]?.showFooterLine).toBe(false);
  await page
    .getByRole("button", { name: "Close design tools", exact: true })
    .click();
  await pages.nth(2).click();
  await expect(paper.locator(".october-footer-rule")).toHaveCount(1);
  expect(
    await paper
      .locator(".brochure-product-copy")
      .first()
      .evaluate((node) => getComputedStyle(node).color),
  ).toBe("rgb(51, 54, 54)");
  await expect(paper.locator(".october-apple-header")).toHaveCount(1);
  await expect(paper.locator(".october-category-ribbon")).toHaveCount(0);
  await pages.nth(3).click();
  await expect(paper.locator(".layout-pair2 .brochure-product")).toHaveCount(2);
  await pages.nth(4).click();
  await expect(
    paper.locator(".layout-grid6portrait .brochure-product"),
  ).toHaveCount(6);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .locator(".cs-editor-section")
    .screenshot({ path: "artifacts/blue-canvas-dark.png" });
  const beforePreview = aiCalls;
  await page.getByRole("button", { name: "Preview only", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Brochure preview" });
  await expect(preview.locator(".cs-preview-thumbnails button")).toHaveCount(6);
  await page.keyboard.press("Home");
  await expect(
    preview.locator(".cs-preview-dialog-paper [data-text-layer]"),
  ).toHaveText("Weekend offers for everyone");
  await expect(preview.locator(".cs-preview-dialog-paper")).not.toContainText(
    /October|Tetor/i,
  );
  await page.keyboard.press("ArrowRight");
  await expect(
    preview.getByRole("button", { name: "Page 2", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    preview.locator(".cs-preview-dialog-paper .october-footer-rule"),
  ).toHaveCount(0);
  await expect(
    preview.locator(".cs-preview-dialog-paper .october-footer-logo"),
  ).toHaveCount(1);
  await page.keyboard.press("ArrowRight");
  await expect(
    preview.locator(".cs-preview-dialog-paper .october-footer-rule"),
  ).toHaveCount(1);
  await page.keyboard.press("End");
  await expect(
    preview.getByRole("button", { name: "Next page" }),
  ).toBeDisabled();
  await expect(
    preview.locator(".cs-preview-dialog-paper .brochure-stores"),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");
  expect(aiCalls).toBe(beforePreview);
  expect(failures).toEqual([]);
});
