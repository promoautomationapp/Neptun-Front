import { describe, expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import {
  analyzeBrochureRows,
  inferBrochureColumns,
} from "../../src/features/brochure/brochureImport";
import { productColors } from "../../src/features/brochure/colors";

// Values copied from Total Neptun in the supplied workbook. Keep the price
// columns at their real indices, including the empty supplier/stock columns.
const headers = [
  "No.",
  "Main Cat",
  "Code",
  "Description",
  "Technical Specifications for the leaflet ( With Bold & red main Specs)",
  "Pulla",
  "Brochure Position",
  "Brands",
  "Purchased From",
  "Vitet e Garancionit",
  ...Array.from({ length: 7 }, () => ""),
  "Retail Price Before Promo",
  "Promo Price",
];
const columns = {
  ...inferBrochureColumns(headers),
  codeCol: 2,
  priceCol: 18,
};

interface SourceRow {
  sheetRow: number;
  code: string;
  name: string;
  details: string;
  position: string;
  brand: string;
  warranty: string;
  regular: number;
  sale: number;
}

const appleDetails = (inches: string) =>
  `* iOS: 26 \n* Ekran: ${inches}" Super Retina XDR OLED 120 Hz\n*  256 GB, 12 GB Ram\n`;
const air: SourceRow[] = [
  [44, "84064914", "IPHONE 17 AIR 256GB SKY BLUE (DEMO)"],
  [45, "84064915", "IPHONE 17 AIR 256GB BLACK"],
  [46, "84064916", "IPHONE 17 AIR 256GB WHITE"],
  [47, "84064917", "IPHONE 17 AIR 256GB LIGHT GOLD"],
  [48, "84064918", "IPHONE 17 AIR 256GB SKY BLUE"],
].map(([sheetRow, code, name]) => ({
  sheetRow: Number(sheetRow),
  code: String(code),
  name: String(name),
  details: appleDetails("6.5"),
  position: "6.3",
  brand: "Apple",
  warranty: "1",
  regular: 1399,
  sale: 1199,
}));
const pro: SourceRow[] = [
  [49, "84064928", "IPHONE 17 PRO 256GB SILVER (DEMO)"],
  [50, "84064929", "IPHONE 17 PRO 256GB DEEP BLUE (DEMO)"],
  [51, "84064930", "IPHONE 17 PRO 256GB COSMIC ORANGE (DEMO)"],
  [52, "84064931", "IPHONE 17 PRO 256GB SILVER"],
  [53, "84064932", "IPHONE 17 PRO 256GB COSMIC ORANGE"],
  [54, "84064933", "IPHONE 17 PRO 256GB DEEP BLUE"],
].map(([sheetRow, code, name]) => ({
  sheetRow: Number(sheetRow),
  code: String(code),
  name: String(name),
  details: appleDetails("6.3"),
  position: "6.4",
  brand: "Apple",
  warranty: "1",
  regular: 1499,
  sale: 1329,
}));
const buds: SourceRow[] = [
  [77, "84064722", "KUFJE SAMSUNG SM-R420NZKAEUC BUDS 3 FE BLACK"],
  [78, "84064723", "KUFJE SAMSUNG SM-R420NZAAEUC BUDS 3 FE GREY"],
].map(([sheetRow, code, name], index) => ({
  sheetRow: Number(sheetRow),
  code: String(code),
  name: String(name),
  details:
    "* Bluetooth: v5.4\n* Sistem me 6 mikrofona\n* Koha e përdorimit: deri në  6 h" +
    (index === 0 ? "\n" : ""),
  position: "10.1",
  brand: "SAMSUNG",
  warranty: "1",
  regular: 149,
  sale: 69,
}));
const watches: SourceRow[] = [
  [79, "84067077", "SMARTWATCH SAMSUNG SM-L350NZKAEUC WATCH 9 44MM BLACK"],
  [80, "84067078", "SMARTWATCH SAMSUNG SM-L350NZSAEUC WATCH 9 44MM SILVER"],
].map(([sheetRow, code, name]) => ({
  sheetRow: Number(sheetRow),
  code: String(code),
  name: String(name),
  details: "",
  position: "10.2",
  brand: "SAMSUNG",
  warranty: "2",
  regular: 439,
  sale: 329,
}));

function cells(source: SourceRow) {
  const values: unknown[] = Array.from({ length: headers.length }, () => "");
  values[2] = source.code;
  values[3] = source.name;
  values[4] = source.details;
  values[6] = source.position;
  values[7] = source.brand;
  values[9] = source.warranty;
  values[17] = source.regular;
  values[18] = source.sale;
  return values;
}
function catalog(source: SourceRow[]): Product[] {
  return source.map((row) => ({
    code: row.code,
    name: row.name,
    brand: row.brand,
    regular: row.regular,
    warranty: row.warranty,
    image: `/${row.code}.png`,
    specs: {
      SKU: row.code,
      EAN: `900${row.code}`,
      "Catalog name": row.name,
      "Technical quality": "standard",
    },
  }));
}
function imported(source: SourceRow[], products = catalog(source)) {
  return analyzeBrochureRows(
    source.map(cells),
    columns,
    products,
    source[0]?.sheetRow,
  );
}
function expectColorOffer(
  source: SourceRow[],
  expectedName: string,
  expectedColors: string[],
) {
  const result = imported(source);
  expect(result.products).toHaveLength(1);
  expect(result.skipped).toEqual([]);
  expect(result.matchedRows).toBe(source.length);
  const offer = result.products[0]!;
  expect(offer).toMatchObject({
    code: source[0]!.code,
    name: expectedName,
    regular: source[0]!.regular,
    sale: String(source[0]!.sale),
  });
  expect(offer.bundleProducts).toBeUndefined();
  expect(offer.bundleCodes).toBeUndefined();
  expect(offer.name).not.toMatch(/\+|\bDEMO\b/i);
  expect(
    offer.brochureVariants?.map(({ code, name }) => ({ code, name })),
  ).toEqual(source.map(({ code, name }) => ({ code, name })));
  expect(productColors(offer).map((color) => color.name)).toEqual(
    expectedColors,
  );
  return offer;
}

describe("Apple and Samsung color families from the supplied workbook", () => {
  it("imports the five iPhone Air SKUs as one phone with four colors, preserving its first SKU and every exact source name", () => {
    expect(columns.regularCol).toBe(17);
    expect(columns.priceCol).toBe(18);
    expectColorOffer(air, "IPHONE 17 AIR 256GB", [
      "sky blue",
      "black",
      "white",
      "light gold",
    ]);
  });

  it("imports all six iPhone Pro retail/DEMO SKUs as one phone and three colors without adding their regular prices", () => {
    expectColorOffer(pro, "IPHONE 17 PRO 256GB", [
      "silver",
      "deep blue",
      "cosmic orange",
    ]);
  });

  it("collapses Samsung Buds color suffixes only within the same SM-R420 and BUDS 3 FE model", () => {
    const result = imported(buds);
    expect(result.products).toHaveLength(1);
    const offer = result.products[0]!;
    expect(offer.code).toBe("84064722");
    expect(offer.name).toMatch(/SM-R420.*BUDS 3 FE/i);
    expect(offer.name).not.toMatch(/\b(?:BLACK|GREY)\b/);
    expect(offer.bundleProducts).toBeUndefined();
    expect(offer.regular).toBe(149);
    expect(offer.sale).toBe("69");
    expect(
      offer.brochureVariants?.map(({ code, name }) => ({ code, name })),
    ).toEqual(buds.map(({ code, name }) => ({ code, name })));
    expect(productColors(offer).map((color) => color.name)).toEqual([
      "black",
      "grey",
    ]);
    expect(result.matchedRows).toBe(2);
    expect(result.skipped).toEqual([]);
  });

  it("collapses Samsung Watch color suffixes within SM-L350 WATCH 9 44MM without losing model, size or source SKUs", () => {
    const result = imported(watches);
    expect(result.products).toHaveLength(1);
    const offer = result.products[0]!;
    expect(offer.code).toBe("84067077");
    expect(offer.name).toMatch(/SM-L350.*WATCH 9 44MM/i);
    expect(offer.name).not.toMatch(/\b(?:BLACK|SILVER)\b/);
    expect(offer.bundleProducts).toBeUndefined();
    expect(offer.regular).toBe(439);
    expect(offer.sale).toBe("329");
    expect(
      offer.brochureVariants?.map(({ code, name }) => ({ code, name })),
    ).toEqual(watches.map(({ code, name }) => ({ code, name })));
    expect(productColors(offer).map((color) => color.name)).toEqual([
      "black",
      "silver",
    ]);
    expect(result.matchedRows).toBe(2);
    expect(result.skipped).toEqual([]);
  });

  it.each([
    "SM base model",
    "marketing generation",
    "capacity",
    "regular price",
    "technical specifications",
    "warranty",
  ])(
    "keeps different %s as distinct members in a shared-position offer",
    (kind) => {
      const source = structuredClone(
        kind === "capacity" ? [air[0]!, air[1]!] : buds,
      );
      const changed = source[1]!;
      if (kind === "SM base model")
        changed.name = changed.name.replace("SM-R420", "SM-R430");
      if (kind === "marketing generation")
        changed.name = changed.name.replace("BUDS 3 FE", "BUDS 4 FE");
      if (kind === "capacity") {
        changed.name = changed.name.replace("256GB", "512GB");
        changed.details = changed.details.replace("256 GB", "512 GB");
      }
      if (kind === "regular price") changed.regular += 20;
      if (kind === "warranty") changed.warranty = "3";
      const products = catalog(source);
      if (kind === "technical specifications")
        products[1]!.specs!["Technical quality"] = "different";
      const result = imported(source, products);
      expect(result.products).toHaveLength(1);
      const members = result.products[0]!.bundleProducts;
      expect(members?.map((product) => product.code)).toEqual(
        source.map((row) => row.code),
      );
      expect(
        members?.every((product) => !product.brochureVariants?.length),
      ).toBe(true);
      expect(result.products[0]!.brochureVariants).toBeUndefined();
      expect(result.matchedRows).toBe(2);
      expect(result.skipped).toEqual([]);
    },
  );

  it("keeps differently priced promotional SKUs as separately priced offers instead of inventing one color price", () => {
    const source = structuredClone(buds);
    source[1]!.sale = 79;
    const result = imported(source);
    expect(result.products.map(({ code, sale }) => ({ code, sale }))).toEqual([
      { code: "84064722", sale: "69" },
      { code: "84064723", sale: "79" },
    ]);
    expect(
      result.products.every(
        (product) =>
          !product.bundleProducts && !product.brochureVariants?.length,
      ),
    ).toBe(true);
    expect(result.matchedRows).toBe(2);
    expect(result.skipped).toEqual([]);
  });
});
