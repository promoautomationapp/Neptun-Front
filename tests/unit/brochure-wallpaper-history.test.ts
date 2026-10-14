import { expect, it } from "vitest";
import type { Campaign, Product, ScreenArtwork } from "../../src/domain/models";
import {
  applyTvWallpaper,
  campaignTelevisions,
} from "../../src/features/brochure/tvWallpaper";
import {
  createCampaignEditHistory,
  restoreCampaignEdit,
} from "../../src/features/brochure/campaignEditHistory";
import {
  compactStoresFooterScale,
  hasCompactStoresFooter,
} from "../../src/features/brochure/storesSelection";
import { brochureFormatContentGeometry } from "../../src/features/brochure/brochureFormat";

const television = (code: string, screenArtwork?: ScreenArtwork): Product => ({
  code,
  name: "TV LED",
  subcategory: "TV",
  image: `/photo-${code}.png`,
  sale: 399,
  ...(screenArtwork ? { screenArtwork } : {}),
});

function brochure(): Campaign {
  return {
    id: "brochure-fixes",
    name: "October offers",
    version: 1,
    brochureFormat: "neptun1080x1350",
    includeStoresPage: true,
    products: [
      television("one"),
      {
        code: "tv-and-oven",
        name: "TV + oven",
        subcategory: "Bundle",
        sale: 599,
        bundleProducts: [
          television("member", {
            image: "/old.jpg",
            box: { x: 0.15, y: 0.1, width: 0.7, height: 0.5 },
            detectedFor: "/member-photo.jpg",
          }),
          {
            code: "oven",
            name: "Oven",
            subcategory: "FURRË",
            image: "/oven.png",
            sale: 299,
          },
        ],
        productArtworks: [
          {
            id: "member-photo",
            type: "bundle-product",
            memberCode: "member",
            x: 34,
            y: 13,
            width: 61,
          },
        ],
      },
    ],
  };
}

const wallpaper: ScreenArtwork = {
  image: "/winter.jpg",
  box: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 },
  detectedFor: "/photo-one.png",
};

it("applies one wallpaper to all TVs, preserving each bundle member's geometry, shared price and positions", () => {
  const value = brochure();
  const bundle = value.products[1];
  const member = bundle?.bundleProducts?.[0];
  const oven = bundle?.bundleProducts?.[1];
  if (!bundle || !member || !oven) throw new Error("Bundle fixture missing");
  const originalOven = structuredClone(oven);
  const originalPlacement = structuredClone(bundle.productArtworks);
  expect(campaignTelevisions(value).map((item) => item.code)).toEqual([
    "one",
    "member",
  ]);
  expect(applyTvWallpaper(value, "one", wallpaper, "all")).toBe(2);
  expect(member.screenArtwork).toEqual({
    image: wallpaper.image,
    box: { x: 0.15, y: 0.1, width: 0.7, height: 0.5 },
    detectedFor: "/member-photo.jpg",
  });
  expect(bundle.sale).toBe(599);
  expect(bundle.productArtworks).toEqual(originalPlacement);
  expect(bundle.screenArtwork).toBeUndefined();
  expect(oven).toEqual(originalOven);
  expect(applyTvWallpaper(value, "member", null)).toBe(1);
  expect(member.screenArtwork).toBeUndefined();
  expect(value.products[0]?.screenArtwork).toEqual(wallpaper);
});

it("missing products and an all-scope laptop edit never change unrelated TV wallpapers", () => {
  const value = brochure();
  const laptop: Product = {
    code: "laptop",
    name: "Laptop",
    subcategory: "LAPTOP",
  };
  value.products.push(laptop);
  expect(applyTvWallpaper(value, "laptop", wallpaper, "all")).toBe(1);
  expect(laptop.screenArtwork).toEqual(wallpaper);
  expect(value.products[0]?.screenArtwork).toBeUndefined();
  const before = structuredClone(value);
  expect(applyTvWallpaper(value, "missing", wallpaper, "all")).toBe(0);
  expect(value).toEqual(before);
});

it("four undo and redo steps recover wallpapers, format, cover and last-page footer while retaining the current save version", () => {
  const history = createCampaignEditHistory();
  let current = brochure();
  const initial = structuredClone(current);
  const edit = (change: (value: Campaign) => void) => {
    const next = structuredClone(current);
    change(next);
    expect(history.record(current, next)).toBe(true);
    current = { ...next, version: (current.version ?? 1) + 1 };
  };
  edit((value) => {
    applyTvWallpaper(value, "one", wallpaper, "all");
  });
  edit((value) => {
    value.brochureFormat = "16:9";
  });
  edit((value) => {
    value.showCoverLogo = false;
    value.coverImage = "/living-room.jpg";
    value.pageArtworks = {
      cover: [
        {
          id: "photo",
          type: "image",
          image: "/photo.png",
          x: 10,
          y: 12,
          width: 70,
          opacity: 0.35,
        },
      ],
    };
    value.pages = {
      0: { backgroundGradient: { from: "#123456", to: "#abcdef", angle: 90 } },
    };
  });
  edit((value) => {
    value.includeStoresPage = false;
    value.includeStoresFooter = true;
    value.compactStoresFooterHeight = 18;
    value.storeFooterElementPlacements = { logos: { x: 4, y: 3, width: 20 } };
  });
  const completed = structuredClone(current);
  expect(history.counts(current.id)).toEqual({ undo: 4, redo: 0 });
  expect(compactStoresFooterScale(current)).toBe(0.82);
  expect(hasCompactStoresFooter(current, 0, 1)).toBe(false);
  expect(hasCompactStoresFooter(current, 1, 1)).toBe(true);
  expect(brochureFormatContentGeometry(current, 1920).contentWidth).toBeCloseTo(
    864,
  );
  for (let index = 0; index < 4; index++) {
    const snapshot = history.undo(current);
    if (!snapshot) throw new Error("Undo step missing");
    current = restoreCampaignEdit(snapshot, current);
    expect(current.version).toBe(completed.version);
  }
  expect(current).toEqual({ ...initial, version: completed.version });
  expect(history.undo(current)).toBeNull();
  for (let index = 0; index < 4; index++) {
    const snapshot = history.redo(current);
    if (!snapshot) throw new Error("Redo step missing");
    current = restoreCampaignEdit(snapshot, current);
  }
  expect(current).toEqual(completed);
  expect(history.counts(current.id)).toEqual({ undo: 4, redo: 0 });
});
