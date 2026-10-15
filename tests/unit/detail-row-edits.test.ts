import { expect, it } from "vitest";
import {
  deleteDisplayedDetail,
  reorderDisplayedDetails,
} from "../../src/features/brochure/detailRows";
import { savedDetailEntries } from "../../src/features/brochure/detailFacts";
import { campaignSchema } from "../../src/domain/schemas";

it("keeps structured detail keys, order and corresponding move/size/fill edits through deletion and reordering", () => {
  const campaign = campaignSchema.parse({
    id: "campaign",
    name: "Details",
    products: [
      {
        code: "phone",
        name: "Redmi",
        brochureDetails: [
          { key: "camera", text: "Kamera: 13MP Front: 8MP" },
          { key: "memory", text: "4GB / 64GB" },
          { key: "battery", text: "6000mAh" },
        ],
        detailBlockPlacements: {
          camera: { x: 1, y: 2 },
          memory: { width: 20, height: 7 },
          battery: { x: -1 },
          __warranty: { x: 3 },
        },
        detailBlockStyles: {
          camera: "outline",
          memory: "filled",
          battery: "auto",
        },
      },
    ],
  });
  const product = campaign.products[0]!;
  const rows = savedDetailEntries(product)!;
  const reordered = reorderDisplayedDetails(product, rows, 1, 0);
  expect(reordered.brochureDetails).toEqual([
    { key: "memory", text: "4GB / 64GB" },
    { key: "camera", text: "Kamera: 13MP Front: 8MP" },
    { key: "battery", text: "6000mAh" },
  ]);
  expect(reordered.detailBlockPlacements).toEqual(
    product.detailBlockPlacements,
  );
  expect(reordered.detailBlockStyles).toEqual(product.detailBlockStyles);
  const deleted = deleteDisplayedDetail(product, rows, 0);
  expect(deleted.brochureDetails).toEqual([
    { key: "memory", text: "4GB / 64GB" },
    { key: "battery", text: "6000mAh" },
  ]);
  expect(deleted.detailBlockPlacements).toEqual({
    memory: { width: 20, height: 7 },
    battery: { x: -1 },
    __warranty: { x: 3 },
  });
  expect(deleted.detailBlockStyles).toEqual({
    memory: "filled",
    battery: "auto",
  });
  expect(campaign.products[0]!.brochureDetails).toEqual([
    { key: "camera", text: "Kamera: 13MP Front: 8MP" },
    { key: "memory", text: "4GB / 64GB" },
    { key: "battery", text: "6000mAh" },
  ]);
});

it("remaps legacy indexed strings and preserves warranty controls and exact custom text", () => {
  const product = {
    brochureDetails: [
      "Memory: 128GB, 8GB RAM",
      "Camera: 50MP\nFront: 13MP",
      "Manual detail",
    ],
    detailBlockPlacements: {
      "0": { x: 1 },
      "1": { width: 18 },
      "2": { y: 4 },
      __warranty: { x: -3 },
    },
    detailBlockStyles: { "0": "filled" as const, "1": "outline" as const },
  };
  const rows = savedDetailEntries(product)!;
  expect(deleteDisplayedDetail(product, rows, 0)).toEqual({
    brochureDetails: ["Camera: 50MP\nFront: 13MP", "Manual detail"],
    detailBlockPlacements: {
      "0": { width: 18 },
      "1": { y: 4 },
      __warranty: { x: -3 },
    },
    detailBlockStyles: { "0": "outline" },
  });
  expect(reorderDisplayedDetails(product, rows, 0, 2)).toEqual({
    brochureDetails: [
      "Camera: 50MP\nFront: 13MP",
      "Manual detail",
      "Memory: 128GB, 8GB RAM",
    ],
    detailBlockPlacements: {
      "0": { width: 18 },
      "1": { y: 4 },
      "2": { x: 1 },
      __warranty: { x: -3 },
    },
    detailBlockStyles: { "0": "outline", "2": "filled" },
  });
  expect(deleteDisplayedDetail(product, rows, -1)).toEqual({});
});

it("preserves mixed structured/string lists and snapshots generated facts only when explicitly edited", () => {
  const mixed = {
    brochureDetails: [{ key: "capacity", text: "8KG" }, "Custom feature"],
    detailBlockStyles: { capacity: "filled" as const, "1": "outline" as const },
  };
  expect(
    reorderDisplayedDetails(mixed, savedDetailEntries(mixed)!, 0, 1),
  ).toEqual({
    brochureDetails: ["Custom feature", { key: "capacity", text: "8KG" }],
    detailBlockPlacements: {},
    detailBlockStyles: { "0": "outline", capacity: "filled" },
  });
  expect(
    deleteDisplayedDetail(
      { specs: { OS: "Android 15", Memory: "128GB" } },
      [
        ["Sistemi", "Android 15"],
        ["RAM / Memorje", "8GB / 128GB"],
      ],
      0,
    ),
  ).toEqual({
    brochureDetails: ["RAM / Memorje: 8GB / 128GB"],
    detailBlockPlacements: {},
    detailBlockStyles: {},
  });
});

it("selects the reference appliance facts while retaining imported lists and individual edits", async () => {
  const { brochureDefaultDetailEntries } =
    await import("../../src/features/brochure/detailRows");
  const specs = {
    Kapaciteti: "7 Kg",
    "Shpejtësia e rrotullimeve": "1200 rpm",
    "Numri i programeve": "14",
    "Klasa energjisë": "A",
    "Lloji i motorrit": "ProSmart Inverter",
    Teknologji: "EnergySpin",
    Permasat: "84.5x60x49.6 cm",
  };
  const entries = Object.entries(specs);
  const product = { subcategory: "Rrobalarëse", specs };
  expect(
    brochureDefaultDetailEntries(product, entries).map(([key]) => key),
  ).toEqual([
    "Kapaciteti",
    "Shpejtësia e rrotullimeve",
    "Numri i programeve",
    "Lloji i motorrit",
  ]);
  expect(product.specs).toEqual(specs);
  expect(
    brochureDefaultDetailEntries({ ...product, brochureDetails: [] }, entries),
  ).toBe(entries);
  expect(
    brochureDefaultDetailEntries(
      { ...product, autoSpecsDisabled: true },
      entries,
    ),
  ).toBe(entries);
  expect(
    brochureDefaultDetailEntries(
      { ...product, detailBlockPlacements: { Permasat: { width: 30 } } },
      entries,
    ).at(-1)?.[0],
  ).toBe("Permasat");
  expect(
    brochureDefaultDetailEntries({ subcategory: "ENËLARËSE" }, [
      ["Kapaciteti", "14 Sete"],
      ["Nr. Programe", "6"],
      ["Teknologji", "HygieneShield"],
      ["Shpenzimet e energjisë", "237 kWh /vit"],
      ["Përmasat", "85x60cm"],
      ["Niveli i zhurmës", "47dB"],
    ]).map(([key]) => key),
  ).toEqual([
    "Kapaciteti",
    "Nr. Programe",
    "Shpenzimet e energjisë",
    "Niveli i zhurmës",
  ]);
});
