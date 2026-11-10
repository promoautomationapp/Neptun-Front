import { expect, it } from "vitest";
import { blackFridaySampleProducts } from "../../src/features/brochure/blackFridaySourceImages";
import { artworkSaving } from "../../src/features/brochure/priceCardModel";
import { needsImagePreparation } from "../../src/features/brochure/imageReview";
import { splitPages } from "../../src/features/brochure/campaignPages";

it("previews all77 source offers with13 pages, without needing AI or inventing catalog SKUs", () => {
  const products = blackFridaySampleProducts();
  expect(products).toHaveLength(77);
  expect(new Set(products.map((product) => product.code)).size).toBe(77);
  expect(products.filter((product) => product.brochurePage === 1)).toHaveLength(
    2,
  );
  expect(products.every((product) => !needsImagePreparation(product))).toBe(
    true,
  );
  expect(
    splitPages({
      id: "bf-preview",
      name: "BF preview",
      products,
      brochurePresetId: "neptun-black-friday",
      coverProductCodes: products
        .filter((product) => product.brochurePage === 1)
        .map((product) => product.code),
    }),
  ).toHaveLength(11);
});

it("preserves the printed38% source badge until prices or savings mode change", () => {
  const source = blackFridaySampleProducts().find(
    (product) => product.brochurePage === 8 && product.brochureOrder === 9,
  )!;
  expect(source.savingMode).toBe("percentage");
  expect(
    artworkSaving(
      source.regular,
      source.sale,
      source.savingMode,
      source.brochureSavings,
    ),
  ).toEqual({ label: "ZBRITJE", text: "38%" });
  expect(
    artworkSaving(source.regular, 39.99, "percentage", source.brochureSavings)
      ?.text,
  ).toBe("49%");
  expect(
    artworkSaving(source.regular, source.sale, "amount", source.brochureSavings)
      ?.text,
  ).toBe("29.01€");
  const second = blackFridaySampleProducts().find(
    (product) => product.brochurePage === 11 && product.brochureOrder === 10,
  )!;
  expect(
    artworkSaving(
      second.regular,
      second.sale,
      second.savingMode,
      second.brochureSavings,
    )?.text,
  ).toBe("43%");
});
