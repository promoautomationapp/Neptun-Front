import { expect, it } from "vitest";
import {
  phoneAnnotationBaseBox,
  otherScreenAnnotationBaseBox,
  renderedScreenAnnotationBox,
  resolveScreenAnnotationPlacement,
  usesPhoneCornerAnnotation,
} from "../../src/features/brochure/screenAnnotationGeometry";

it("places phone measurements outside the visible photograph instead of covering its corner", () => {
  const photo = { left: 40, top: 20, width: 240, height: 400 };
  const base = phoneAnnotationBaseBox(photo);
  expect(base).toEqual(otherScreenAnnotationBaseBox(photo));
  const rendered = renderedScreenAnnotationBox(base, 1080, "phone");
  const verticalX =
    rendered.left + (rendered.width * 33.3868950515) / 67.1693479534;
  const guideY =
    rendered.top + (rendered.width * 25.7483815485) / 67.1693479534;
  expect(verticalX).toBeGreaterThan(photo.left + photo.width);
  expect(guideY).toBeLessThan(photo.top);
  expect(resolveScreenAnnotationPlacement("phone")).toMatchObject({
    x: 0,
    y: 0,
    scale: 1,
  });
});

it("honors saved phone edits, including zero coordinates and hidden state", () => {
  expect(
    resolveScreenAnnotationPlacement("phone", {
      x: 0,
      y: 0,
      scale: 1.2,
      hidden: true,
    }),
  ).toMatchObject({ x: 0, y: 0, scale: 1.2, hidden: true });
  const photo = { left: 40, top: 20, width: 240, height: 400 };
  const small = phoneAnnotationBaseBox({
    left: 20,
    top: 10,
    width: 120,
    height: 200,
  });
  const large = phoneAnnotationBaseBox(photo);
  expect(small.left * 2).toBe(large.left);
  expect(small.top * 2).toBe(large.top);
  expect(small.width * 2).toBe(large.width);
});

it("uses phone measurement geometry only for non-Apple phones, excluding compatible accessories and other screens", () => {
  expect(
    usesPhoneCornerAnnotation({
      name: "Samsung Galaxy A17",
      subcategory: "SMARTPHONE",
    }),
  ).toBe(true);
  for (const product of [
    { name: "iPhone 17", brand: "Apple", subcategory: "SMARTPHONE" },
    { name: "Samsung Galaxy A17 cover", subcategory: "COVER" },
    { name: "Samsung Tablet", subcategory: "TABLET" },
  ])
    expect(usesPhoneCornerAnnotation(product)).toBe(false);
});

it("anchors tablet and laptop guides outside the visible image edge at every preview scale", async () => {
  const { otherScreenAnnotationBaseBox } =
    await import("../../src/features/brochure/screenAnnotationGeometry");
  for (const factor of [0.4, 1, 1.5]) {
    const photo = {
      left: 50 * factor,
      top: 80 * factor,
      width: 400 * factor,
      height: 280 * factor,
    };
    const label = otherScreenAnnotationBaseBox(photo, 1080 * factor);
    const verticalX =
      label.left + (label.width * 33.3868950515) / 67.1693479534;
    const guideY = label.top + (label.width * 25.7483815485) / 67.1693479534;
    expect(verticalX).toBeCloseTo(photo.left + photo.width + 2 * factor, 5);
    expect(guideY).toBeLessThan(photo.top);
  }
});

it("scales the entire tablet/laptop guide with a resized photo on the same page", () => {
  const photo = { left: 40, top: 90, width: 400, height: 280 };
  const base = otherScreenAnnotationBaseBox(photo, 1080);
  for (const factor of [0.25, 0.5, 1.5]) {
    const scaled = otherScreenAnnotationBaseBox(
      {
        left: photo.left * factor,
        top: photo.top * factor,
        width: photo.width * factor,
        height: photo.height * factor,
      },
      1080,
    );
    for (const key of ["left", "top", "width", "height"] as const)
      expect(scaled[key]).toBeCloseTo(base[key] * factor, 10);
  }
  expect(otherScreenAnnotationBaseBox(photo, 320)).toEqual(base);
  expect(otherScreenAnnotationBaseBox(photo)).toEqual(base);
});

it("keeps phone measurements external and scales them with compound front/back photographs", () => {
  const single = { left: 30, top: 50, width: 240, height: 400 };
  const compound = { ...single, width: 480 };
  const base = phoneAnnotationBaseBox(single);
  const combined = phoneAnnotationBaseBox(compound);
  expect(combined.width).toBeGreaterThan(base.width);
  expect(combined.top).toBeLessThan(compound.top);
  const verticalX =
    combined.left + (combined.width * 33.3868950515) / 67.1693479534;
  expect(verticalX).toBeGreaterThan(compound.left + compound.width);
  const resized = phoneAnnotationBaseBox({
    ...compound,
    width: 240,
    height: 200,
  });
  expect(resized.width).toBe(combined.width / 2);
});

it("retains saved guide offsets in page units while photo resizing scales the label", () => {
  const saved = {
    x: -1,
    y: 2,
    scale: 0.8,
    horizontalLength: 0.7,
    verticalLength: 1.3,
  };
  const photo = { left: 40, top: 90, width: 400, height: 280 };
  const largeBase = otherScreenAnnotationBaseBox(photo);
  const smallBase = otherScreenAnnotationBaseBox({
    ...photo,
    width: 200,
    height: 140,
  });
  const large = renderedScreenAnnotationBox(largeBase, 1080, "other", saved);
  const small = renderedScreenAnnotationBox(smallBase, 1080, "other", saved);
  expect(small.width).toBeCloseTo(large.width / 2);
  expect(small.height).toBeCloseTo(large.height / 2);
  expect(
    small.left + small.width - smallBase.left - smallBase.width,
  ).toBeCloseTo(-10.8);
  expect(small.top - smallBase.top).toBeCloseTo(21.6);
  expect(resolveScreenAnnotationPlacement("other", saved)).toEqual(saved);
});
