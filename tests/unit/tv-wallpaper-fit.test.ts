import { afterEach, expect, it, vi } from "vitest";
import type { Box, Campaign, Product } from "../../src/domain/models";
import { requestAi } from "../../src/features/ai/ai.api";
import {
  applyTvWallpaper,
  campaignTelevisionPhoto,
  campaignTelevisionPhotos,
  campaignTelevisions,
} from "../../src/features/brochure/tvWallpaper";
import {
  fitTvWallpaperTargets,
  screenGeometryImageUrl,
} from "../../src/features/brochure/tvWallpaperFit";

vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(requestAi).mockReset();
});
const product = (code: string, changes: Partial<Product> = {}): Product => ({
  code,
  name: "TV LED",
  subcategory: "TV",
  image: `/photo-${code}.jpg`,
  ...changes,
});

function image(source: string) {
  const result = document.createElement("img");
  result.src = source;
  Object.defineProperties(result, {
    naturalWidth: { value: 100 },
    naturalHeight: { value: 80 },
  });
  return result;
}
function panel(x: number, y: number, width: number, height: number) {
  const pixels = new Uint8ClampedArray(100 * 80 * 4).fill(255);
  for (let row = y; row < y + height; row++)
    for (let column = x; column < x + width; column++) {
      const offset = (row * 100 + column) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 30;
    }
  return pixels;
}
function samplePhotos(photos: Map<string, Uint8ClampedArray>) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
    let source = "";
    return {
      drawImage: (picture: HTMLImageElement) => {
        source = new URL(picture.src).pathname;
      },
      getImageData: () => ({
        data: photos.get(source) || new Uint8ClampedArray(100 * 80 * 4),
      }),
    } as unknown as CanvasRenderingContext2D;
  });
}

it("fits different white margins for each TV locally without AI or shared coordinates", async () => {
  const products = [product("wide"), product("large-margins")];
  samplePhotos(
    new Map([
      [products[0]!.image!, panel(10, 8, 80, 45)],
      [products[1]!.image!, panel(25, 20, 50, 28)],
    ]),
  );
  const result = await fitTvWallpaperTargets(products, {
    allowAi: true,
    loadImage: async (source) => image(source),
  });
  expect(result.unfittedCodes).toEqual([]);
  const boxes = new Map(result.fits.map((fit) => [fit.code, fit.box]));
  expect(boxes.get("wide")).toEqual({
    x: 0.11,
    y: 0.1125,
    width: 0.78,
    height: 0.5375,
  });
  expect(boxes.get("large-margins")).toEqual({
    x: 0.26,
    y: 0.2625,
    width: 0.48,
    height: 0.325,
  });
  expect(requestAi).not.toHaveBeenCalled();
  const campaign = { products } as Campaign;
  applyTvWallpaper(
    campaign,
    "wide",
    { image: "/wallpaper.jpg", fit: "cover" },
    "all",
    result,
  );
  expect(products[0]!.screenArtwork?.box).toEqual(boxes.get("wide"));
  expect(products[1]!.screenArtwork?.box).toEqual(boxes.get("large-margins"));
});

it("preserves deliberate own-photo fits but replaces an old stamped generic fallback", async () => {
  const manual: Box = { x: 0.13, y: 0.18, width: 0.7, height: 0.5 };
  const products = [
    product("manual-fit", {
      screenArtwork: {
        image: "/old.jpg",
        box: manual,
        detectedFor: "/photo-manual-fit.jpg",
      },
    }),
    product("old-default", {
      screenArtwork: {
        image: "/old.jpg",
        box: { x: 0.04, y: 0.08, width: 0.92, height: 0.75 },
        detectedFor: "/photo-old-default.jpg",
      },
    }),
  ];
  samplePhotos(new Map([[products[1]!.image!, panel(25, 20, 50, 28)]]));
  const loadImage = vi.fn(async (source) => image(source));
  const result = await fitTvWallpaperTargets(products, { loadImage });
  expect(loadImage).toHaveBeenCalledExactlyOnceWith(
    products[1]!.image,
    undefined,
  );
  expect(result.fits.find((fit) => fit.code === "manual-fit")?.box).toEqual(
    manual,
  );
  expect(result.fits.find((fit) => fit.code === "old-default")?.box.x).toBe(
    0.26,
  );
});

it("keeps unfitted and stale-photo wallpapers unchanged instead of saving a fallback", async () => {
  const failed = product("unfitted", { screenArtwork: { image: "/keep.jpg" } });
  const loadImage = vi.fn(async () => {
    throw new Error("Photo unavailable");
  });
  const result = await fitTvWallpaperTargets([failed], { loadImage });
  expect(result).toEqual({ fits: [], unfittedCodes: ["unfitted"] });
  const campaign = { products: [failed] } as Campaign;
  expect(
    applyTvWallpaper(
      campaign,
      failed.code,
      { image: "/new.jpg" },
      "all",
      result,
    ),
  ).toBe(0);
  expect(failed.screenArtwork).toEqual({ image: "/keep.jpg" });
  expect(
    applyTvWallpaper(campaign, failed.code, { image: "/new.jpg" }, "all", {
      fits: [
        {
          code: failed.code,
          detectedFor: "/previous-photo.jpg",
          box: { x: 0.1, y: 0.1, width: 0.8, height: 0.5 },
        },
      ],
      unfittedCodes: [],
    }),
  ).toBe(0);
  expect(failed.screenArtwork).toEqual({ image: "/keep.jpg" });
  expect(requestAi).not.toHaveBeenCalled();
});

