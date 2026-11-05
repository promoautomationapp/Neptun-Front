import { describe, expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import {
  hasEditableScreen,
  otherScreenInches,
  screenAnnotationType,
  tvScreenInches,
} from "../../src/features/brochure/tvSpecs";

const categories: Array<[string, number]> = [
  ["TABLETË", 11],
  ["tablet", 11],
  ["TABLETA", 11],
  ["TABLETET", 11],
  ["TABLETS", 11],
  ["MONITOR", 27],
  ["MONITORË", 27],
  ["MONITORE", 27],
  ["MONITORS", 27],
  ["MONITOR GAMING", 27],
  ["EKRAN", 27],
  ["EKRANE", 27],
  ["SCREENS", 27],
  ["DISPLAY", 27],
  ["LAPTOP", 15.6],
  ["LAPTOPË", 15.6],
  ["LAPTOPS", 15.6],
  ["NOTEBOOK", 15.6],
  ["ULTRABOOK", 15.6],
  ["KOMPJUTER PORTATIV", 15.6],
];

describe("localized screen device categories", () => {
  it.each(categories)(
    "recognizes %s from either category level",
    (category, size) => {
      for (const field of ["subcategory", "category"] as const) {
        const product = {
          name: "ABC123",
          brand: "Samsung",
          [field]: category,
          specs: { Ekrani: `${size} inch` },
        };
        expect(otherScreenInches(product)).toBe(size);
        expect(hasEditableScreen(product)).toBe(true);
        expect(screenAnnotationType(product)).toBe("other");
      }
    },
  );

  it("uses the specific category path and accepts explicit device families under generic manufacturer categories", () => {
    expect(
      otherScreenInches({
        name: "ABC123",
        brand: "Samsung",
        category: "Electronics",
        subcategory: "Devices",
        categoryPath: "Ballina > TABLETË > Samsung",
        specs: { Display: "11”" },
      }),
    ).toBe(11);
    for (const name of [
      "Tablet Redmi Pad 2",
      "Samsung Galaxy Tab A11",
      "Huawei MatePad 11",
      "Redmi Pad 2",
      "Notebook Lenovo 15.6 inch",
      "Gaming laptop HP",
    ]) {
      const product = {
        name,
        subcategory: "Technology",
        specs: { Ekrani: "11 inch" },
      };
      expect(otherScreenInches(product), name).toBe(11);
      expect(hasEditableScreen(product), name).toBe(true);
    }
  });

  it("rejects compatible-device accessories even when the parent category or imported specifications name a screen", () => {
    const accessories: Partial<Product>[] = [
      {
        name: "Case for Samsung Galaxy Tab 11 inch",
        category: "TABLETË",
        subcategory: "Accessories",
      },
      {
        name: "Screen protector for iPad 11 inch",
        category: "EKRAN",
        brand: "Fuego",
      },
      { name: "Mbështjellëse tablet 11 inch", category: "TABLETA" },
      { name: "Mbrojtës ekrani 11 inch", category: "TABLETË" },
      { name: "Laptop sleeve 15.6 inch", category: "LAPTOP" },
      { name: "Replacement display for tablet 11 inch", category: "DISPLAY" },
      {
        name: "ABC123",
        category: "TABLETË",
        subcategory: "Samsung",
        categoryPath: "Home > Tablets > Cases",
      },
      {
        name: "TV LED 65 inch wall mount",
        category: "TV",
        subcategory: "Accessories",
      },
    ];
    for (const accessory of accessories) {
      const product = { ...accessory, specs: { Ekrani: "11 inch" } };
      expect(otherScreenInches(product), accessory.name).toBeNull();
      expect(hasEditableScreen(product), accessory.name).toBe(false);
      expect(screenAnnotationType(product), accessory.name).toBe("none");
    }
  });

  it("never annotates Apple devices, regardless of screen specifications or saved manual placement", () => {
    for (const [name, subcategory, size] of [
      ["iPhone 17", "SMARTPHONE", 6.3],
      ["iPad Air", "TABLETË", 11],
      ["MacBook Air", "NOTEBOOK", 13.6],
    ] as const) {
      for (const brand of [undefined, "Apple"]) {
        const product = {
          name,
          brand,
          subcategory,
          specs: { Ekrani: `${size} inch` },
          screenAnnotationPlacement: { x: 0, y: 0, scale: 1.8 },
        };
        expect(otherScreenInches(product)).toBeNull();
        expect(hasEditableScreen(product)).toBe(false);
        expect(tvScreenInches(product)).toBeNull();
        expect(screenAnnotationType(product)).toBe("none");
      }
    }
  });

  it("reads brochure screen facts and falls through unrelated display facts without inventing a size", () => {
    expect(
      otherScreenInches({
        name: "ABC123",
        category: "TABLETË",
        specs: { Display: "IPS 120 Hz" },
        brochureDetails: [{ key: "size", text: "Ekrani: 11,5”" }],
      }),
    ).toBe(11.5);
    expect(
      otherScreenInches({
        name: "Notebook Lenovo 15.6 inch",
        specs: { Display: "IPS" },
      }),
    ).toBe(15.6);
    expect(
      otherScreenInches({
        name: "ABC123",
        category: "TABLETË",
        brochureDetails: ["12 month warranty", "8 GB RAM"],
      }),
    ).toBeNull();
  });

  it.each(['11.5"', "11,5”"])(
    "keeps the exact Huawei %s model size when the supplied leaflet rounds it to 11 inches",
    (size) => {
      const product: Partial<Product> = {
        name: `TABLET HUAWEI MATE PAD SE ${size} 8/256GB SPACE GREY (DEMO)`,
        brochureDetails: ["HarmonyOS 2.0", 'Ekran: 11 "', "256 GB, 8 GB RAM"],
      };
      expect(otherScreenInches(product)).toBe(11.5);
      expect(otherScreenInches({ ...product, specs: { Ekrani: '11 "' } })).toBe(
        11.5,
      );
      expect(
        otherScreenInches({
          ...product,
          image: "/verified-cutout.png",
          aiOriginalImage: "/original-photo.jpg",
          aiCutoutValidated: true,
          aiCutoutValidationVersion: 1,
        }),
      ).toBe(11.5);
    },
  );

  it.each([
    ['11.6"', 11.6],
    ["11,6”", 11.6],
    ['11.0"', 11],
    ['12"', 12],
  ] as const)(
    "preserves a precise or different authoritative %s fact despite an 11.5-inch product name",
    (fact, expected) => {
      expect(
        otherScreenInches({
          name: 'TABLET HUAWEI MATE PAD SE 11.5" 8/256GB SPACE GREY',
          specs: { Ekrani: fact },
        }),
      ).toBe(expected);
    },
  );

  it("does not infer a fractional diagonal from model digits without an inch unit", () => {
    expect(
      otherScreenInches({
        name: "TABLET HUAWEI MATE PAD SE 11.5 8/256GB SPACE GREY",
        specs: { Ekrani: '11"' },
      }),
    ).toBe(11);
  });
});
