import { expect, it } from "vitest";
import { selectImportTable } from "../../src/features/brochure/importAnalysis";
import {
  analyzeBrochureRows,
  inferBrochureColumns,
  sortBrochureProducts,
} from "../../src/features/brochure/brochureImport";
import { coverProducts } from "../../src/features/brochure/campaignPages";

const headers = [
  "Code",
  "Description",
  "Brochure Position",
  "Promo Price",
  "Retail Price Before Promo",
  "Pulla",
];
const catalog = [
  { code: "TV", name: "Samsung TV", regular: 700 },
  { code: "WASHER", name: "Beko washing machine", regular: 500 },
  { code: "AC", name: "Fuego air conditioner", regular: 500 },
  { code: "PHONE-1", name: "Samsung phone green", regular: 450 },
  { code: "PHONE-2", name: "Samsung phone grey", regular: 450 },
];
const first = [
  headers,
  ["TV", "Samsung TV", "1.1", 299, 399],
  ["PHONE-1", "Samsung phone green", "1.2", 299, 449],
  ["PHONE-2", "Samsung phone grey", "1.3", 299, 449],
];
const duplicate = [
  headers,
  ...catalog.map((p) => [p.code, p.name, "1.1", 299, p.regular]),
];
const columns = { ...inferBrochureColumns(headers), codeCol: 0, priceCol: 3 };
it("uses the first brochure sheet instead of a longer duplicate and respects an explicit sheet choice", () => {
  const sheets = [
    { name: "Notes", data: [["Campaign", "November"]] },
    { name: "Total Neptun", data: first },
    { name: "Total Neptun (2)", data: duplicate },
  ];
  expect(selectImportTable(sheets, catalog)?.sheetName).toBe("Total Neptun");
  expect(
    selectImportTable(sheets, catalog, { sheetName: "Total Neptun (2)" })
      ?.sheetName,
  ).toBe("Total Neptun (2)");
});
it("keeps 1.1,1.2,1.3 as three separate cover offers in the imported order", () => {
  const result = analyzeBrochureRows(
    first.slice(1).reverse(),
    columns,
    catalog,
  );
  expect(
    result.products.map((p) => [p.code, p.brochurePage, p.brochureOrder]),
  ).toEqual([
    ["TV", 1, 1],
    ["PHONE-1", 1, 2],
    ["PHONE-2", 1, 3],
  ]);
  expect(result.products.every((p) => !p.bundleProducts)).toBe(true);
  expect(
    coverProducts({ id: "test", name: "Test", products: result.products }).map(
      (p) => p.code,
    ),
  ).toEqual(["TV", "PHONE-1", "PHONE-2"]);
});
it("groups only the exact repeated slot: TV and washer at1.1, separate AC at1.2", () => {
  const result = analyzeBrochureRows(
    [
      ["TV", "Samsung TV", "1.1", 799, 700],
      ["AC", "Fuego air conditioner", "1.2", 399, 500],
      ["WASHER", "Beko washing machine", "1.1", 799, 500],
    ],
    columns,
    catalog,
  );
  expect(result.products).toHaveLength(2);
  expect(result.products[0]).toMatchObject({
    brochurePage: 1,
    brochureOrder: 1,
    bundleCodes: ["TV", "WASHER"],
    sale: "799",
  });
  expect(result.products[1]).toMatchObject({
    code: "AC",
    brochurePage: 1,
    brochureOrder: 2,
  });
  expect(result.products[1]?.bundleProducts).toBeUndefined();
});
it("keeps incomplete rows in their original page/order among complete offers", () => {
  const result = analyzeBrochureRows(
    [
      ["AC", "Fuego air conditioner", "1.3", "", 500],
      ["TV", "Samsung TV", "1.1", 499, 700],
      ["WASHER", "Beko washing machine", "1.2", 399, 500],
    ],
    columns,
    catalog,
  );
  expect(
    sortBrochureProducts([
      ...result.incompleteProducts,
      ...result.products,
    ]).map((p) => p.brochureOrder),
  ).toEqual([1, 2, 3]);
});
