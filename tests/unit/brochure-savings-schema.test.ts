import { expect, it } from "vitest";
import { campaignSchema } from "../../src/domain/schemas";

it("preserves the printed source savings figure and validates its price sentinels", () => {
  const product = {
    code: "one",
    name: "Offer",
    brochureSavings: {
      value: 38,
      type: "percentage",
      regular: 79.99,
      sale: 49.99,
    },
  };
  const document = { id: "savings", name: "BF", products: [product] };
  expect(campaignSchema.parse(document).products[0]!.brochureSavings).toEqual(
    product.brochureSavings,
  );
  for (const bad of [
    { value: -1 },
    { type: "percent" },
    { regular: 0 },
    { sale: Infinity },
  ])
    expect(
      campaignSchema.safeParse({
        ...document,
        products: [
          {
            ...product,
            brochureSavings: { ...product.brochureSavings, ...bad },
          },
        ],
      }).success,
    ).toBe(false);
});
