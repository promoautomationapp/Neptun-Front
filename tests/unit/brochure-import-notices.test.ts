import { describe, expect, it } from "vitest";
import type { BrochureImportWarning, Product } from "../../src/domain/models";
import {
  analyzeBrochureRows,
  inferBrochureColumns,
} from "../../src/features/brochure/brochureImport";
import { brochureImportNotices } from "../../src/features/brochure/brochureImportWarnings";

const headers = [
  "Code",
  "Product name",
  "Brochure position",
  "Promo price",
  "Retail price before promo",
  "Color",
  "Pulla",
];
const columns = { ...inferBrochureColumns(headers), codeCol: 0, priceCol: 3 };
const catalog: Product[] = [
  { code: "TV", name: "Beko TV 65 inch", brand: "BEKO", regular: 549 },
  {
    code: "84066096",
    name: "A37 5G 6/128 GREEN",
    brand: "SAMSUNG",
    regular: 449,
  },
  {
    code: "84066097",
    name: "A37 5G 6/128 GREY",
    brand: "SAMSUNG",
    regular: 449,
  },
  { code: "SPEAKER", name: "Sony soundbar", brand: "SONY", regular: 399 },
];
const oldPhoneNotice: BrochureImportWarning = {
  position: "1.1",
  row: 13,
  code: "84066096",
  name: "A37 5G 6/128 GREEN",
  message: "Check brochure position 1.1: different products share this order.",
};

describe("shared brochure positions are stable order information", () => {
  it("keeps every distinct offer and price in Excel order, with one informational note per shared position", () => {
    const rows = [
      ["TV", "Beko TV 65 inch", "1.1", 399],
      ["84066096", "A37 5G 6/128 GREEN", "1.1", 299],
      ["SPEAKER", "Sony soundbar", "1.1", 249],
    ];
    const before = structuredClone({ rows, catalog });
    const result = analyzeBrochureRows(rows, columns, catalog, 12);
    expect(
      result.products.map(({ code, sale, brochurePage, brochureOrder }) => ({
        code,
        sale,
        brochurePage,
        brochureOrder,
      })),
    ).toEqual([
      { code: "TV", sale: "399", brochurePage: 1, brochureOrder: 1 },
      { code: "84066096", sale: "299", brochurePage: 1, brochureOrder: 1 },
      { code: "SPEAKER", sale: "249", brochurePage: 1, brochureOrder: 1 },
    ]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      kind: "shared-order",
      severity: "info",
      position: "1.1",
      relatedRows: [12, 13, 14],
      relatedCodes: ["TV", "84066096", "SPEAKER"],
    });
    expect(result.skipped).toEqual([]);
    expect(result.matchedRows).toBe(3);
    expect({ rows, catalog }).toEqual(before);
  });

  it("still merges equal-price model color variants without a shared-order notice", () => {
    const result = analyzeBrochureRows(
      [
        ["84066096", "A37 5G 6/128 GREEN", "1.1", 299, "", "GREEN"],
        ["84066097", "A37 5G 6/128 GREY", "1.1", 299, "", "GREY"],
      ],
      columns,
      catalog,
    );
    expect(result.products).toHaveLength(1);
    expect(
      result.products[0]!.brochureVariants?.map((variant) => variant.code),
    ).toEqual(["84066096", "84066097"]);
    expect(result.warnings).toEqual([]);
  });

  it("keeps conflicting positions within a Set as an actionable warning and preserves all members", () => {
    const result = analyzeBrochureRows(
      [
        ["TV", "Beko TV 65 inch", "2.1", 599, "", "", "Set"],
        ["SPEAKER", "Sony soundbar", "3.1", "", "", "", "Set"],
      ],
      columns,
      catalog,
      20,
    );
    expect(result.products).toHaveLength(1);
    expect(
      result.products[0]!.bundleProducts?.map((product) => product.code),
    ).toEqual(["TV", "SPEAKER"]);
    expect(result.products[0]).toMatchObject({
      brochurePage: 2,
      brochureOrder: 1,
      sale: "599",
    });
    expect(result.warnings[0]).toMatchObject({
      kind: "set-position-conflict",
      severity: "warning",
      relatedRows: [20, 21],
      positions: ["2.1", "3.1"],
    });
    expect(
      brochureImportNotices(result.warnings, result.products)[0]!.severity,
    ).toBe("warning");
  });

  it("recognizes old shared-order messages as information and hides them after an offer moves or its order changes", () => {
    const products: Product[] = [
      { ...catalog[0]!, brochurePage: 1, brochureOrder: 1 },
      { ...catalog[1]!, brochurePage: 1, brochureOrder: 1 },
    ];
    const before = structuredClone(products);
    const current = brochureImportNotices(
      [oldPhoneNotice, oldPhoneNotice],
      products,
    );
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({
      noticeKind: "shared-order",
      severity: "info",
      page: 1,
      order: 1,
    });
    expect(current[0]!.offers.map((product) => product.code)).toEqual([
      "TV",
      "84066096",
    ]);
    expect(
      brochureImportNotices(
        [oldPhoneNotice],
        [
          products[0]!,
          { ...products[1]!, brochurePage: 2, brochureOrder: undefined },
        ],
      ),
    ).toEqual([]);
    expect(
      brochureImportNotices(
        [oldPhoneNotice],
        [products[0]!, { ...products[1]!, brochureOrder: 2 }],
      ),
    ).toEqual([]);
    expect(brochureImportNotices([oldPhoneNotice], [products[0]!])).toEqual([]);
    expect(products).toEqual(before);
  });
});
