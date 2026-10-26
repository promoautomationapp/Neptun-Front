import { expect, test } from "@playwright/test";

test("TVs grow with inches in Classic and Blue, keeping manual sizes and their own wallpaper frames", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 1500 });
  await page.route("**/fonts.googleapis.com/**", (route) =>
    route.fulfill({ contentType: "text/css", body: "" }),
  );
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => route.fulfill({ status: 404, body: "" }),
  );
  await page.route("**/__tv-inch-size", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html><head><meta charset="UTF-8"><script type="module">import RefreshRuntime from "/@react-refresh";RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script></head><body><div id="tv-size-fixture"></div><script type="module" src="/tests/e2e/fixtures/tv-size-layout.tsx"></script></body></html>',
    }),
  );
  await page.goto("/__tv-inch-size");
  const comparison = async (preset: string) =>
    page
      .locator(`[data-tv-preset="${preset}"] .brochure-product`)
      .evaluateAll((cards) =>
        cards.map((card) => {
          const image = card.querySelector<HTMLImageElement>(
            ".brochure-product-image",
          )!;
          const bounds = image.getBoundingClientRect();
          const width = Math.min(
            bounds.width,
            (bounds.height * image.naturalWidth) / image.naturalHeight,
          );
          return {
            width,
            scale: Number(
              image.style.transform.match(/scale\(([\d.]+)\)/)?.[1],
            ),
            loaded: image.complete && image.naturalWidth > 0,
          };
        }),
      );
  const checkWallpapers = async (preset: string) => {
    const overlays = page.locator(
      `[data-tv-preset="${preset}"] .brochure-screen-image`,
    );
    await expect(overlays).toHaveCount(4);
    const offsets = await overlays.evaluateAll((images) =>
      images.map((overlay) => {
        const photo = overlay
          .closest(".brochure-product-image-wrap")!
          .querySelector<HTMLImageElement>(".brochure-product-image")!;
        const photoBox = photo.getBoundingClientRect(),
          box = overlay.getBoundingClientRect();
        const width = Math.min(
          photoBox.width,
          (photoBox.height * photo.naturalWidth) / photo.naturalHeight,
        );
        const height = (width * photo.naturalHeight) / photo.naturalWidth;
        const left = photoBox.left + (photoBox.width - width) / 2,
          top = photoBox.top + (photoBox.height - height) / 2;
        const style = getComputedStyle(overlay);
        return {
          x: (box.x - left) / width,
          y: (box.y - top) / height,
          width: box.width / width,
          height: box.height / height,
          fit: style.objectFit,
          background: style.backgroundColor,
        };
      }),
    );
    for (const offset of offsets) {
      expect(offset.x).toBeCloseTo(0.06, 2);
      expect(offset.y).toBeCloseTo(0.08, 2);
      expect(offset.width).toBeCloseTo(0.88, 2);
      expect(offset.height).toBeCloseTo(0.72, 2);
      expect(offset.fit).toBe("contain");
      expect(offset.background).toBe("rgb(0, 0, 0)");
    }
  };
  for (const preset of ["neptun-current", "neptun-october"]) {
    await expect
      .poll(
        async () =>
          (await comparison(preset)).filter((image) => image.loaded).length,
      )
      .toBe(4);
    const photos = await comparison(preset);
    expect(photos.map((photo) => photo.scale)).toEqual([
      0.755, 0.86, 0.93, 0.943,
    ]);
    expect(
      photos.every(
        (photo, index) => index === 0 || photo.width > photos[index - 1]!.width,
      ),
    ).toBe(true);
    expect(photos[2]!.width / photos[1]!.width).toBeGreaterThan(1.07);
    await checkWallpapers(preset);
  }
  await page.getByRole("button", { name: "Use saved manual sizes" }).click();
  for (const preset of ["neptun-current", "neptun-october"]) {
    await expect
      .poll(async () => (await comparison(preset))[0]?.scale)
      .toBe(1.12);
    await checkWallpapers(preset);
  }
  await page.getByRole("button", { name: "Reset manual sizes" }).click();
  for (const preset of ["neptun-current", "neptun-october"])
    await expect
      .poll(async () => (await comparison(preset))[0]?.scale)
      .toBe(0.755);
});