it("uses AI only for unresolved individual photos with at most two concurrent fits", async () => {
  const products = [
    product("ai-first"),
    product("ai-second"),
    product("ai-third"),
  ];
  const pending: Array<() => void> = [];
  let active = 0,
    maximum = 0;
  vi.mocked(requestAi).mockImplementation(async () => {
    active++;
    maximum = Math.max(maximum, active);
    return await new Promise((resolve) =>
      pending.push(() => {
        active--;
        resolve({
          found: true,
          x: 0.2,
          y: 0.15,
          width: 0.6,
          height: 0.5,
        } as never);
      }),
    );
  });
  const result = fitTvWallpaperTargets(products, {
    allowAi: true,
    loadImage: async () => {
      throw new Error("Unreadable pixels");
    },
  });
  await vi.waitFor(() => expect(requestAi).toHaveBeenCalledTimes(2));
  pending[0]!();
  await vi.waitFor(() => expect(requestAi).toHaveBeenCalledTimes(3));
  pending[1]!();
  pending[2]!();
  const plan = await result;
  expect(plan.fits).toHaveLength(3);
  expect(plan.unfittedCodes).toEqual([]);
  expect(maximum).toBe(2);
  expect(vi.mocked(requestAi).mock.calls.map((call) => call[1])).toEqual(
    products.map((tv) => ({ image: tv.image })),
  );
});

it("does not start AI after the caller aborts a pending local photo load", async () => {
  const controller = new AbortController();
  let loaded!: (image: HTMLImageElement) => void;
  const pending = fitTvWallpaperTargets([product("aborted-fit")], {
    allowAi: true,
    signal: controller.signal,
    loadImage: () =>
      new Promise((resolve) => {
        loaded = resolve;
      }),
  });
  const rejected = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  controller.abort();
  loaded(image("/photo-aborted-fit.jpg"));
  await rejected;
  expect(requestAi).not.toHaveBeenCalled();
});

it("samples protected Neptun catalog photos through the existing authenticated image proxy", () => {
  const remote = "https://www.neptun-ks.com/photo.jpg";
  expect(screenGeometryImageUrl(remote)).toBe(
    `/api/export-image?url=${encodeURIComponent(remote)}`,
  );
  expect(
    screenGeometryImageUrl("https://neptun-ks.com.evil.test/photo.jpg"),
  ).toBe("https://neptun-ks.com.evil.test/photo.jpg");
  expect(screenGeometryImageUrl("/api/assets/photo")).toBe("/api/assets/photo");
});

it("matches duplicate TV codes to their own photo instead of the first offer's fit", () => {
  const first = product("same", { image: "/first-photo.jpg" });
  const second = product("same", { image: "/second-photo.jpg" });
  const boxes = [
    { x: 0.1, y: 0.1, width: 0.8, height: 0.5 },
    { x: 0.2, y: 0.2, width: 0.6, height: 0.4 },
  ];
  const fits = [first, second].map((tv, index) => ({
    code: tv.code,
    detectedFor: tv.image!,
    box: boxes[index]!,
  }));
  applyTvWallpaper(
    { products: [first, second] } as Campaign,
    "same",
    { image: "/wallpaper.jpg" },
    "all",
    { fits, unfittedCodes: [] },
  );
  expect(first.screenArtwork?.box).toEqual(boxes[0]);
  expect(second.screenArtwork?.box).toEqual(boxes[1]);
});

it.each([2, 3])(
  "fits the actual replaced primary photo of a %i-member bundle without changing catalog photos",
  async (count) => {
    const member = product(`bundle-primary-${count}`, {
      image: `/original-primary-${count}.jpg`,
      screenArtwork: {
        image: "/previous-wallpaper.jpg",
        box: { x: 0.1, y: 0.1, width: 0.8, height: 0.5 },
        detectedFor: `/original-primary-${count}.jpg`,
      },
    });
    const bundle: Product = {
      code: `bundle-${count}`,
      name: "TV LED 65ABC & appliance",
      image: `/prepared-primary-${count}.png`,
      bundleProducts: [
        member,
        ...Array.from({ length: count - 1 }, (_, index) => ({
          code: `appliance-${index}`,
          name: "Oven",
          image: "/oven.png",
        })),
      ],
    };
    const campaign = { products: [bundle] };
    const before = structuredClone(bundle);
    expect(campaignTelevisions(campaign)).toEqual([member]);
    const targets = campaignTelevisionPhotos(campaign);
    expect(targets[0]?.image).toBe(bundle.image);
    expect(targets[0]).not.toBe(member);
    expect(campaignTelevisionPhoto(campaign, bundle).code).toBe(member.code);
    expect(campaignTelevisionPhoto(campaign, member).image).toBe(bundle.image);
    samplePhotos(new Map([[bundle.image!, panel(20, 12, 60, 34)]]));
    const loadImage = vi.fn(async (source: string) => image(source));
    const plan = await fitTvWallpaperTargets(targets, { loadImage });
    expect(loadImage).toHaveBeenCalledExactlyOnceWith(bundle.image, undefined);
    expect(
      applyTvWallpaper(
        campaign,
        bundle.code,
        { image: "/new-wallpaper.jpg" },
        "one",
        plan,
      ),
    ).toBe(1);
    expect(member.screenArtwork?.detectedFor).toBe(bundle.image);
    expect(member.screenArtwork?.box).toEqual(plan.fits[0]?.box);
    expect(member.image).toBe(before.bundleProducts?.[0]?.image);
    expect(bundle.image).toBe(before.image);
    expect(bundle.screenArtwork).toBeUndefined();
    expect(requestAi).not.toHaveBeenCalled();
  },
);

