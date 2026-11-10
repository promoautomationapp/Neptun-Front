import { expect, it } from "vitest";
import {
  BLACK_COLLECTION_ID,
  blackFridayFrames,
  blackFridayProductArtworks,
  blackFridayReference,
  isBlackCollectionBrochure,
  isBlackFridayBrochure,
} from "../../src/features/brochure/blackFridayDesign";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../src/features/brochure/brochurePresets";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { campaignSchema } from "../../src/domain/schemas";
import type { Campaign } from "../../src/domain/models";
import { withBlackFridayPerson } from "../../src/features/brochure/blackFridayPerson";

it("creates a separate reusable black design without people or campaign-specific source art", () => {
  const preset = availableBrochurePresets(resolveSettings(null)).find(
    (preset) => preset.id === BLACK_COLLECTION_ID,
  )!;
  const campaign: Campaign = { id: "clean", name: "Clean", products: [] };
  applyBrochurePreset(campaign, preset);
  expect(isBlackCollectionBrochure(campaign)).toBe(true);
  expect(isBlackFridayBrochure(campaign)).toBe(true);
  expect(campaign).toMatchObject({
    brochureReferenceDesign: "black-collection",
    includeStoresPage: false,
    autoProductLayout: true,
    offerStyle: "current",
    brandLogoMode: "white",
  });
  const artwork = Object.values(campaign.pageArtworks || {}).flat();
  expect(artwork.map((item) => item.id)).toEqual([
    "black-collection-logo",
    "black-collection-title",
  ]);
  expect(
    artwork.some(
      (item) =>
        item.referenceRole === "person" || item.referenceRole === "promotion",
    ),
  ).toBe(false);
  expect(campaignSchema.parse(campaign).brochureReferenceDesign).toBe(
    "black-collection",
  );
  expect(
    withBlackFridayPerson(preset, { mode: "replace", image: "/user.png" }),
  ).toEqual(preset);
  const copy = { ...preset, id: "custom-clean" };
  applyBrochurePreset(campaign, copy);
  expect(isBlackCollectionBrochure(campaign)).toBe(true);
  applyBrochurePreset(
    campaign,
    availableBrochurePresets(resolveSettings(null)).find(
      (preset) => preset.id === "neptun-current",
    )!,
  );
  expect(isBlackFridayBrochure(campaign)).toBe(false);
  expect(Object.values(campaign.pageArtworks || {}).flat()).toEqual([]);
});

it("uses dynamic frames for arbitrary products even when their count matches a source page", () => {
  const preset = availableBrochurePresets(resolveSettings(null)).find(
    (preset) => preset.id === BLACK_COLLECTION_ID,
  )!;
  const products = Array.from({ length: 6 }, (_, index) => ({
    code: `my-${index}`,
    name: `My product ${index}`,
  }));
  const frames = blackFridayFrames(2, products, preset.design);
  expect(frames).toHaveLength(6);
  expect(frames.map((frame) => frame.model)).toEqual(
    products.map((product) => product.name),
  );
  expect(
    frames.every(
      (frame) =>
        !frame.detailRects &&
        !frame.productArtworks &&
        !frame.sourceImage &&
        !frame.brandImage,
    ),
  ).toBe(true);
});

it("keeps a featured cover row above the remaining imported products", () => {
  const design = availableBrochurePresets(resolveSettings(null)).find(
    (preset) => preset.id === BLACK_COLLECTION_ID,
  )!.design;
  for (const count of [2, 3, 4]) {
    const products = Array.from({ length: count }, (_, index) => ({
      code: String(index),
      name: `Offer ${index}`,
    }));
    const frames = blackFridayFrames(1, products, design);
    expect(frames.slice(1).every((frame) => frame.y > frames[0]!.y)).toBe(true);
    expect(new Set(frames.slice(1).map((frame) => frame.y)).size).toBe(1);
    expect(frames[0]!.width).toBeGreaterThanOrEqual(frames[1]!.width);
  }
});

it("never seeds optional new-model/capacity labels or their backing shapes, including for source products", () => {
  const cover = blackFridayReference.pages[0]!;
  expect(
    blackFridayProductArtworks(cover.frames[0]!, {
      code: cover.frames[0]!.code!,
      name: "TV",
    }),
  ).toEqual([]);
  expect(
    blackFridayProductArtworks(cover.frames[1]!, {
      code: cover.frames[1]!.code!,
      name: "Washer",
    }),
  ).toEqual([]);
  const fridge = blackFridayReference.pages.find((page) => page.number === 10)!
    .frames[0]!;
  expect(
    blackFridayProductArtworks(fridge, {
      code: "another",
      name: "Another product",
    }),
  ).toEqual([]);
});
