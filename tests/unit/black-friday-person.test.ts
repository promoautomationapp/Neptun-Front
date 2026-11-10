import { describe, expect, it } from "vitest";
import type { BrochurePreset } from "../../src/features/brochure/brochurePresets";
import {
  blackFridayPersonSource,
  withBlackFridayPerson,
} from "../../src/features/brochure/blackFridayPerson";

const preset: BrochurePreset = {
  id: "neptun-black-friday",
  name: "Black Friday",
  design: {
    pageArtworks: {
      cover: [
        {
          id: "person",
          type: "image",
          image: "/forex.webp",
          referenceSource: "Forex.png",
          x: 4,
          y: 20,
          width: 38,
          height: 60,
          rotation: -3,
          zIndex: 7,
        },
        {
          id: "logo",
          type: "image",
          image: "/logo.webp",

          x: 30,
          y: 2,
          width: 40,
        },
        {
          id: "coupon",
          type: "image",
          image: "/coupon.webp",

          x: 10,
          y: 80,
          width: 25,
        },
        {
          id: "title",
          type: "text",
          text: "Black Friday",
          x: 20,
          y: 10,
          width: 50,
        },
      ],
      "product-1": [
        {
          id: "person2",
          type: "image",
          image: "/tv2.webp",
          referenceSource: "tv2.png",
          x: 77,
          y: 2,
          width: 22,
          height: 30,
          zIndex: 3,
        },
      ],
    },
  },
} as BrochurePreset;

describe("Black Friday person artwork choice", () => {
  it("includes the flattened closing person photo and preserves hairdryer accessory artwork", () => {
    const closing = {
      ...preset,
      design: {
        ...preset.design,
        pageArtworks: {
          stores: [
            {
              id: "closing-poster",
              type: "image",
              image: "/closing-prizes.webp",
              referenceSource: "ChatGPT Image Nov 18, 2025, 02_11_04 PM3.png",
              referenceRole: "promotion" as const,
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              zIndex: 1,
            },
            {
              id: "accessory",
              type: "image",
              image: "/accessory.webp",
              referenceSource: "Aksesore.png",
              referenceRole: "person" as const,
              x: 80,
              y: 40,
              width: 6,
            },
            {
              id: "coupon",
              type: "image",
              image: "/coupon.webp",
              x: 5,
              y: 15,
              width: 30,
            },
          ],
        },
      },
    };
    expect(
      blackFridayPersonSource(closing.design.pageArtworks.stores[1]!),
    ).toBeNull();
    expect(
      withBlackFridayPerson(closing, {
        mode: "none",
      }).design.pageArtworks?.stores?.map((artwork) => artwork.id),
    ).toEqual(["accessory", "coupon"]);
    expect(
      withBlackFridayPerson(closing, {
        mode: "replace",
        image: "/new-person.webp",
      }).design.pageArtworks?.stores?.[0],
    ).toMatchObject({
      id: "closing-poster",
      image: "/new-person.webp",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      zIndex: 1,
    });
  });
  it("removes only the source person layers and keeps products/design data intact", () => {
    const next = withBlackFridayPerson(preset, { mode: "none" });
    expect(
      next.design.pageArtworks?.cover?.map((artwork) => artwork.id),
    ).toEqual(["logo", "coupon", "title"]);
    expect(next.design.pageArtworks?.["product-1"]).toEqual([]);
    expect(preset.design.pageArtworks?.cover).toHaveLength(4);
  });

  it("replaces all person images while preserving saved geometry and source identity", () => {
    const next = withBlackFridayPerson(preset, {
      mode: "replace",
      image: "/new-person.webp",
    });
    expect(next.design.pageArtworks?.cover?.[0]).toMatchObject({
      id: "person",
      image: "/new-person.webp",
      x: 4,
      y: 20,
      width: 38,
      height: 60,
      rotation: -3,
      zIndex: 7,
      referenceSource: "Forex.png",
      referenceRole: "person",
    });
    expect(next.design.pageArtworks?.["product-1"]?.[0]?.image).toBe(
      "/new-person.webp",
    );
    expect(next.design.pageArtworks?.cover?.slice(1)).toEqual(
      preset.design.pageArtworks?.cover?.slice(1),
    );
    expect(
      withBlackFridayPerson(next, {
        mode: "none",
      }).design.pageArtworks?.cover?.map((artwork) => artwork.id),
    ).toEqual(["logo", "coupon", "title"]);
  });

  it("keeps supplied artwork by default and leaves other presets alone", () => {
    expect(
      withBlackFridayPerson(preset, { mode: "keep" }).design.pageArtworks
        ?.cover?.[0]?.image,
    ).toBe("/forex.webp");
    expect(
      withBlackFridayPerson(
        { ...preset, id: "neptun-current" },
        { mode: "none" },
      ).design,
    ).toEqual(preset.design);
    expect(
      withBlackFridayPerson(
        {
          ...preset,
          id: "team-copy",
          design: { ...preset.design, brochureReferenceDesign: "black-friday" },
        },
        { mode: "none" },
      ).design.pageArtworks?.cover?.map((artwork) => artwork.id),
    ).toEqual(["logo", "coupon", "title"]);
  });
});
