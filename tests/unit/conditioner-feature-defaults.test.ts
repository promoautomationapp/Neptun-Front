import { expect, it } from "vitest";
import { defaultProductArtworks } from "../../src/features/brochure/productArtwork";
import {
  blackFridayProductArtworks,
  type BlackFridayFrame,
} from "../../src/features/brochure/blackFridayDesign";
import source from "../../src/features/brochure/blackFridayReference.json";

it("adds only supported AC badges and reserves the separate energy badge for A+++", () => {
  const product = {
    code: "ac",
    name: "Kondicioner",
    specs: { "Energy class": "A++", WiFi: "No", Inverter: "Yes" },
  };
  expect(defaultProductArtworks(product).map((item) => item.type)).toEqual([
    "inverter",
  ]);
  expect(
    defaultProductArtworks({
      ...product,
      specs: { "Energy class": "A+++", WiFi: "Yes", Inverter: "No" },
    }).map((item) => item.type),
  ).toEqual(["wifi", "energy"]);
});

it("keeps source AC evidence for its own product, respects explicit denials and never transfers it to unrelated offers", () => {
  const frame = source.pages[7]!.frames[0]! as BlackFridayFrame;
  const product = { code: frame.code!, name: "Kondicioner" };
  expect(blackFridayProductArtworks(frame, product)).toHaveLength(2);
  expect(
    blackFridayProductArtworks(frame, {
      ...product,
      specs: { WiFi: "No", Inverter: "No" },
    }),
  ).toHaveLength(0);
  expect(
    blackFridayProductArtworks(frame, { ...product, code: "another-ac" }),
  ).toHaveLength(0);
});
