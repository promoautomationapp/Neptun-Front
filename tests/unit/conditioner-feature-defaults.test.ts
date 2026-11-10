import { expect, it } from "vitest";
import { defaultProductArtworks, productBadgeImage } from "../../src/features/brochure/productArtwork";
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

it("uses a negative-to-positive AC operating range as inverter evidence but respects an explicit denial", () => {
  const product = { code: "ac-range", name: "Kondicioner", brochureDetails: ["Temperatura: -20°C deri +53°C"] };
  expect(defaultProductArtworks(product).map((item) => item.type)).toEqual(["inverter"]);
  expect(defaultProductArtworks({ ...product, specs: { Inverter: "No" } })).toEqual([]);
  expect(defaultProductArtworks({ ...product, name: "Hair straightener" })).toEqual([]);
});

it("anchors default WiFi to the right end of the visible photo and uses the fitted built-in A+++ mark", () => {
  const marks = defaultProductArtworks({ code: "ac", name: "Kondicioner WIFI", specs: { "Energy class": "A+++" } });
  const wifi = marks.find((item) => item.type === "wifi")!;
  expect(wifi.x + wifi.width).toBe(100);
  expect(marks.find((item) => item.type === "energy")?.image).toBe("/product-badges/energy-a-plus-plus-plus.svg");
  expect(productBadgeImage("/uploads/my-energy.svg")).toBe("/uploads/my-energy.svg");
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
