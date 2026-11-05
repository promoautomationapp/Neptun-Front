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

describe("shared brochure positions are one collaboration offer", () => {
  it("keeps separately priced position rows instead of choosing a shared price or losing the products", () => {
    const rows = [
      ["TV", "Beko TV 65 inch", "1.1", 399],
      ["84066096", "A37 5G 6/128 GREEN", "1.1", 299],
      ["SPEAKER", "Sony soundbar", "1.1", 249],
    ];
    const before = structuredClone({ rows, catalog });
    const result = analyzeBrochureRows(rows, columns, catalog, 12);
    expect(
      result.products.map((product) => [product.code, product.sale]),
    ).toEqual([
      ["TV", "399"],
      ["84066096", "299"],
      ["SPEAKER", "249"],
    ]);
    expect(result.products.every((product) => !product.bundleProducts)).toBe(
      true,
    );
    expect(result.matchedRows).toBe(3);
    expect(result.skipped).toEqual([]);
    expect({ rows, catalog }).toEqual(before);
  });
  it("groups mixed products at one page.order with editable member facts and one populated or repeated shared price", () => {
    for (const secondPrice of ["", 599]) {
      const result = analyzeBrochureRows(
        [
          ["TV", "Beko TV 65 inch", "2.3", 599],
          ["SPEAKER", "Sony soundbar", "2.3", secondPrice],
        ],
        columns,
        catalog,
      );
      expect(result.products).toHaveLength(1);
      expect(result.products[0]).toMatchObject({
        sale: "599",
        brochurePage: 2,
        brochureOrder: 3,
        regular: 948,
        bundleCodes: ["TV", "SPEAKER"],
      });
      expect(
        result.products[0]!.bundleProducts?.map((product) => product.name),
      ).toEqual(["Beko TV 65 inch", "Sony soundbar"]);
      expect(result.matchedRows).toBe(2);
      expect(result.skipped).toEqual([]);
    }
  });

  it("uses page first and order second, groups nonadjacent matching slots and preserves each member's imported details", () => {
    const detailedHeaders = [...headers, "Product details"];
    const detailedColumns = {
      ...inferBrochureColumns(detailedHeaders),
      codeCol: 0,
      priceCol: 3,
    };
    const rows = [
      ["TV", "Screen package", "2.3", 599, 600, "", "", "Google TV\n65 inch"],
      ["84066096", "A37 5G 6/128 GREEN", "2.2", 299],
      [
        "SPEAKER",
        "Sound package",
        "2.3",
        "",
        400,
        "",
        "",
        "Dolby Audio\n300 W",
      ],
      ["TV", "Beko TV 65 inch", "3.2", 399],
    ];
    const before = structuredClone({ rows, catalog });
    const result = analyzeBrochureRows(rows, detailedColumns, catalog);
    expect(
      result.products.map(({ brochurePage, brochureOrder }) => [
        brochurePage,
        brochureOrder,
      ]),
    ).toEqual([
      [2, 2],
      [2, 3],
      [3, 2],
    ]);
    const mixed = result.products[1]!;
    expect(mixed).toMatchObject({
      sale: "599",
      regular: 1000,
      setSourceRows: [2, 4],
    });
    expect(mixed.bundleProducts).toMatchObject([
      {
        code: "TV",
        name: "Screen package",
        regular: 600,
        brochureDetails: ["Google TV", "65 inch"],
      },
      {
        code: "SPEAKER",
        name: "Sound package",
        regular: 400,
        brochureDetails: ["Dolby Audio", "300 W"],
      },
    ]);
    mixed.bundleProducts![0]!.name = "Edited screen";
    mixed.bundleProducts![0]!.brochureDetails = ["Edited detail"];
    expect(mixed.bundleProducts![1]!.name).toBe("Sound package");
    expect({ rows, catalog }).toEqual(before);
    expect(result.skipped).toEqual([]);
    expect(result.matchedRows).toBe(4);
  });

  it("groups distinct color SKUs at the same exact position as one editable product with color choices", () => {
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
    expect(result.products[0]!.bundleProducts).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it("keeps repeated source SKUs out of mixed members and does not invent a bundle from a renamed duplicate", () => {
    const duplicate = ["TV", "Beko TV 65 inch", "2.3", 599];
    const mixed = analyzeBrochureRows(
      [duplicate, duplicate, ["SPEAKER", "Sony soundbar", "2.3", 599]],
      columns,
      catalog,
    );
    expect(mixed.products).toHaveLength(1);
    expect(mixed.products[0]!.bundleCodes).toEqual(["TV", "SPEAKER"]);
    expect(mixed.products[0]!.bundleProducts).toHaveLength(2);
    expect(mixed.products[0]!.sale).toBe("599");
    expect(mixed.matchedRows).toBe(3);
    expect(mixed.skipped).toEqual([]);
    const renamed = analyzeBrochureRows(
      [duplicate, ["TV", "Screen with a different imported name", "2.3", 599]],
      columns,
      catalog,
    );
    expect(renamed.products.every((product) => !product.bundleProducts)).toBe(
      true,
    );
    expect(renamed.skipped).toEqual([]);
  });

  it("honors different positions over Set labels, keeping missing prices editable", () => {
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
    expect(result.products[0]).toMatchObject({
      code: "TV",
      brochurePage: 2,
      brochureOrder: 1,
      sale: "599",
    });
    expect(result.incompleteProducts).toHaveLength(1);
    expect(result.incompleteProducts[0]).toMatchObject({
      code: "SPEAKER",
      brochurePage: 3,
      brochureOrder: 1,
    });
    expect(result.products[0]!.bundleProducts).toBeUndefined();
    expect(result.warnings).toEqual([]);
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