it("uses a saved member artwork replacement and retains its manual screen fit and geometry", async () => {
  const box = { x: 0.2, y: 0.15, width: 0.6, height: 0.4 };
  const member = product("custom-art", {
    screenArtwork: {
      image: "/old-wallpaper.jpg",
      box,
      detectedFor: "/manual-member-photo.png",
    },
  });
  const bundle: Product = {
    code: "custom-bundle",
    name: "Set",
    image: "/primary.png",
    bundleProducts: [member, { code: "oven", name: "Oven" }],
    productArtworks: [
      {
        id: "custom-member",
        type: "bundle-product",
        memberCode: member.code,
        image: "/manual-member-photo.png",
        relativeTo: "product",
        x: 11,
        y: 17,
        width: 48,
        height: 37,
      },
    ],
  };
  const campaign = { products: [bundle] };
  const savedArtworks = structuredClone(bundle.productArtworks);
  const loadImage = vi.fn(async (source: string) => image(source));
  const plan = await fitTvWallpaperTargets(campaignTelevisionPhotos(campaign), {
    loadImage,
  });
  expect(loadImage).not.toHaveBeenCalled();
  expect(plan.fits[0]?.box).toEqual(box);
  expect(
    applyTvWallpaper(
      campaign,
      member.code,
      { image: "/new-wallpaper.jpg" },
      "one",
      plan,
    ),
  ).toBe(1);
  expect(member.screenArtwork?.box).toEqual(box);
  expect(bundle.productArtworks).toEqual(savedArtworks);
  bundle.productArtworks![0]!.image = "/newer-member-photo.png";
  expect(
    applyTvWallpaper(
      campaign,
      member.code,
      { image: "/stale-wallpaper.jpg" },
      "one",
      plan,
    ),
  ).toBe(0);
  expect(member.screenArtwork?.image).toBe("/new-wallpaper.jpg");
});

it("persists the measured fit for a social product collection instead of the editor's initial fallback", () => {
  const television = product("social-fit");
  const fitted = { x: 0.2, y: 0.15, width: 0.6, height: 0.4 };
  const post = { products: [television] };
  expect(
    applyTvWallpaper(
      post,
      television.code,
      {
        image: "/social-wallpaper.jpg",
        fit: "cover",
        box: { x: 0.04, y: 0.08, width: 0.92, height: 0.75 },
      },
      "one",
      {
        fits: [
          {
            code: television.code,
            detectedFor: television.image!,
            box: fitted,
          },
        ],
        unfittedCodes: [],
      },
    ),
  ).toBe(1);
  expect(television.screenArtwork?.box).toEqual(fitted);
  expect(television.screenArtwork?.detectedFor).toBe(television.image);
});

it("selects the fitted duplicate SKU by its effective photo for a single-TV edit", () => {
  const first = product("duplicate-one", { image: "/first-duplicate.jpg" });
  const member = product("duplicate-one", { image: "/member-original.jpg" });
  const bundle: Product = {
    code: "duplicate-bundle",
    name: "Set",
    image: "/member-prepared.png",
    bundleProducts: [member, { code: "oven", name: "Oven" }],
  };
  const campaign = { products: [first, bundle] };
  const box = { x: 0.2, y: 0.15, width: 0.6, height: 0.4 };
  expect(
    applyTvWallpaper(
      campaign,
      member.code,
      { image: "/member-wallpaper.jpg" },
      "one",
      {
        fits: [{ code: member.code, detectedFor: bundle.image!, box }],
        unfittedCodes: [],
      },
    ),
  ).toBe(1);
  expect(first.screenArtwork).toBeUndefined();
  expect(member.screenArtwork).toEqual({
    image: "/member-wallpaper.jpg",
    fit: "cover",
    detectedFor: bundle.image,
    box,
  });
  expect(
    applyTvWallpaper(campaign, first.code, { image: "/legacy-first.jpg" }),
  ).toBe(1);
  expect(first.screenArtwork?.image).toBe("/legacy-first.jpg");
  expect(member.screenArtwork?.image).toBe("/member-wallpaper.jpg");
});
