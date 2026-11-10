import { describe, expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import {
  createCatalogProductUrlResolver,
  enrichProductUrls,
} from "../../src/features/products/productUrls";
import { resolveExcelOffer } from "../../src/features/brochure/excelProducts";
import { catalogByCode } from "../../src/features/brochure/productBundles";

const oven: Product = {
  code: "84000123",
  name: "FURRE BEKO BBIM12300X",
  brand: "BEKO",
  url: "/categories/furre/FURRE-BEKO-BBIM12300X",
};
const destination =
  "https://www.neptun-ks.com/categories/furre/FURRE-BEKO-BBIM12300X";

describe("canonical product destinations", () => {
  it("uses saved valid destinations and exact catalog SKU without changing offer data", () => {
    const resolve = createCatalogProductUrlResolver([oven]);
    expect(resolve({ code: "84000123.0" })).toBe(destination);
    expect(resolve({ code: oven.code, url: "/products/saved" })).toBe(
      "https://www.neptun-ks.com/products/saved",
    );
    expect(resolve({ code: oven.code, url: "javascript:alert(1)" })).toBe(
      destination,
    );
  });

  it("matches a complete model token and known brand, including a brand in the supplied title", () => {
    const resolve = createCatalogProductUrlResolver([oven]);
    expect(resolve({ code: "BBIM12300X", name: "Furre", brand: "Beko" })).toBe(
      destination,
    );
    expect(resolve({ code: "BBIM12300X", name: "Furre Beko BBIM12300X" })).toBe(
      destination,
    );
    expect(resolve({ code: "BBIM12300", brand: "Beko" })).toBeNull();
    expect(resolve({ code: "BBIM12300X", brand: "Other" })).toBeNull();
    expect(resolve({ code: "BBIM12300X" })).toBeNull();
    expect(
      resolve({ code: "BBIM12301X", name: oven.name, brand: "Beko" }),
    ).toBeNull();
  });

  it("does not choose among variants or silently bypass an exact SKU without a destination", () => {
    const variant = {
      ...oven,
      code: "84000124",
      name: `${oven.name} BLACK`,
      url: "/products/black",
    };
    expect(
      createCatalogProductUrlResolver([oven, variant])({
        code: "BBIM12300X",
        brand: "BEKO",
      }),
    ).toBeNull();
    expect(
      createCatalogProductUrlResolver([oven, { ...oven, url: undefined }])({
        code: oven.code,
      }),
    ).toBeNull();
    const unavailable = { ...oven, url: undefined };
    expect(
      createCatalogProductUrlResolver([unavailable, variant])({
        code: unavailable.code,
        name: variant.name,
        brand: "BEKO",
      }),
    ).toBeNull();
    expect(
      createCatalogProductUrlResolver([
        { ...oven, name: "BEKO 128GB", code: "other" },
      ])({ code: "128GB", brand: "BEKO" }),
    ).toBeNull();
  });

  it("reads an explicitly labeled catalog model without constructing URLs", () => {
    const resolve = createCatalogProductUrlResolver([
      { ...oven, name: "BEKO Built in oven", specs: { Modeli: "BBIM12300X" } },
    ]);
    expect(resolve({ code: "BBIM12300X", brand: "BEKO" })).toBe(destination);
    expect(
      createCatalogProductUrlResolver([{ ...oven, url: undefined }])({
        code: "BBIM12300X",
        brand: "BEKO",
      }),
    ).toBeNull();
  });

  it("does not treat combined memory capacities as evidence of the same model", () => {
    const resolve = createCatalogProductUrlResolver([
      {
        code: "84000999",
        name: "Samsung A57 8GB/256GB",
        brand: "Samsung",
        url: "/products/samsung-a57",
      },
    ]);
    expect(
      resolve({
        code: "unknown",
        name: "Samsung A37 8GB/256GB",
        brand: "Samsung",
      }),
    ).toBeNull();
  });

  it("adds verified destinations to model based Excel imports while keeping source code, facts and prices", () => {
    const result = resolveExcelOffer(
      "BBIM12300X",
      ["BBIM12300X", "Oferta speciale", "Beko", 299],
      catalogByCode([oven]),
      { nameCol: 1, brandCol: 2, regularCol: 3 },
      7,
    );
    expect(result.product).toMatchObject({
      code: "BBIM12300X",
      name: "Oferta speciale",
      brand: "Beko",
      regular: 299,
      url: destination,
      catalogMissing: true,
    });
    expect(oven.url).toBe("/categories/furre/FURRE-BEKO-BBIM12300X");
  });

  it("enriches saved bundle members and color choices without assigning one member's link to the shared offer", () => {
    const original: Product = {
      code: "set",
      name: "Set",
      bundleProducts: [
        {
          code: "BBIM12300X",
          name: "Oven",
          brand: "BEKO",
          brochureVariants: [{ code: oven.code, name: oven.name }],
        },
      ],
    };
    const result = enrichProductUrls(
      original,
      createCatalogProductUrlResolver([oven]),
    );
    expect(result.url).toBeUndefined();
    expect(result.bundleProducts?.[0]?.url).toBe(destination);
    expect(result.bundleProducts?.[0]?.brochureVariants?.[0]?.url).toBe(
      destination,
    );
    expect(original.bundleProducts?.[0]?.url).toBeUndefined();
  });
});
