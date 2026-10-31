import { expect, test, type Page } from "@playwright/test";
import type { AnnotatedSocialPost } from "../../src/features/social/socialAnnotations";

async function setup(page: Page) {
  let stored: AnnotatedSocialPost = {
    preset: "ig-feed",
    quality: "hd",
    template: "classic",
    priceStyle: "current",
    detailStyle: "chips",
    background: { type: "solid", color: "#205184" },
    showPrice: true,
    showRegular: true,
    showSaving: true,
    savingMode: "money",
    showInstallments: true,
    showDetails: true,
    showSpecs: true,
    showInches: true,
    logoLayout: "corner",
    customWidth: 1080,
    customHeight: 1080,
    artworks: [],
    id: "social-tools-fixture",
    name: "Social canvas tools",
    showEventLogo: false,
    showNeptunLogo: false,
    products: [
      {
        code: "tv",
        name: "TV 55",
        category: "TV",
        brand: "FUEGO",
        regular: 499,
        sale: 399,
        image: "/api/assets/legacy/qa-tv.svg",
        skipAiCutout: true,
        cutoutStatus: "done",
      },
    ],
  };
  const failures: string[] = [],
    ai: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.route("**/fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.includes("/ai")) ai.push(path);
      if (path === "/api/team/posts") {
        if (route.request().method() === "POST") {
          stored = route.request().postDataJSON().post;
          return route.fulfill({ json: { post: stored } });
        }
        return route.fulfill({ json: { posts: [stored] } });
      }
      if (path.startsWith("/api/assets/"))
        return route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="700" height="440"><rect width="700" height="400" rx="12" fill="#202c39"/><rect x="12" y="12" width="676" height="374" rx="3" fill="#79b7d8"/><path d="m80 400-15 35m555-35 15 35" stroke="#202c39" stroke-width="10"/></svg>',
        });
      return route.fulfill({ json: {} });
    },
  );
  await page.route("**/__social-canvas-tools", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="root"></div><script type="module" src="/tests/e2e/fixtures/social-canvas-tools.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__social-canvas-tools");
  expect(failures).toEqual([]);
  await page.getByRole("button", { name: /Social canvas tools/ }).click();
  await expect(
    page.getByRole("group", { name: "Post canvas controls" }),
  ).toBeVisible();
  return { post: () => stored, failures, ai };
}
test("social canvas creates direct text and pinned threads, saves replies and resolution, previews in place and reloads", async ({
  page,
}) => {
  const state = await setup(page);
  await expect(
    page.getByRole("complementary", { name: "Post designs and settings" }),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Add text anywhere", exact: true })
    .click();
  const placement = page.getByRole("button", {
    name: "Click anywhere to add text",
    exact: true,
  });
  const box = await placement.boundingBox();
  expect(box).toBeTruthy();
  await placement.click({
    position: { x: box!.width * 0.2, y: box!.height * 0.18 },
  });
  const text = page.getByRole("textbox", { name: "Text layer" });
  await expect(text).toBeFocused();
  await text.fill("Weekend offers");
  await text.press("Enter");
  await expect
    .poll(() => state.post().artworks?.[0]?.text)
    .toBe("Weekend offers");
  await page.getByRole("button", { name: /^Comment anywhere/ }).click();
  const layer = page.locator(".social-comment-overlay .cs-comment-layer");
  const frame = await layer.boundingBox();
  await layer.click({
    position: { x: frame!.width * 0.4, y: frame!.height * 0.25 },
  });
  await page
    .getByRole("textbox", { name: "Your comment" })
    .fill("Check the offer");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  await expect
    .poll(() => state.post().reviewComments?.[0]?.text)
    .toBe("Check the offer");
  await page
    .getByRole("button", { name: "Comment 1: Check the offer" })
    .click();
  await page
    .getByRole("textbox", { name: "Write a reply" })
    .fill("Price is correct");
  await page.getByRole("button", { name: "Post reply", exact: true }).click();
  await page.getByRole("button", { name: /Mark resolved/ }).click();
  await expect.poll(() => state.post().reviewComments?.[0]?.fixed).toBe(true);
  expect(state.post().reviewComments?.[0]?.replies?.[0]?.authorEmail).toBe(
    "staff@example.test",
  );
  expect(state.post().reviewHistory?.map((item) => item.action)).toEqual([
    "comment",
    "reply",
    "fix",
  ]);
  await page.getByRole("button", { name: "Close comments" }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator(".social-canvas")).toHaveCount(1);
  await expect(
    page.locator(".social-canvas [contenteditable='true']"),
  ).toHaveCount(0);
  await expect(
    page.locator(".social-canvas [data-export-hide]:visible"),
  ).toHaveCount(0);
  await expect(
    page.locator(".social-canvas").getByText("Weekend offers", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to editing", exact: true })
    .click();
  await page.getByRole("button", { name: "Pointer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pointer", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: "artifacts/social-canvas-editor.png",
    fullPage: false,
  });
  await page.getByRole("button", { name: "Designs", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Post designs and settings" }),
  ).toBeVisible();
  await expect(
    page.locator(".social-design-preview.template-editorial"),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Social canvas tools/ }).click();
  await expect(page.getByRole("textbox", { name: "Text layer" })).toHaveText(
    "Weekend offers",
  );
  await page.getByRole("button", { name: /^Comment anywhere/ }).click();
  await expect(
    page.getByRole("button", { name: "Comment 1: Check the offer" }),
  ).toHaveClass(/resolved/);
  expect(state.ai).toEqual([]);
  expect(state.failures).toEqual([]);
});
test("mobile dark toolbar and image library stay reachable, designs toggle without overflowing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await setup(page);
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await page.getByText("Images", { exact: true }).click();
  const saved = page.getByRole("button", {
    name: "Saved logos and images",
    exact: true,
  });
  await expect(saved).toBeInViewport();
  await saved.click();
  const dialog = page.getByRole("dialog", { name: "Saved logos and images" });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button")
    .filter({ has: page.locator("img") })
    .first()
    .click();
  await expect.poll(() => state.post().artworks?.length).toBe(1);
  await page.getByRole("button", { name: "Designs", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Post designs and settings" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close designs", exact: true })
    .click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Back to editing", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/social-canvas-preview-dark.png",
    fullPage: false,
  });
  expect(state.ai).toEqual([]);
  expect(state.failures).toEqual([]);
});

