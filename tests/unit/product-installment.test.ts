import { expect, it } from "vitest";
import { productInstallmentAmount } from "../../src/features/brochure/productInstallment";

it("preserves the brochure's supplied monthly figure until its price or count changes", () => {
  const product = {
    code: "BHS510/00",
    name: "BHS510/00",
    sale: 34.99,
    brochureInstallment: { amount: 2.5, count: 12, sale: 34.99 },
  };
  expect(productInstallmentAmount(product, 12)).toBe(2.5);
  expect(productInstallmentAmount({ ...product, sale: 69.99 }, 12)).toBeCloseTo(
    69.99 / 12,
  );
  expect(productInstallmentAmount(product, 24)).toBeCloseTo(34.99 / 24);
});
