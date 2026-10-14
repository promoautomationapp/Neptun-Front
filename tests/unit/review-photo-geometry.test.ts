import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { applyAiProposals } from "../../src/features/brochure/AiReview";

function campaign(): Campaign {
  return {
    id: "photo-review",
    name: "Offers",
    products: [
      {
        code: "tv",
        name: "TV",
        image: "/original.png",
        screenArtwork: {
          image: "/wallpaper.png",
          detectedFor: "/original.png",
          box: { x: 0.1, y: 0.1, width: 0.8, height: 0.65 },
        },
        screenAnnotationPlacement: { x: 2, y: 3, scale: 0.9 },
      },
    ],
  };
}

it("applying an already available replacement keeps wallpaper but removes geometry tied to the previous photo", () => {
  const draft = campaign();
  expect(
    applyAiProposals(draft, [
      {
        type: "image",
        code: "tv",
        label: "TV",
        original: "/original.png",
        suggested: "/prepared.png",
        approved: true,
      },
    ]),
  ).toBe(1);
  expect(draft.products[0]?.image).toBe("/prepared.png");
  expect(draft.products[0]?.screenArtwork).toEqual({ image: "/wallpaper.png" });
  expect(draft.products[0]?.screenAnnotationPlacement).toEqual({
    x: 2,
    y: 3,
    scale: 0.9,
  });
});

it("unchanged available photos preserve manual fitting and declining a replacement invalidates only the replaced fit", () => {
  const draft = campaign();
  const original = structuredClone(draft.products[0]?.screenArtwork);
  expect(
    applyAiProposals(draft, [
      {
        type: "image",
        code: "tv",
        label: "TV",
        original: "/original.png",
        suggested: "/original.png",
        approved: true,
      },
    ]),
  ).toBe(0);
  expect(draft.products[0]?.screenArtwork).toEqual(original);
  const product = draft.products[0]!;
  product.image = "/prepared.png";
  product.aiOriginalImage = "/original.png";
  product.screenArtwork = {
    ...product.screenArtwork,
    detectedFor: "/prepared.png",
    image: "/wallpaper.png",
  };
  applyAiProposals(draft, [
    {
      type: "image",
      code: "tv",
      label: "TV",
      original: "/original.png",
      expectedImage: "/prepared.png",
      suggested: "/prepared.png",
      approved: false,
    },
  ]);
  expect(product.image).toBe("/original.png");
  expect(product.screenArtwork).toEqual({ image: "/wallpaper.png" });
});
