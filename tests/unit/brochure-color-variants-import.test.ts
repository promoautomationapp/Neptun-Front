import { describe, expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import {
  analyzeBrochureRows,
  inferBrochureColumns,
} from "../../src/features/brochure/brochureImport";
import { productColors } from "../../src/features/brochure/colors";

const headers = [
  "Code",
  "Description",
  "Brochure Position",
  "Promo Price",
  "Retail Price Before Promo",
  "Color",
  "Brand",
];
const columns = { ...inferBrochureColumns(headers), codeCol: 0, priceCol: 3 };
const phones: Product[] = [
  ["84066096", "GREEN"],
  ["84066097", "GREY"],
  ["84066098", "VIOLET"],
  ["84066099", "WHITE"],
].map(([code, color]) => ({
  code: code!,
  name: `A37 5G 6/128 ${color}`,
  brand: "SAMSUNG",
  regular: 449,
  image: `/${code}.png`,
}));
const row = (product: Product, position = "1.1", price = 299) => [
  product.code,
  product.name,
  position,
  price,
  product.regular,
  "",
  product.brand,
];
const members = (products: Product[]) =>
  products.flatMap((product) => product.bundleProducts || [product]);

describe("same-position color choices from Excel", () => {
  it("imports the four A37 color SKUs as one phone and four swatches without summing their prices", () => {
    const rows = phones.map((phone) => row(phone));
    const before = structuredClone({ rows, phones });
    const result = analyzeBrochureRows(rows, columns, phones, 20);

    expect(result.products).toHaveLength(1);
    const phone = result.products[0]!;
    expect(phone).toMatchObject({
      code: "84066096",
      brochurePage: 1,
      brochureOrder: 1,
      sale: "299",
      regular: 449,
      image: "/84066096.png",
    });
    expect(phone.bundleProducts).toBeUndefined();
    expect(phone.brochureVariants?.map((variant) => variant.code)).toEqual(
      phones.map((product) => product.code),
    );
    expect(productColors(phone).map((color) => color.name)).toEqual([
      "green",
      "grey",
      "violet",
      "white",
    ]);
    expect(result.matchedRows).toBe(4);
    expect(result.skipped).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect({ rows, phones }).toEqual(before);
  });

  it("keeps color choices separate when Excel gives them different orders or pages", () => {
    const result = analyzeBrochureRows(
      [row(phones[0]!, "1.1"), row(phones[1]!, "1.2"), row(phones[2]!, "2.1")],
      columns,
      phones,
    );
    expect(
      result.products.map((product) => [
        product.code,
        product.brochurePage,
        product.brochureOrder,
      ]),
    ).toEqual([
      ["84066096", 1, 1],
      ["84066097", 1, 2],
      ["84066098", 2, 1],
    ]);
    expect(
      result.products.every(
        (product) =>
          !product.bundleProducts && !product.brochureVariants?.length,
      ),
    ).toBe(true);
    expect(result.matchedRows).toBe(3);
  });

  it("keeps a TV and one selectable-color phone in a mixed shared offer", () => {
    const tv: Product = {
      code: "TV55",
      name: "TV LED BEKO 55BHU7800",
      brand: "BEKO",
      regular: 549,
    };
    const source = [tv, ...phones];
    const result = analyzeBrochureRows(
      source.map((product) => row(product, "1.1", 599)),
      columns,
      source,
    );
    expect(result.products).toHaveLength(1);
    const offer = result.products[0]!;
    expect(offer.bundleProducts).toHaveLength(2);
    expect(offer.bundleProducts?.[0]?.code).toBe("TV55");
    const phone = offer.bundleProducts![1]!;
    expect(phone.brochureVariants?.map((variant) => variant.code)).toEqual(
      phones.map((product) => product.code),
    );
    expect(productColors(phone)).toHaveLength(4);
    expect(offer.sale).toBe("599");
    expect(offer.regular).toBe(998);
    expect(result.matchedRows).toBe(5);
    expect(result.skipped).toEqual([]);
  });

  it("recognizes color choices for non-phone products too", () => {
    const speakers: Product[] = [
      { code: "JBL-B", name: "JBL GO 4 BLACK", brand: "JBL", regular: 59 },
      { code: "JBL-R", name: "JBL GO 4 RED", brand: "JBL", regular: 59 },
    ];
    const result = analyzeBrochureRows(
      speakers.map((speaker) => row(speaker, "3.2", 39)),
      columns,
      speakers,
    );
    expect(result.products).toHaveLength(1);
    const speaker = result.products[0]!;
    expect(speaker.bundleProducts).toBeUndefined();
    expect(speaker.brochureVariants?.map((variant) => variant.code)).toEqual([
      "JBL-B",
      "JBL-R",
    ]);
    expect(productColors(speaker).map((color) => color.name)).toEqual([
      "black",
      "red",
    ]);
    expect(speaker.regular).toBe(59);
    expect(speaker.sale).toBe("39");
    expect(result.matchedRows).toBe(2);
  });

  it.each([
    ["capacity", { name: "A37 5G 8/256 GREY" }],
    ["model", { name: "A57 5G 6/128 GREY" }],
    ["brand", { brand: "OTHER" }],
    ["regular price", { regular: 499 }],
  ] as const)(
    "does not turn a different %s into an interchangeable color",
    (_kind, change) => {
      const second = { ...phones[1]!, ...change };
      const source = [phones[0]!, second];
      const result = analyzeBrochureRows(
        source.map((product) => row(product)),
        columns,
        source,
      );
      const imported = members(result.products);
      expect(imported.map((product) => product.code)).toEqual(
        source.map((product) => product.code),
      );
      expect(
        imported.every((product) => !product.brochureVariants?.length),
      ).toBe(true);
      expect(result.matchedRows).toBe(2);
      expect(result.skipped).toEqual([]);
    },
  );

  it("preserves separately priced color SKUs rather than inventing one shared price or dropping the rows", () => {
    const result = analyzeBrochureRows(
      [row(phones[0]!, "1.1", 299), row(phones[1]!, "1.1", 319)],
      columns,
      phones,
    );
    expect(
      result.products.map((product) => [product.code, product.sale]),
    ).toEqual([
      ["84066096", "299"],
      ["84066097", "319"],
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

  it("keeps unpriced repeated-position products editable instead of discarding the rows", () => {
    const tv: Product = {
      code: "TV",
      name: "TV LED BEKO 55BHU7800",
      regular: 549,
    };
    const source = [tv, phones[0]!];
    const rows = source.map((product) => {
      const cells: unknown[] = row(product);
      cells[3] = "";
      return cells;
    });
    const result = analyzeBrochureRows(rows, columns, source);
    expect(result.products).toEqual([]);
    expect(
      result.incompleteProducts.map((product) => [
        product.code,
        product.brochurePage,
        product.brochureOrder,
      ]),
    ).toEqual([
      ["TV", 1, 1],
      ["84066096", 1, 1],
    ]);
    expect(result.skipped).toEqual([]);
  });
});
