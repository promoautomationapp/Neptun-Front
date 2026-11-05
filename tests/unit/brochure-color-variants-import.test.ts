import { describe, expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import {
  analyzeBrochureRows,
  inferBrochureColumns,
  parseBrochurePosition,
} from "../../src/features/brochure/brochureImport";
import { coverProducts } from "../../src/features/brochure/campaignPages";
import { productColors } from "../../src/features/brochure/colors";
import { buildImagePreparationRequest } from "../../src/features/brochure/imageReview";
import { productImageSearchParams } from "../../src/features/ai/missing-product-images";

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
  it.each([1, "1", "1.0", "1,0", "1.0000000000000001"])(
    "reads %s as the explicit first cover slot 1.0",
    (value) => {
      expect(parseBrochurePosition(value)).toEqual({
        page: 1,
        order: 0,
        label: "1.0",
      });
    },
  );

  it("collapses positioned color choices even when their Pulla cells say Set, keeping all other cover orders", () => {
    const setHeaders = [...headers, "Pulla"];
    const setColumns = {
      ...inferBrochureColumns(setHeaders),
      codeCol: 0,
      priceCol: 3,
    };
    const tv: Product = {
      code: "TV55",
      name: "TV LED BEKO 55BHU7800",
      brand: "BEKO",
      regular: 399,
    };
    const speaker: Product = {
      code: "JBL-GO4",
      name: "JBL GO 4 BLACK",
      brand: "JBL",
      regular: 59,
    };
    const result = analyzeBrochureRows(
      [
        ...phones.map((phone) => [...row(phone), "Set"]),
        [...row(tv, "1.2"), ""],
        [...row(speaker, "1.3", 39), ""],
      ],
      setColumns,
      [...phones, tv, speaker],
    );
    expect(result.products).toHaveLength(3);
    expect(result.products[0]).toMatchObject({
      code: "84066096",
      name: "A37 5G 6/128",
      sale: "299",
      regular: 449,
    });
    expect(result.products[0]?.bundleProducts).toBeUndefined();
    expect(productColors(result.products[0]!)).toHaveLength(4);
    expect(
      coverProducts({
        id: "set-colors",
        name: "Set colors",
        products: result.products,
      }).map((product) => [product.code, product.brochureOrder]),
    ).toEqual([
      ["84066096", 1],
      ["TV55", 2],
      ["JBL-GO4", 3],
    ]);
    expect(result.skipped).toEqual([]);
    expect(result.matchedRows).toBe(6);
  });

  it("keeps unpositioned explicit Set members simultaneous, including matching models", () => {
    const setHeaders = [...headers, "Pulla"];
    const setColumns = {
      ...inferBrochureColumns(setHeaders),
      codeCol: 0,
      priceCol: 3,
    };
    const result = analyzeBrochureRows(
      phones.slice(0, 2).map((phone) => [...row(phone, ""), "Set"]),
      setColumns,
      phones,
    );
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.bundleProducts).toHaveLength(2);
    expect(result.products[0]?.brochureVariants).toBeUndefined();
    expect(result.skipped).toEqual([]);
  });

  it("collapses color choices inside a positioned mixed Set before adding distinct model prices", () => {
    const setHeaders = [...headers, "Pulla"];
    const setColumns = {
      ...inferBrochureColumns(setHeaders),
      codeCol: 0,
      priceCol: 3,
    };
    const tv: Product = { code: "TV55", name: "BEKO TV 55", regular: 399 };
    const source = [tv, ...phones];
    const result = analyzeBrochureRows(
      source.map((product) => [...row(product), "Set"]),
      setColumns,
      source,
    );
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.bundleProducts).toHaveLength(2);
    expect(
      result.products[0]?.bundleProducts?.[1]?.brochureVariants,
    ).toHaveLength(4);
    expect(result.products[0]?.regular).toBe(848);
    expect(result.products[0]?.sale).toBe("299");
    expect(result.skipped).toEqual([]);
  });

  it("retains the real workbook's 1.0 TV separately from the four A37 rows at 1.1", () => {
    const worksheetHeaders = [
      "No.",
      "Main Cat",
      "Code",
      "Description",
      "Technical Specifications for the leaflet ( With Bold & red main Specs)",
      "Pulla",
      "Brochure Position",
      "Brands",
      "Purchased From ",
      "Vitet e Garancionit",
      "Cost With VAT When proposal for Leafet is done",
      "Cost With VAT 1 Day Before Leaflet Starts (to be updated)",
      "Index",
      "Support From Supplier",
      "Stock In the moment that models are proposed",
      "Goods On The Way ( what is send as an order + what is on the way)",
      "Stock In The System 1 Day Before Leaflet Starts",
      "Retail Price Before Promo",
      "Promo Price",
    ];
    const worksheetColumns = {
      ...inferBrochureColumns(worksheetHeaders),
      codeCol: 2,
      priceCol: 18,
    };
    const phoneDetails =
      '* Android 16\n* Ekran: 6.7" (Super AMOLED + 120Hz)\n* Kamera: Triple: 50MP+8MP+5MP,Front: 12MP\n*  128 GB, 6 GB RAM\n* Bateria 5000 mAh';
    const tvRow = [
      "",
      "",
      "84066698",
      "TV LED BEKO 55BHU7800",
      "Google TV, 4K Ultra HD, Quad Core Processor, HDR10, Dolby Vision, Wi-Fi, DVB-T/C/T2/S2",
      "GOOGLE TV",
      1,
      "BEKO",
      "ARCELIK",
      "2",
      262.1,
      262.1,
      "",
      27,
      71,
      "",
      "",
      399,
      299,
    ];
    const costs = [307.1, 286, 294.4, 286];
    const stock = [4, 95, 1, 0];
    const rows = [
      tvRow,
      ...phones.map((phone, index) => [
        "",
        "",
        phone.code,
        phone.name,
        phoneDetails,
        "",
        "1.1",
        "Samsung",
        "Alba Trade",
        "2",
        costs[index],
        costs[index],
        "0",
        "",
        stock[index],
        index === 3 ? 10 : "",
        "",
        449,
        299,
      ]),
    ];
    const result = analyzeBrochureRows(rows, worksheetColumns, [], 12);
    expect(result.products).toHaveLength(2);
    expect(result.products[0]).toMatchObject({
      code: "84066698",
      brochurePage: 1,
      brochureOrder: 0,
      regular: 399,
      sale: "299",
    });
    expect(result.products[0]?.bundleProducts).toBeUndefined();
    expect(result.products[1]).toMatchObject({
      code: "84066096",
      name: "A37 5G 6/128",
      brochurePage: 1,
      brochureOrder: 1,
      regular: 449,
      sale: "299",
    });
    expect(result.products[1]?.brochureVariants).toHaveLength(4);
    expect(
      coverProducts({
        id: "workbook",
        name: "Workbook",
        products: result.products,
      }),
    ).toHaveLength(2);
    expect(result.skipped).toEqual([]);
    expect(result.matchedRows).toBe(5);
    // Changing the TV to the exact same slot creates one collaboration offer,
    // with a single phone member representing the four color choices.
    const sameSlot = rows.map((source) => [...source]);
    sameSlot[0]![6] = "1.1";
    const combined = analyzeBrochureRows(sameSlot, worksheetColumns, [], 12);
    expect(combined.products).toHaveLength(1);
    expect(combined.products[0]?.bundleProducts).toHaveLength(2);
    expect(
      combined.products[0]?.bundleProducts?.[1]?.brochureVariants,
    ).toHaveLength(4);
    expect(combined.products[0]?.regular).toBe(848);
    expect(combined.skipped).toEqual([]);
  });

  it("does not infer a page column solely from unlabeled whole-number facts", () => {
    const numericRows = [
      [1, 5],
      [2, 6],
      [3, 7],
      [4, 8],
    ];
    expect(
      inferBrochureColumns(["Available", "Count"], numericRows).positionCol,
    ).toBe(-1);
  });

  it("imports the four A37 color SKUs as one phone and four swatches without summing their prices", () => {
    const rows = phones.map((phone) => row(phone));
    const before = structuredClone({ rows, phones });
    const result = analyzeBrochureRows(rows, columns, phones, 20);

    expect(result.products).toHaveLength(1);
    const phone = result.products[0]!;
    expect(phone).toMatchObject({
      code: "84066096",
      name: "A37 5G 6/128",
      brochurePage: 1,
      brochureOrder: 1,
      sale: "299",
      regular: 449,
      image: "/84066096.png",
    });
    expect(phone.bundleProducts).toBeUndefined();
    expect(phone.brochureVariants?.[0]).toMatchObject({
      code: "84066096",
      name: "A37 5G 6/128 GREEN",
    });
    expect(buildImagePreparationRequest(phone).name).toBe("A37 5G 6/128 GREEN");
    expect(productImageSearchParams(phone).name).toBe("A37 5G 6/128 GREEN");
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

  it("keeps a brand's color word while removing the model's finish", () => {
    const products = ["BLACK", "WHITE"].map((finish, index) => ({
      code: `TOASTER-${index}`,
      name: `BLACK+DECKER TOASTER BX10 ${finish}`,
      brand: "BLACK+DECKER",
      regular: 59,
    }));
    const result = analyzeBrochureRows(
      products.map((product) => row(product, "2.1", 39)),
      columns,
      products,
    );
    expect(result.products[0]?.name).toBe("BLACK+DECKER TOASTER BX10");
    expect(result.products[0]?.code).toBe("TOASTER-0");
    expect(result.products[0]?.brochureVariants).toHaveLength(2);
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
