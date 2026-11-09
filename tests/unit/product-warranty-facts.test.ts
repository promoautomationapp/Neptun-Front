import { expect, it } from "vitest";
import {
  productWarranty,
  warrantyDuration,
} from "../../src/features/brochure/warranty";
import {
  conditionerDetailEntries,
  defaultFilledDetail,
} from "../../src/features/brochure/conditionerDetails";
import { defaultProductArtworks } from "../../src/features/brochure/productArtwork";

it("extracts one duration from saved Excel detail rows and numeric warranty columns", () => {
  expect(warrantyDuration("2")).toEqual({ count: 2, unit: "VITE", months: 24 });
  expect(
    productWarranty({ brochureDetails: ["Memory: 256 GB", "1 VIT GARANCION"] }),
  ).toEqual({ count: 1, unit: "VIT", months: 12 });
  expect(
    productWarranty({
      excelSource: { row: 2, cells: { "Vitet e Garancionit": "5" } },
    }),
  ).toEqual({ count: 5, unit: "VITE", months: 60 });
  expect(productWarranty({ specs: { "Warranty months": "18" } })).toEqual({
    count: 18,
    unit: "MUAJ",
    months: 18,
  });
  expect(
    productWarranty({ warranty: "2 vite", hideWarranty: true }),
  ).toBeNull();
  expect(
    productWarranty({
      brochureDetails: ["1 VIT GARANCION"],
      detailBlockPlacements: { "0": { hidden: true } },
    }),
  ).toBeNull();
});

it("uses actual Excel and structured detail facts for AC defaults without inventing a feature", () => {
  const product = {
    name: "KONDICIONER FUEGO",
    excelSource: {
      row: 4,
      cells: {
        Përshkrimi:
          "* Kapaciteti: 12000 BTU\n* Klasa energjisë: A+++ / A++\n* Teknologjia: inverter\n* Wi-Fi: Po",
      },
    },
  };
  const details = conditionerDetailEntries(product);
  expect(details).toContainEqual(["BTU", "12000 BTU"]);
  expect(details).toContainEqual(["Klasa energjisë", "A+++ / A++"]);
  expect(defaultFilledDetail(product, "Klasa energjisë", "A+++ / A++", 1)).toBe(
    true,
  );
  expect(defaultProductArtworks(product).map((item) => item.type)).toEqual(
    expect.arrayContaining(["wifi", "inverter", "energy"]),
  );
  expect(
    defaultProductArtworks({
      name: "KONDICIONER FUEGO",
      brochureDetails: [
        { key: "feature", text: "Inverter: No" },
        { key: "energy", text: "Energy class: A+" },
      ],
    }),
  ).toEqual([]);
});
