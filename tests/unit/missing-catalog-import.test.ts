import { describe, expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import { analyzeImportRows } from "../../src/features/brochure/importAnalysis";
import {
  analyzeBrochureRows,
  inferBrochureColumns,
} from "../../src/features/brochure/brochureImport";
import { inferExcelProductColumns } from "../../src/features/brochure/excelProducts";

const catalog: Product[] = [
  {
    code: "OVEN1",
    name: "Beko Oven",
    brand: "Beko",
    regular: 300,
    image: "/oven.png",
    specs: { Capacity: "65 L" },
  },
];
const headers = [
  "SKU",
  "Regular price",
  "Sale price",
  "Name",
  "Details",
  "Brand",
  "Category",
  "Warranty",
  "Pulla",
  "Fuqia",
  "Image URL",
  "Brochure position",
];
const extras = inferExcelProductColumns(headers);
const columns = { ...inferBrochureColumns(headers), codeCol: 0, priceCol: 2 };
const prices = (rows: unknown[][]) =>
  analyzeImportRows(rows, 0, 2, catalog, 7, 1, 8, extras);

describe("Excel offers absent from the catalog", () => {
  it("keeps a missing model slash suffix intact while recognizing multiple missing model codes", () => {
    const result = analyzeImportRows(
      [
        ["AKT8090/NE", 79],
        ["AB123 CD456", 199],
        ["123456/123457", 299],
      ],
      0,
      1,
      [],
    );
    expect(result.withoutRegular).toHaveLength(3);
    expect(result.withoutRegular[0]).toMatchObject({
      code: "AKT8090/NE",
      missingCatalogCodes: ["AKT8090/NE"],
    });
    expect(result.withoutRegular[0]?.bundleProducts).toBeUndefined();
    expect(result.withoutRegular[1]?.bundleCodes).toEqual(["AB123", "CD456"]);
    expect(result.withoutRegular[2]?.bundleCodes).toEqual(["123456", "123457"]);
  });
  it("retains a missing-catalog warning when a color variant joins an existing catalog family", () => {
    const known: Product = {
      code: "PHONE-BLACK",
      name: "SAMSUNG GALAXY A17 black",
      regular: 199,
    };
    const result = analyzeBrochureRows(
      [
        [
          "PHONE-BLACK",
          199,
          149,
          "SAMSUNG GALAXY A17 black",
          "",
          "SAMSUNG",
          "",
          "",
          "",
          "",
          "",
          "2.1",
        ],
        [
          "PHONE-SILVER",
          199,
          149,
          "SAMSUNG GALAXY A17 silver",
          "",
          "SAMSUNG",
          "",
          "",
          "",
          "",
          "",
          "2.1",
        ],
      ],
      columns,
      [known],
    );
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      catalogMissing: true,
      missingCatalogCodes: ["PHONE-SILVER"],
    });
    expect(result.products[0]?.brochureVariants).toHaveLength(2);
  });
  it("keeps the supplied name, all editable facts, prices, photo and Excel provenance", () => {
    const row = [
      "MISSING860",
      120,
      89,
      "New toaster 860W",
      "Capacity: 2 slices\nColor: silver",
      "NEW BRAND",
      "Toaster",
      "2 years",
      "",
      "860 W",
      "https://example.com/toaster.png",
    ];
    const result = prices([row]);
    expect(result.skipped).toEqual([]);
    expect(result.discounted).toHaveLength(1);
    expect(result.missingCatalog).toEqual(result.discounted);
    expect(result.discounted[0]).toMatchObject({
      code: "MISSING860",
      name: "New toaster 860W",
      brand: "NEW BRAND",
      category: "Toaster",
      warranty: "2 years",
      regular: 120,
      sale: "89",
      image: "https://example.com/toaster.png",
      catalogMissing: true,
      missingCatalogCodes: ["MISSING860"],
      specs: { Fuqia: "860 W", Capacity: "2 slices", Color: "silver" },
      brochureDetails: ["Capacity: 2 slices", "Color: silver"],
      excelSource: {
        row: 7,
        cells: {
          SKU: "MISSING860",
          "Regular price": "120",
          "Sale price": "89",
          Name: "New toaster 860W",
        },
      },
    });
    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.specs).toEqual({ Capacity: "65 L" });
  });

  it("accepts an unknown code with a valid sale even without name/details or a regular price", () => {
    const result = analyzeImportRows([["UNKNOWN", "99.99"]], 0, 1, catalog);
    expect(result.withoutRegular).toHaveLength(1);
    expect(result.withoutRegular[0]).toMatchObject({
      code: "UNKNOWN",
      name: "UNKNOWN",
      sale: "99.99",
      regular: null,
      catalogMissing: true,
      confirmedAboveRegular: false,
    });
    expect(result.higher).toEqual([]);
    expect(result.discounted).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("uses mapped Excel facts over catalog values even when the sale equals the regular price", () => {
    const result = prices([
      [
        "OVEN1",
        399,
        399,
        "Edited oven name",
        "Capacity: 72 L",
        "New brand",
        "Oven",
        "5 years",
      ],
    ]);
    expect(result.discounted[0]).toMatchObject({
      name: "Edited oven name",
      brand: "New brand",
      regular: 399,
      sale: "399",
      specs: { Capacity: "72 L" },
      image: "/oven.png",
    });
    expect(result.unchanged).toEqual([]);
    expect(result.missingCatalog).toEqual([]);
    expect(catalog[0]?.name).toBe("Beko Oven");
  });

  it("includes missing products in a positioned or automatically placed brochure without fabricating regular prices", () => {
    const result = analyzeBrochureRows(
      [
        ["NEW1", "", 149, "New appliance", "Capacity: 8 KG", "Beko"],
        [
          "NEW2",
          100,
          79,
          "Another appliance",
          "",
          "Beko",
          "",
          "",
          "",
          "",
          "",
          "3.2",
        ],
      ],
      columns,
      catalog,
    );
    expect(result.products).toHaveLength(2);
    expect(result.skipped).toEqual([]);
    expect(
      result.products.find((product) => product.code === "NEW1"),
    ).toMatchObject({
      regular: null,
      sale: "149",
      name: "New appliance",
      catalogMissing: true,
      confirmedAboveRegular: false,
    });
    expect(
      result.products.find((product) => product.code === "NEW2"),
    ).toMatchObject({
      regular: 100,
      sale: "79",
      brochurePage: 3,
      brochureOrder: 2,
      catalogMissing: true,
    });
  });

  it("keeps a mixed existing/missing Set intact, with one shared price and member facts", () => {
    const rows = [
      ["OVEN1", "", 499, "Beko Oven", "Capacity: 72 L", "Beko", "", "", "Set"],
      [
        "DISH2",
        "",
        "",
        "Beko Dishwasher",
        "14 sets\n8 programs",
        "Beko",
        "",
        "",
        "set",
      ],
    ];
    const ordinary = prices(rows);
    const positioned = analyzeBrochureRows(rows, columns, catalog);
    for (const offer of [ordinary.withoutRegular[0], positioned.products[0]]) {
      expect(offer).toMatchObject({
        sale: "499",
        regular: null,
        catalogMissing: true,
        missingCatalogCodes: ["DISH2"],
      });
      expect(offer?.bundleProducts).toHaveLength(2);
      expect(
        offer?.bundleProducts?.find((product) => product.code === "DISH2"),
      ).toMatchObject({
        name: "Beko Dishwasher",
        brochureDetails: ["14 sets", "8 programs"],
        regular: null,
        catalogMissing: true,
      });
    }
    expect(ordinary.skipped).toEqual([]);
    expect(positioned.matchedRows).toBe(2);
  });

  it("preserves a multi-code-cell offer with missing members and uses a supplied regular price once", () => {
    const rows = [
      [
        "OVEN1 + NEW2 + NEW3",
        899,
        699,
        "Kitchen offer",
        "5 years warranty",
        "Beko",
      ],
    ];
    for (const offer of [
      prices(rows).discounted[0],
      analyzeBrochureRows(rows, columns, catalog).products[0],
    ]) {
      expect(offer).toMatchObject({
        name: "Kitchen offer",
        regular: 899,
        sale: "699",
        catalogMissing: true,
      });
      expect(offer?.missingCatalogCodes?.sort()).toEqual(["NEW2", "NEW3"]);
      expect(offer?.bundleProducts).toHaveLength(3);
      expect(
        offer?.bundleProducts?.find((product) => product.code === "OVEN1")
          ?.name,
      ).toBe("Beko Oven");
      expect(
        offer?.bundleProducts?.find((product) => product.code === "NEW2")
          ?.regular,
      ).toBeNull();
    }
  });

  it("continues rejecting missing/invalid prices and conflicting Set prices instead of silently replacing them", () => {
    const result = prices([
      ["UNKNOWN1", "", -20, "Unknown"],
      ["UNKNOWN2", "", 99, "Two", "", "", "", "", "Set"],
      ["UNKNOWN3", "", 199, "Three", "", "", "", "", "Set"],
    ]);
    expect(result.discounted).toEqual([]);
    expect(result.withoutRegular).toEqual([]);
    expect(result.skipped).toHaveLength(3);
    expect(result.skipped[0]?.reason).toBe("Invalid sale price");
    expect(result.skipped[1]?.reason).toMatch(
      /Conflicting shared Set sale prices/,
    );
  });

  it("does not create missing-catalog offers for repeated table headings or totals", () => {
    const result = analyzeImportRows(
      [
        ["SKU", 99],
        ["Subtotal", 500],
        ["Beko", 99],
        ["", 99],
      ],
      0,
      1,
      catalog,
    );
    expect(result.withoutRegular).toEqual([]);
    expect(result.ignored).toBe(3);
    expect(result.skipped[0]?.reason).toBe("Missing code");
  });
});