test("social branding stays optional and logos/footer remain changeable and removable", async ({
  page,
}) => {
  const state = await setup(page);
  await expect(
    page.locator(".social-canvas [aria-label='Event badge']"),
  ).toHaveCount(0);
  await page.getByText("Images", { exact: true }).click();
  await page
    .getByRole("button", { name: "Manage logos and layout", exact: true })
    .click();
  const panel = page.getByRole("dialog", { name: "Branding & layout" });
  await panel
    .getByRole("checkbox", { name: "Show NEPTUN logo", exact: true })
    .check();
  await panel
    .getByRole("button", { name: "Logo and footer line", exact: true })
    .click();
  await panel
    .getByRole("checkbox", { name: "Footer line", exact: true })
    .uncheck();
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  const footer = page.locator(".social-brand-footer");
  await expect(footer).toBeVisible();
  await expect(footer.locator(".social-brand-footer-line")).toHaveCount(0);
  await expect(footer.locator(".neptun-wordmark")).toHaveCSS(
    "border-bottom-width",
    "0px",
  );
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(footer.locator(".social-offer-block-tools")).toHaveCount(0);
  await expect(footer.locator(".neptun-wordmark")).toHaveCSS(
    "border-bottom-width",
    "0px",
  );
  await page
    .getByRole("button", { name: "Back to editing", exact: true })
    .click();
  await footer.scrollIntoViewIfNeeded();
  await footer.dblclick();
  const picker = page.getByRole("dialog", { name: "Change logo" });
  await expect(picker).toBeVisible();
  await picker
    .getByRole("button", { name: /^Select logo:/ })
    .first()
    .click();
  await picker
    .getByRole("button", { name: "Use this logo", exact: true })
    .click();
  await expect.poll(() => Boolean(state.post().neptunLogoUpload)).toBe(true);
  await footer.hover();
  await footer
    .getByRole("button", { name: "Remove Brand footer", exact: true })
    .click();
  await expect(footer).toHaveCount(0);
  await expect.poll(() => state.post().showNeptunLogo).toBe(false);
  expect(state.post().showLogoFooterLine).toBe(false);
  expect(state.post().showEventLogo).toBe(false);
  expect(state.ai).toEqual([]);
  expect(state.failures).toEqual([]);
});
