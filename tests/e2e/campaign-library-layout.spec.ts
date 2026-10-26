import { expect, test, type Page } from "@playwright/test";

async function openFixture(page: Page, theme = "dark", language = "sq") {
  await page.route("**/fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => route.fulfill({ status: 404, body: "" }),
  );
  await page.route("**/__campaign-library-layout?**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="library-layout-fixture"></div><script type="module" src="/tests/e2e/fixtures/campaign-library-layout.tsx"></script></body></html>',
    }),
  );
  await page.goto(
    `/__campaign-library-layout?theme=${theme}&language=${language}`,
  );
  await expect(page.locator(".cs-campaign-card")).toHaveCount(4);
  await page.evaluate(() => document.fonts.ready);
}

async function assertAlignedRows(page: Page) {
  const sections = await page
    .locator(".cs-campaign-card")
    .evaluateAll((cards) =>
      cards.map((card) => {
        const bounds = (selector: string) => {
          const box = card.querySelector(selector)!.getBoundingClientRect();
          return { top: box.top, height: box.height, bottom: box.bottom };
        };
        const box = card.getBoundingClientRect();
        return {
          top: box.top,
          bottom: box.bottom,
          badges: bounds(".cs-campaign-badges"),
          preview: bounds(".cs-campaign-cover"),
          title: bounds(".cs-campaign-card-title"),
          metadata: bounds(".cs-campaign-card-meta"),
          actions: bounds(".cs-campaign-card-actions"),
        };
      }),
    );
  const rows = new Map<number, typeof sections>();
  for (const section of sections) {
    const key = Math.round(section.top);
    rows.set(key, [...(rows.get(key) || []), section]);
  }
  for (const row of rows.values()) {
    if (row.length < 2) continue;
    const first = row[0]!;
    for (const card of row.slice(1)) {
      expect(Math.abs(card.bottom - first.bottom)).toBeLessThan(1);
      for (const section of [
        "badges",
        "preview",
        "title",
        "metadata",
        "actions",
      ] as const) {
        expect(
          Math.abs(card[section].top - first[section].top),
          `${section} top: ${JSON.stringify(row)}`,
        ).toBeLessThan(1);
        expect(
          Math.abs(card[section].height - first[section].height),
          `${section} height: ${JSON.stringify(row)}`,
        ).toBeLessThan(1);
      }
    }
  }
  return rows.size;
}

test("campaign sections align across expiry, comments, long text and brochure formats", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1050 });
  await openFixture(page);
  await expect(page.locator(".cs-campaign-validity")).toHaveCount(2);
  await expect(page.locator(".cs-campaign-card-meta").nth(2)).toContainText(
    "1 komente të hapura",
  );
  expect(await assertAlignedRows(page)).toBe(1);
  const artwork = await page
    .locator(".cs-campaign-mini-cover")
    .evaluateAll((frames) =>
      frames.map((frame) => {
        const box = frame.getBoundingClientRect();
        const stage = frame.parentElement!.getBoundingClientRect();
        return {
          ratio: box.width / box.height,
          inside:
            box.left >= stage.left &&
            box.right <= stage.right &&
            box.top >= stage.top &&
            box.bottom <= stage.bottom,
        };
      }),
    );
  expect(artwork.map((frame) => Number(frame.ratio.toFixed(2)))).toEqual([
    0.8, 0.75, 1, 1.78,
  ]);
  expect(artwork.every((frame) => frame.inside)).toBe(true);
  await page.locator(".cs-library").screenshot({
    path: "artifacts/campaign-library-aligned-dark.png",
  });

  await page.setViewportSize({ width: 900, height: 1000 });
  expect(await assertAlignedRows(page)).toBe(2);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await assertAlignedRows(page)).toBe(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const first = page.locator(".cs-campaign-card").first();
  await first.locator(".cs-card-open").click();
  await expect(page.getByTestId("library-action")).toHaveText("open:active");
  await first.locator(".cs-card-delete").click();
  await expect(page.getByTestId("library-action")).toHaveText("delete:active");
  await page.locator(".cs-library").screenshot({
    path: "artifacts/campaign-library-mobile-dark.png",
  });
});

for (const theme of ["dark", "light"]) {
  test(`${theme} search is one surface with a visible focus state and working filters`, async ({
    page,
  }) => {
    await openFixture(page, theme, "en");
    const search = page.getByRole("searchbox", {
      name: "Search campaigns, products or codes",
    });
    const surfaceStyle = () =>
      page.locator(".cs-library-search").evaluate((element) => {
        const style = getComputedStyle(element);
        return [style.borderColor, style.outline, style.boxShadow];
      });
    const resting = await surfaceStyle();
    await search.focus();
    await expect(search).toBeFocused();
    expect(await surfaceStyle()).not.toEqual(resting);
    expect(
      await search.evaluate((input) => getComputedStyle(input).backgroundColor),
    ).toBe("rgba(0, 0, 0, 0)");
    await search.fill("Weekend");
    await expect(page.locator(".cs-campaign-card")).toHaveCount(1);
    await search.fill("84066096");
    await expect(page.locator(".cs-campaign-card")).toHaveCount(3);
    await search.fill("");
    await expect(page.locator(".cs-campaign-card")).toHaveCount(4);
    await page.getByRole("button", { name: "Filters", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Status", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Status", exact: true }).click();
    await page
      .getByRole("option", { name: "Offer period ended", exact: true })
      .click();
    await expect(page.locator(".cs-campaign-card")).toHaveCount(2);
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await expect(page.locator(".cs-campaign-card")).toHaveCount(4);
    await search.focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Filters", exact: true }),
    ).toBeFocused();
  });
}
