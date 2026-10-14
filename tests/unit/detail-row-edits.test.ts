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
