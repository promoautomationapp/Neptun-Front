import { expect, it } from "vitest";
import {
  blackFridayFrames,
  blackFridayReference,
} from "../../src/features/brochure/blackFridayDesign";
import { productImageFit } from "../../src/features/brochure/productImageFit";

it("expands the original eleven-offer page's last two products across the row", () => {
  const native = blackFridayReference.pages.find((page) => page.number === 11)!;
  const before = structuredClone(native);
  const products = native.frames.map((frame) => ({
    code: frame.code || frame.model,
    name: frame.model,
  }));
  const frames = blackFridayFrames(11, products, {
    brochureReferenceDesign: "black-friday",
  });
  expect(frames).toHaveLength(11);
  const last = frames.slice(-2);
  const left = Math.min(...frames.map((frame) => frame.x));
  const right = Math.max(...frames.map((frame) => frame.x + frame.width));
  expect(last[0]!.x).toBeCloseTo(left);
  expect(last[1]!.x + last[1]!.width).toBeCloseTo(right);
  expect(last[0]!.width).toBeGreaterThan(frames[0]!.width);
  expect(native).toEqual(before);
});

it("keeps automatic photos fitted but allows a manually enlarged photo beyond its slot", () => {
  const geometry = {
    naturalWidth: 800,
    naturalHeight: 600,
    imageBoxWidth: 400,
    imageBoxHeight: 300,
    wrapWidth: 400,
    wrapHeight: 300,
  };
  const requested = { x: -40, y: 150, scale: 8 };
  expect(
    productImageFit({ ...geometry, base: requested }).scale,
  ).toBeLessThanOrEqual(1);
  expect(
    productImageFit({ ...geometry, base: requested, allowOverflow: true }),
  ).toEqual(requested);
});
