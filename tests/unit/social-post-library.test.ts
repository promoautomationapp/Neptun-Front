import { afterEach, expect, it } from "vitest";
import { setLanguage, t } from "../../src/features/brochure/i18n";
import { createPost } from "../../src/features/social/postModel";
import {
  duplicateSocialPost,
  socialPostDisplayName,
} from "../../src/features/social/socialPostLibrary";

afterEach(() => setLanguage("en"));

it("localizes only the placeholder title and preserves a team's own title", () => {
  setLanguage("sq");
  expect(socialPostDisplayName({ name: "New social post" })).toBe(
    t("New social post"),
  );
  expect(socialPostDisplayName({ name: " " })).toBe(t("New social post"));
  expect(socialPostDisplayName({ name: "Oferta e fundjavës" })).toBe(
    "Oferta e fundjavës",
  );
});

it("duplicates editable content with independent layer IDs and a fresh save/review history", () => {
  const original = {
    ...createPost([
      {
        code: "tv-55",
        name: "Television",
        productArtworks: [
          { id: "product-layer", image: "/photo.png", x: 20, y: 20, width: 40 },
        ],
      },
    ]),
    name: "Weekend offer",
    artworks: [
      {
        id: "post-layer",
        type: "overlay" as const,
        color: "#123456",
        x: 50,
        y: 50,
        width: 70,
        opacity: 0.4,
      },
    ],
    version: 7,
    revision: 9,
    disabledAt: "2026-10-01T00:00:00Z",
    disabledBy: "original-author",
    createdBy: "original-author",
    updatedBy: "original-editor",
    status: "in_review",
    reviewComments: [{ id: "comment" }],
    reviewHistory: [{ id: "review" }],
  };
  const before = structuredClone(original);
  const copy = duplicateSocialPost(original);
  expect(copy.id).not.toBe(original.id);
  expect(copy.name).toBe("Weekend offer · Copy");
  expect(copy).toMatchObject({
    status: "in_progress",
    revision: 0,
    reviewComments: [],
    reviewHistory: [],
  });
  for (const key of [
    "version",
    "disabledAt",
    "disabledBy",
    "createdBy",
    "updatedBy",
  ])
    expect(copy).not.toHaveProperty(key);
  expect(copy.artworks?.[0]?.id).not.toBe("post-layer");
  expect(copy.products[0]?.productArtworks?.[0]?.id).not.toBe("product-layer");
  expect(copy.products[0]?.code).toBe("tv-55");
  copy.products[0]!.name = "Changed copy";
  copy.artworks![0]!.opacity = 0;
  expect(original).toEqual(before);
});
