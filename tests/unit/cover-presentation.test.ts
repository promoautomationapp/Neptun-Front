import { it as test } from "vitest";
import type { Campaign } from "../../src/domain/models";
import assert from "node:assert/strict";
import {
  coverTextColor,
  coverMessageVisible,
  featureCoverProduct,
  makeCoverImageLayer,
} from "../../src/features/brochure/coverPresentation";
import { coverProductPlacement } from "../../src/features/brochure/coverElements";
import { coverProducts } from "../../src/features/brochure/campaignPages";
import { referencePriceDesignFor } from "../../src/features/brochure/priceDesign";
import { pageBackgroundColor } from "../../src/features/brochure/pageBackground";
const campaign = (): Campaign => ({
  id: "cover",
  name: "Cover",
  showCoverHeadline: false,
  products: [
    { code: "one", name: "TV one" },
    { code: "two", name: "TV two" },
    { code: "three", name: "TV three" },
    { code: "inside", name: "Inside product" },
  ],
});
test("cover band and optional message are off until selected, with white text defaults", () => {
  const value = campaign();
  assert.equal(coverProducts(value).length, 3);
  assert.equal(coverMessageVisible(value), false);
  assert.equal(coverTextColor(value, "coverMessageColor"), "#ffffff");
  assert.equal(
    coverTextColor({ coverMessageColor: "#aa2211" }, "coverMessageColor"),
    "#aa2211",
  );
});
test("any of three cover offers can fill the banner space without overlapping neighbors", () => {
  const value = campaign();
  value.coverElementPlacements = {
    logo: { x: 10 },
    "product-one": { width: 80 },
  };
  featureCoverProduct(value, "three");
  assert.equal(value.showCoverBand, false);
  assert.deepEqual(value.coverElementPlacements, { logo: { x: 10 } });
  const frames = [0, 1, 2].map((index) =>
    coverProductPlacement(value, index, 3),
  );
  assert.equal(frames[2]!.width, 92);
  assert.ok(frames[2]!.y < 25);
  assert.ok(frames[2]!.y + frames[2]!.height < frames[0]!.y);
  assert.ok(frames[0]!.x + frames[0]!.width < frames[1]!.x);
  value.showCoverMessage = true;
  assert.ok(coverProductPlacement(value, 2, 3).y >= 24);
});
test("a cover photo becomes a saved editable image layer without losing its image or crop", () => {
  const value = {
    ...campaign(),
    coverBackgroundImage: "/photo.png",
    pageArtworks: {
      cover: [
        {
          id: "logo",
          type: "image",
          image: "/logo.png",
          x: 5,
          y: 5,
          width: 25,
        },
      ],
    },
  };
  assert.equal(makeCoverImageLayer(value, "photo"), true);
  assert.equal(value.coverBackgroundImage, "");
  assert.equal(value.pageArtworks.cover.length, 2);
  assert.deepEqual(value.pageArtworks.cover[1], {
    id: "photo",
    type: "image",
    name: "Cover photo",
    image: "/photo.png",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    imageFit: "cover",
    opacity: 1,
    zIndex: 1,
  });
});
test("gray inside pages select the blue price artwork while the default cover stays blue with red prices", () => {
  const value = {
    ...campaign(),
    theme: "light",
    productBackgroundColor: "#f1f2f4",
  };
  assert.equal(pageBackgroundColor(value, "cover"), "#1c4075");
  assert.equal(referencePriceDesignFor(value.products[0]!, value), "red");
  assert.equal(referencePriceDesignFor(value.products[3]!, value), "blue");
  value.coverBackgroundColor = "#f1f2f4";
  assert.equal(referencePriceDesignFor(value.products[0]!, value), "blue");
});

test("default text adapts to an explicitly light cover while manual white remains available", () => {
  const value = { ...campaign(), coverBackgroundColor: "#f1f2f4", coverMessageColor: "#ffffff" };
  assert.equal(coverTextColor(value, "coverMessageColor"), "#1c4075");
  assert.equal(coverTextColor({ ...value, coverTextColorOverrides: { coverMessageColor: true } }, "coverMessageColor"), "#ffffff");
});
