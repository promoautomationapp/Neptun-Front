import { describe, expect, it } from "vitest";
import { campaignSchema } from "../../src/domain/schemas";
import type { Campaign } from "../../src/domain/models";
import {
  createPageBanner,
  fitCoverBelowBanners,
  pageBannerInset,
  pageBannerProductStyle,
} from "../../src/features/brochure/pageBanners";

const campaign = (): Campaign => ({
  id: "banners",
  name: "Banner test",
  products: [],
});

describe("page banners", () => {
  it("creates three separate editable banner defaults and prioritizes BF typography", () => {
    const value = { ...campaign(), brochurePresetId: "neptun-black-friday" };
    const color = createPageBanner("color", value, "product-0", {
      id: "color",
      text: "Sale",
    });
    const text = createPageBanner("text", value, "cover", {
      id: "text",
      text: "Title",
    });
    const image = createPageBanner("image", value, "product-0", {
      id: "image",
      image: "/photo.png",
    });
    expect(color).toMatchObject({
      layoutRole: "banner",
      type: "text",
      width: 98,
      height: 7,
      backgroundColor: "#ff3b1f",
      color: "#ffffff",
      fontFamily: "Cera Pro",
    });
    expect(text).toMatchObject({ backgroundColor: "#00000000", text: "Title" });
    expect(image).toMatchObject({
      type: "image",
      width: 100,
      height: 25,
      image: "/photo.png",
      imageFit: "cover",
    });
    expect(
      campaignSchema.parse({
        ...value,
        pageArtworks: { cover: [color, text, image] },
      }).pageArtworks?.cover,
    ).toEqual([color, text, image]);
  });
  it("reserves only visible intentional banners and restores product space after deletion", () => {
    const value = campaign();
    const image = createPageBanner("image", value, "product-0", {
      id: "image",
      image: "/photo.png",
    });
    value.pageArtworks = {
      "product-0": [
        image,
        { id: "float", type: "image", x: 0, y: 70, width: 90, height: 25 },
      ],
    };
    expect(pageBannerInset(value, "product-0")).toBe(26.2);
    expect(pageBannerProductStyle(value, "product-0", 11.5)).toEqual({
      top: "26.2%",
    });
    image.hidden = true;
    expect(pageBannerInset(value, "product-0")).toBe(0);
    delete image.hidden;
    image.y = 12;
    image.height = 30;
    expect(pageBannerInset(value, "product-0")).toBe(43.2);
    value.pageArtworks["product-0"] = [];
    expect(pageBannerProductStyle(value, "product-0", 11.5)).toEqual({});
  });
  it("keeps cover rows proportional below the banner without moving horizontal frames", () => {
    const value = campaign();
    value.pageArtworks = {
      cover: [
        {
          id: "banner",
          layoutRole: "banner",
          type: "image",
          x: 0,
          y: 0,
          width: 100,
          height: 40,
        },
      ],
    };
    const source = { x: 5, y: 25, width: 90, height: 30 };
    const fitted = fitCoverBelowBanners(source, value);
    expect(fitted).toMatchObject({ x: 5, y: 41.2, width: 90 });
    expect(fitted.height).toBeCloseTo((30 * (95 - 41.2)) / 70);
    expect(source).toEqual({ x: 5, y: 25, width: 90, height: 30 });
    expect(fitCoverBelowBanners(source, campaign())).toBe(source);
  });
  it("accounts for a rotated banner and rejects unsafe new geometry while preserving legacy artwork", () => {
    const value = campaign();
    const image = createPageBanner("image", value, "cover", { id: "image" });
    image.width = 30;
    image.height = 10;
    image.y = 5;
    image.rotation = 90;
    value.pageArtworks = { cover: [image] };
    expect(pageBannerInset(value, "cover")).toBeCloseTo(23.2);
    expect(
      campaignSchema.safeParse({
        ...value,
        pageArtworks: { cover: [{ ...image, height: 500 }] },
      }).success,
    ).toBe(false);
    expect(
      campaignSchema.safeParse({
        ...value,
        pageArtworks: { cover: [{ ...image, backgroundColor: "url(unsafe)" }] },
      }).success,
    ).toBe(false);
    expect(
      campaignSchema.parse({
        ...value,
        pageArtworks: {
          cover: [{ id: "old", x: -8, y: 95, width: 140, name: "original" }],
        },
      }).pageArtworks?.cover?.[0]?.name,
    ).toBe("original");
  });
  it("preserves full-page image banners with editable overlays and validates overlay inputs", () => {
    const image = createPageBanner("image", campaign(), "cover", {
      id: "banner",
      image: "/photo.png",
    });
    const artwork = {
      ...image,
      height: 100,
      bannerOverlay: {
        type: "gradient",
        color: "#000000",
        endColor: "#ffffff00",
        angle: 180,
        opacity: 0.4,
      },
    };
    const stored = campaignSchema.parse({
      ...campaign(),
      pageArtworks: { cover: [artwork] },
    });
    expect(stored.pageArtworks?.cover?.[0]).toEqual(artwork);
    expect(
      campaignSchema.safeParse({
        ...campaign(),
        pageArtworks: {
          cover: [
            {
              ...artwork,
              bannerOverlay: { ...artwork.bannerOverlay, opacity: 4 },
            },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      campaignSchema.safeParse({
        ...campaign(),
        pageArtworks: {
          cover: [
            {
              ...artwork,
              bannerOverlay: { ...artwork.bannerOverlay, color: "url(unsafe)" },
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
});
