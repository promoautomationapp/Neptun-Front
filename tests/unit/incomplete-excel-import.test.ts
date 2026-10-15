import { describe, it, expect } from "vitest";
import {
  analyzeBrochureRows,
  inferBrochureColumns,
} from "../../src/features/brochure/brochureImport";
import { missingImageTargets } from "../../src/features/ai/missing-product-images";
import { validOffer } from "../../src/features/brochure/Brochure";
const headers = [
  "Code",
  "Description",
  "Technical Specifications for the leaflet",
  "Brochure Position",
  "Brands",
  "Promo Price",
  "Retail Price Before Promo",
  "Main Cat",
];
const columns = { ...inferBrochureColumns(headers), codeCol: 0, priceCol: 5 };
describe("Incomplete leaflet rows", () => {
  it("keeps positioned specifications as drafts, distinguishes missing identity from catalog misses, and waits for a model before AI search", () => {
    const result = analyzeBrochureRows(
      [
        [
          "",
          "",
          "Bluetooth: v5.2\nBattery: 40 h",
          "12.2",
          "SONY",
          "",
          "",
          "Audio",
        ],
        [
          "NEW123",
          "SONY WH-CH520",
          "Bluetooth: v5.2",
          "12.3",
          "SONY",
          49,
          69,
          "Audio",
        ],
        [
          "NEW456",
          "JBL TUNE 520BT",
          "Bluetooth: v5.3",
          "12.4",
          "JBL",
          "",
          59,
          "Audio",
        ],
      ],
      columns,
      [],
      108,
    );
    expect(result.products).toHaveLength(1);
    expect(result.skipped).toEqual([]);
    expect(result.incompleteProducts).toHaveLength(2);
    const draft = result.incompleteProducts[0]!;
    expect(draft).toMatchObject({
      name: "Excel row 108",
      brochurePage: 12,
      brochureOrder: 2,
      brand: "SONY",
      category: "Audio",
      sale: "",
    });
    expect(draft.brochureDetails).toEqual(["Bluetooth: v5.2", "Battery: 40 h"]);
    expect(missingImageTargets([draft])).toEqual([]);
    expect(validOffer({ ...draft, sale: "49" })).toBe(false);
    expect(
      missingImageTargets([{ ...draft, name: "SONY WH-CH520" }]),
    ).toHaveLength(1);
    expect(validOffer({ ...draft, name: "SONY WH-CH520", sale: "49" })).toBe(
      true,
    );
    expect(result.products[0]).toMatchObject({
      code: "NEW123",
      catalogMissing: true,
      name: "SONY WH-CH520",
      sale: "49",
    });
  });
  it("imports a named model without a code and preserves valid catalog photos", () => {
    const result = analyzeBrochureRows(
      [["", "SONY WH-CH520", "Battery: 40 h", "12.2", "SONY", 49, 69, "Audio"]],
      columns,
      [],
    );
    expect(result.products[0]).toMatchObject({
      catalogMissing: true,
      name: "SONY WH-CH520",
      sale: "49",
    });
    expect(missingImageTargets(result.products)).toHaveLength(1);
  });
});
