import { describe, expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import {
  analyzeImportRows,
  selectImportTable,
} from "../../src/features/brochure/importAnalysis";
import {
  analyzeBrochureRows,
  inferBrochureColumns,
} from "../../src/features/brochure/brochureImport";

const catalog: Product[] = [
  {
    code: "A100",
    name: "OVEN",
    brand: "FUEGO",
    regular: 300,
    image: "/oven.png",
  },
  {
    code: "B200",
    name: "HOB",
    brand: "FUEGO",
    regular: 200,
    image: "/hob.png",
  },
  {
    code: "C300",
    name: "HOOD",
    brand: "FUEGO",
    regular: 100,
    image: "/hood.png",
  },
];
const headers = [
  "Product code",
  "Regular price",
  "Sale price",
  "Pulla",
  "Brochure position",
  "Product details",
  "Product name",
];
const columns = {
  codeCol: 0,
  regularCol: 1,
  priceCol: 2,
  setCol: 3,
  positionCol: 4,
  detailsCol: 5,
  nameCol: 6,
  colorCol: -1,
  brandCol: -1,
};
const analyzePrices = (rows: unknown[][]) =>
  analyzeImportRows(rows, 0, 2, catalog, 2, 1, 3);

describe("Excel Pulla=Set shared offers", () => {
  it("detects the Pulla column without changing inferred code and offer-price columns", () => {
    const rows = [
      ["A100", "", 349, "Set"],
      ["B200", "", "", "set"],
    ];
    const table = selectImportTable(
      [
        {
          name: "Offers",
          data: [headers.map((header) => header.toUpperCase()), ...rows],
        },
      ],
      catalog,
    );
    expect(table?.codeCol).toBe(0);
    expect(table?.priceCol).toBe(2);
    expect(table?.setCol).toBe(3);
    expect(
      inferBrochureColumns(
        headers.map((header) => header.toLowerCase()),
        rows,
        [0, 2],
      ).setCol,
    ).toBe(3);
  });

  it("combines two consecutive case-insensitive Set rows using one populated or repeated price, never a sum", () => {
    for (const lastPrice of ["", 349]) {
      const rows = [
        ["A100", "", 349, " SeT "],
        ["B200", "", lastPrice, "set"],
      ];
      const before = structuredClone({ rows, catalog });
      const result = analyzePrices(rows);
      expect(result.discounted).toHaveLength(1);
      const offer = result.discounted[0];
      expect(offer?.sale).toBe("349");
      expect(offer?.regular).toBe(500);
      expect(offer?.bundleCodes).toEqual(["A100", "B200"]);
      expect(
        offer?.bundleProducts?.map((member: Product) => member.code),
      ).toEqual(["A100", "B200"]);
      expect(offer?.code).toBe("A100 + B200 [Set row 2]");
      expect(offer?.setSourceRows).toEqual([2, 3]);
      expect(result.skipped).toEqual([]);
      expect({ rows, catalog }).toEqual(before);
    }
  });

  it("keeps three or more members, including codes already bundled in one cell and a price supplied on a later row", () => {
    const result = analyzePrices([
      ["A100 + B200", "", "", "Set"],
      ["C300", "", 499, "SET"],
    ]);
    expect(result.discounted).toHaveLength(1);
    expect(result.discounted[0]?.sale).toBe("499");
    expect(result.discounted[0]?.regular).toBe(600);
    expect(result.discounted[0]?.bundleProducts).toHaveLength(3);
    expect(result.discounted[0]?.bundleCodes).toEqual(["A100", "B200", "C300"]);
  });

  it("uses blank and unmarked rows as barriers and preserves repeated runs as separate offers", () => {
    const rows = [
      ["A100", "", 349, "Set"],
      ["B200", "", "", "Set"],
      [],
      ["A100", "", 349, "Set"],
      ["B200", "", "", "Set"],
      ["C300", "", 70, ""],
      ["A100", "", 299, "Set"],
      ["B200", "", "", "Set"],
      ["A100 + B200", "", 399, ""],
    ];
    const result = analyzePrices(rows);
    expect(result.discounted.map((offer: Product) => offer.code)).toEqual([
      "A100 + B200 [Set row 2]",
      "A100 + B200 [Set row 5]",
      "C300",
      "A100 + B200 [Set row 8]",
      "A100 + B200",
    ]);
    expect(result.discounted.map((offer: Product) => offer.sale)).toEqual([
      "349",
      "349",
      "70",
      "299",
      "399",
    ]);
    expect(result.ignored).toBe(1);
    expect(result.skipped).toEqual([]);
  });

  it("reports conflicting, missing and invalid populated shared prices for the whole Set instead of importing a partial offer", () => {
    for (const prices of [
      [349, 350],
      ["", ""],
      [349, "bad"],
      [349, 0],
    ]) {
      const rows = [
        ["A100", "", prices[0], "Set"],
        ["B200", "", prices[1], "Set"],
        ["C300", "", 70, ""],
      ];
      const result = analyzePrices(rows);
      expect(result.discounted.map((offer: Product) => offer.code)).toEqual([
        "C300",
      ]);
      expect(result.skipped.map((issue: { row: number }) => issue.row)).toEqual(
        [2, 3],
      );
      expect(
        result.skipped.every((issue: { reason: string }) =>
          /shared Set sale price/.test(issue.reason),
        ),
      ).toBe(true);
    }
  });

  it("reports unresolved, missing and repeated member codes even when their own price cell is blank", () => {
    for (const second of ["", "A100"]) {
      const result = analyzePrices([
        ["A100", "", 349, "Set"],
        [second, "", "", "Set"],
      ]);
      expect(result.discounted).toEqual([]);
      expect(result.skipped).toHaveLength(2);
      expect(result.skipped[0]?.reason).toMatch(
        /Set (?:codes|product code)|Repeated Set product code/,
      );
      expect(result.ignored).toBe(0);
    }
  });

  it("uses a supplied shared regular price and retains equal-price Set offers, while flagging conflicting regular cells", () => {
    const supplied = analyzePrices([
      ["A100", 599, 499, "Set"],
      ["B200", "", "", "Set"],
    ]);
    expect(supplied.discounted[0]?.regular).toBe(599);
    const equal = analyzePrices([
      ["A100", "", 500, "Set"],
      ["B200", "", "", "Set"],
    ]);
    expect(equal.discounted).toHaveLength(1);
    const conflict = analyzePrices([
      ["A100", 599, 499, "Set"],
      ["B200", 699, "", "Set"],
    ]);
    expect(conflict.discounted).toEqual([]);
    expect(conflict.skipped[0]?.reason).toMatch(
      /Conflicting shared Set regular prices/,
    );
  });

  it("preserves the existing unmarked multi-code-cell offer and latest ordinary duplicate-price review", () => {
    const bundled = analyzePrices([["A100 + B200", "", 399, ""]]);
    expect(bundled.discounted[0]?.code).toBe("A100 + B200");
    expect(bundled.discounted[0]?.sale).toBe("399");
    const ordinary = analyzePrices([
      ["C300", "", 80, ""],
      ["C300", "", 70, ""],
    ]);
    expect(ordinary.discounted[0]?.sale).toBe("70");
    expect(ordinary.skipped[0]?.reason).toBe(
      "Duplicate code; latest price used",
    );
  });
});

describe("Set brochure placement and details", () => {
  it("keeps a shared position and each member's imported facts, and counts all successfully grouped source rows", () => {
    const rows = [
      ["A100", "", "", "Set", "", "70 L\nPROGRAME: 8", "OVEN IMPORTED"],
      ["B200", "", 499, "set", "2.3", "4 ZONA", "HOB IMPORTED"],
      ["C300", "", "", "SET", "2.3", "Bluetooth", "HOOD IMPORTED"],
    ];
    const result = analyzeBrochureRows(rows, columns, catalog, 12);
    expect(result.products).toHaveLength(1);
    const offer = result.products[0];
    expect(offer?.code).toBe("A100 + B200 + C300 [Set row 12]");
    expect(offer?.brochurePage).toBe(2);
    expect(offer?.brochureOrder).toBe(3);
    expect(offer?.sale).toBe("499");
    expect(
      offer?.bundleProducts?.map((member: Product) => member.name),
    ).toEqual(["OVEN IMPORTED", "HOB IMPORTED", "HOOD IMPORTED"]);
    expect(offer?.bundleProducts?.[0]?.brochureDetails).toEqual([
      "70 L",
      "PROGRAME: 8",
    ]);
    expect(offer?.brochureDetails).toEqual([
      "70 L",
      "PROGRAME: 8",
      "4 ZONA",
      "Bluetooth",
    ]);
    expect(result.matchedRows).toBe(3);
    expect(result.skipped).toEqual([]);
  });

  it("keeps separated same-code Sets at different positions and reviews conflicting positions instead of dropping members", () => {
    const rows = [
      ["A100", "", 349, "Set", "2.1"],
      ["B200", "", "", "Set", "2.2"],
      [],
      ["A100", "", 399, "Set", "3.1"],
      ["B200", "", "", "Set", "3.1"],
    ];
    const result = analyzeBrochureRows(rows, columns, catalog);
    expect(result.products).toHaveLength(2);
    expect(
      new Set(result.products.map((offer: Product) => offer.code)).size,
    ).toBe(2);
    expect(
      result.products.map((offer: Product) => [
        offer.brochurePage,
        offer.brochureOrder,
      ]),
    ).toEqual([
      [2, 1],
      [3, 1],
    ]);
    expect(result.warnings[0]?.message).toMatch(
      /Set rows have different brochure positions/,
    );
    expect(result.matchedRows).toBe(4);
    expect(result.ignored).toBe(1);
  });

  it("keeps a missing-catalog Set member using its Excel facts and the shared offer price", () => {
    const rows = [
      ["A100", "", 349, "Set", "2.1"],
      ["UNKNOWN", "", "", "Set", "2.1", "7 KG", "Unknown appliance"],
    ];
    const result = analyzeBrochureRows(rows, columns, catalog);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]).toMatchObject({
      sale: "349",
      regular: null,
      catalogMissing: true,
      missingCatalogCodes: ["UNKNOWN"],
    });
    expect(
      result.products[0]?.bundleProducts?.find(
        (product) => product.code === "UNKNOWN",
      ),
    ).toMatchObject({
      name: "Unknown appliance",
      brochureDetails: ["7 KG"],
      catalogMissing: true,
    });
    expect(result.skipped).toEqual([]);
    expect(result.matchedRows).toBe(2);
  });

  it("groups newly supplied non-Apple phone facts after catalog resolution, including each Set member", () => {
    const phone: Product = {
      code: "P400",
      name: "SAMSUNG GALAXY A35",
      brand: "SAMSUNG",
      category: "Smartphone",
      regular: 400,
    };
    const facts =
      "RAM: 8GB\nFront: 13MP\nMemorje: 256GB\nKamera: 50MP\nBateria: 5000 mAh\nAndroid 15\n5G";
    const grouped = [
      "Android\n15",
      "KAMERA: 50MP\nFront: 13MP",
      "256GB\n8GB",
      "Bateria:\n5000 mAh",
      "5G",
    ];
    const standalone = analyzeBrochureRows(
      [["P400", "", 299, "", "2.1", facts]],
      columns,
      [...catalog, phone],
    );
    expect(standalone.products[0]?.brochureDetails).toEqual(grouped);
    const bundled = analyzeBrochureRows(
      [
        ["P400", "", 499, "Set", "2.1", facts],
        ["B200", "", "", "Set", "2.1", "4 ZONA"],
      ],
      columns,
      [...catalog, phone],
    );
    expect(
      bundled.products[0]?.bundleProducts?.find(
        (member: Product) => member.code === "P400",
      )?.brochureDetails,
    ).toEqual(grouped);
    expect(
      bundled.products[0]?.bundleProducts?.find(
        (member: Product) => member.code === "B200",
      )?.brochureDetails,
    ).toEqual(["4 ZONA"]);
    expect(bundled.products[0]?.brochureDetails).toEqual([
      ...grouped,
      "4 ZONA",
    ]);
  });

  it("preserves existing manually ordered details when the sheet has none, and leaves Apple/appliance facts in sheet order", () => {
    const saved = ["RAM: 8GB", "CUSTOM FIRST", "Memorje: 256GB"];
    const phone: Product = {
      code: "P400",
      name: "SAMSUNG GALAXY A35",
      brand: "SAMSUNG",
      category: "Smartphone",
      regular: 400,
      brochureDetails: saved,
    };
    const apple: Product = {
      code: "I500",
      name: "IPHONE 17",
      brand: "APPLE",
      regular: 900,
    };
    const source = [...catalog, phone, apple];
    const imported = analyzeBrochureRows(
      [
        ["P400", "", 299, "", "2.1", ""],
        ["I500", "", 799, "", "2.2", "RAM: 8GB\nMemorje: 256GB"],
        ["B200", "", 149, "", "2.3", "CUSTOM\nRAM: 8GB"],
      ],
      columns,
      source,
    );
    expect(
      imported.products.find((product: Product) => product.code === "P400")
        ?.brochureDetails,
    ).toEqual(saved);
    expect(
      imported.products.find((product: Product) => product.code === "I500")
        ?.brochureDetails,
    ).toEqual(["RAM: 8GB", "Memorje: 256GB"]);
    expect(
      imported.products.find((product: Product) => product.code === "B200")
        ?.brochureDetails,
    ).toEqual(["CUSTOM", "RAM: 8GB"]);
    expect(phone.brochureDetails).toEqual(saved);
  });

  it("does not merge a marked singleton Set into ordinary color variants sharing its position", () => {
    const phones: Product[] = [
      {
        code: "P400",
        name: "SAMSUNG GALAXY A35 Black",
        brand: "SAMSUNG",
        regular: 400,
      },
      {
        code: "P401",
        name: "SAMSUNG GALAXY A35 Blue",
        brand: "SAMSUNG",
        regular: 400,
      },
    ];
    const result = analyzeBrochureRows(
      [
        ["P400", "", 299, "Set", "2.1"],
        ["P401", "", 299, "", "2.1"],
      ],
      columns,
      phones,
    );
    expect(result.products.map((product: Product) => product.code)).toEqual([
      "P400 [Set row 2]",
      "P401",
    ]);
    expect(result.matchedRows).toBe(2);
    expect(result.warnings).toHaveLength(1);
  });
});
