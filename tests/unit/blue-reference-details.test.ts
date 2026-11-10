import { expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import {
  blueReferenceDetailGroups,
  removeBlueReferenceDetailGroup,
} from "../../src/features/brochure/blueReferenceDetails";
import type { DetailEntry } from "../../src/features/brochure/detailFacts";

const product: Product = { code: "tv", name: "TV" };

it("packs every supplied TV fact into three rectangles without dropping source lines", () => {
  const entries: DetailEntry[] = [
    ["0", "QLED TV"],
    ["1", "4K Ultra HD"],
    ["2", "144Hz"],
    ["3", "HDR10+"],
    ["4", "Dolby Vision"],
    ["5", "Dolby Atmos"],
  ];
  const groups = blueReferenceDetailGroups(product, entries, {
    imported: true,
  })!;
  expect(groups.map((group) => group.text)).toEqual([
    "QLED TV\n4K Ultra HD",
    "144Hz\nHDR10+",
    "Dolby Vision\nDolby Atmos",
  ]);
  expect(groups.flatMap((group) => group.entries)).toEqual(entries);
});

it("keeps source labels in catalog groups and never invents empty boxes", () => {
  expect(
    blueReferenceDetailGroups(product, [
      ["Fuqia", "200 W"],
      ["Sound", "Double Super Bass Boost"],
    ])?.map((group) => group.text),
  ).toEqual(["Fuqia: 200 W", "Sound: Double Super Bass Boost"]);
  expect(blueReferenceDetailGroups(product, [])).toEqual([]);
  expect(
    blueReferenceDetailGroups(product, [
      ["Google TV", ""],
      ["HDR10", "HDR10"],
    ])?.map((group) => group.text),
  ).toEqual(["Google TV", "HDR10"]);
});

it("uses four supplied phone fact groups and leaves the screen size in its separate annotation", () => {
  const entries: DetailEntry[] = [
    ["0", "Android 16"],
    ["1", "Kamera: 50 MP"],
    ["2", "Front: 12 MP"],
    ["3", "6 GB / 128 GB"],
    ["4", "Bateria: 5000 mAh"],
    ["5", '6.7" Super AMOLED'],
    ["6", "Bluetooth v5.3"],
  ];
  const groups = blueReferenceDetailGroups(product, entries, {
    phone: true,
    imported: true,
  })!;
  expect(groups.map((group) => group.text)).toEqual([
    "Android 16",
    "Kamera: 50 MP\nFront: 12 MP",
    "6 GB / 128 GB",
    "Bateria: 5000 mAh",
  ]);
  expect(entries).toHaveLength(7);
});

it("preserves manual visibility/order, individual block moves and fill choices", () => {
  const entries: DetailEntry[] = [
    ["0", "Android 16"],
    ["1", '6.7" AMOLED'],
  ];
  for (const changes of [
    { autoSpecsDisabled: true },
    { detailBlockPlacements: { "0": { x: 3 } } },
    { detailBlockStyles: { "1": "filled" as const } },
  ])
    expect(
      blueReferenceDetailGroups({ ...product, ...changes }, entries, {
        phone: true,
      }),
    ).toBeNull();
  expect(
    blueReferenceDetailGroups(
      { ...product, detailBlockPlacements: { __colors: { x: 3 } } },
      entries,
      { phone: true },
    ),
  ).not.toBeNull();
});

it("removes an entire packed group while preserving the surviving structured keys and edits", () => {
  const source: Product = {
    ...product,
    brochureDetails: [
      { key: "screen", text: "4K" },
      { key: "refresh", text: "144Hz" },
      { key: "audio", text: "Dolby Atmos" },
    ],
    detailBlockPlacements: { screen: { x: 1 }, audio: { y: 2 } },
    detailBlockStyles: { audio: "outline" },
  };
  const result = removeBlueReferenceDetailGroup(
    source,
    [
      ["screen", "4K"],
      ["refresh", "144Hz"],
      ["audio", "Dolby Atmos"],
    ],
    ["screen", "refresh"],
  );
  expect(result.brochureDetails).toEqual([
    { key: "audio", text: "Dolby Atmos" },
  ]);
  expect(result.detailBlockPlacements).toEqual({ audio: { y: 2 } });
  expect(result.detailBlockStyles).toEqual({ audio: "outline" });
  expect(source.brochureDetails).toHaveLength(3);
});
