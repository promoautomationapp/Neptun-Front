import { describe, expect, it } from "vitest";
import { blackFridaySourceImage } from "../../src/features/brochure/blackFridaySourceImages";
import {
  excelRowProduct,
  inferExcelProductColumns,
} from "../../src/features/brochure/excelProducts";
import {
  analyzeBrochureRows,
  inferBrochureColumns,
} from "../../src/features/brochure/brochureImport";
import { needsImagePreparation } from "../../src/features/brochure/imageReview";
import { otherScreenInches } from "../../src/features/brochure/tvSpecs";
import { isMobilePhone } from "../../src/features/brochure/productTypes";

const path = "/brochure-presets/black-friday/images/p04-im1.webp";
const headers = [
  "Code",
  "Description",
  "Details",
  "Warranty",
  "Image URL",
  "Brochure Position",
  "Promo Price",
  "Retail Price Before Promo",
];
const row = [
  "A26",
  "Galaxy A26 5G",
  "",
  "",
  `https://neptun.promoautomation.app${path}`,
  "4.1",
  199,
  299,
];

describe("supplied Black Friday source images", () => {
  it("trusts only an exact shipped filename on the application origin", () => {
    expect(blackFridaySourceImage(path)).toBe(path);
    expect(
      blackFridaySourceImage(`https://neptun.promoautomation.app${path}`),
    ).toBe(path);
    for (const image of [
      `https://example.com${path}`,
      `https://neptun.promoautomation.app.example.com${path}`,
      `http://neptun.promoautomation.app${path}`,
      `https://user:password@neptun.promoautomation.app${path}`,
      `${path}?image=custom`,
      `${path}#replacement`,
      "/brochure-presets/black-friday/images/not-supplied.webp",
      "/brochure-presets/black-friday/images/p04-im1.png",
      "/brochure-presets/october/images/p04-im1.webp",
      "data:image/webp;base64,test",
      `//neptun.promoautomation.app${path}`,
    ])
      expect(blackFridaySourceImage(image)).toBeNull();
  });

  it("reuses the local photo, source color circles and facts after import/cloning without AI", () => {
    const result = analyzeBrochureRows(
      [row],
      { ...inferBrochureColumns(headers), codeCol: 0, priceCol: 6 },
      [],
    );
    expect(result.products).toHaveLength(1);
    const product = result.products[0]!;
    expect(product).toMatchObject({
      image: path,
      skipAiCutout: true,
      aiReviewedImageSource: path,
      brochurePage: 4,
      brochureOrder: 1,
    });
    expect(product.brochureVariants).toHaveLength(3);
    expect(
      product.brochureVariants?.every((variant) =>
        /^#[\da-f]{6}$/i.test(variant.color!.hex),
      ),
    ).toBe(true);
    expect(product.brochureDetails).toContain("Android 15");
    expect(product.warranty?.toLowerCase()).toContain("garancion");
    expect(needsImagePreparation(structuredClone(product))).toBe(false);
    expect(otherScreenInches(product)).toBe(6.7);
    expect(isMobilePhone(product)).toBe(true);
    expect(isMobilePhone({ name: "Galaxy Tab S11", brand: "Samsung" })).toBe(
      false,
    );
    expect(isMobilePhone({ name: "Galaxy Watch8", brand: "Samsung" })).toBe(
      false,
    );
    expect(product.brandLogo).toContain("/brochure-presets/black-friday/");
  });

  it("keeps explicitly supplied worksheet facts and removes metadata from a replaced catalog photo", () => {
    const changed = [...row];
    changed[2] = "Memory: 128 GB";
    changed[3] = "3 years warranty";
    const product = excelRowProduct(
      changed,
      "A26",
      {
        code: "A26",
        name: "Old catalog name",
        image: "https://example.com/old.webp",
        aiOriginalImage: "https://example.com/original.webp",
        aiInchesEmbedded: true,
        aiCutoutValidated: true,
      },
      inferExcelProductColumns(headers),
      2,
    )!;
    expect(product.brochureDetails).toEqual(["128 GB"]);
    expect(product.specs?.Memory).toBe("128 GB");
    expect(product.warranty).toBe("3 years warranty");
    expect(product.aiOriginalImage).toBeUndefined();
    expect(product.aiInchesEmbedded).toBeUndefined();
    expect(product.skipAiCutout).toBe(true);
    const untrusted = [...row];
    untrusted[4] = `https://example.com${path}`;
    const replacement = excelRowProduct(
      untrusted,
      "A26",
      {
        code: "A26",
        name: "A26",
        image: path,
        skipAiCutout: true,
        aiReviewedImageSource: path,
      },
      inferExcelProductColumns(headers),
      2,
    )!;
    expect(replacement.skipAiCutout).toBe(false);
    expect(needsImagePreparation(replacement)).toBe(true);
  });
});
