import { describe, expect, it } from "vitest";
import { BROCHURE_FORMATS, brochureFormatContentGeometry } from "../../src/features/brochure/brochureFormat";
import {
  renderedScreenAnnotationBox,
  resolveScreenAnnotationPlacement,
  screenAnnotationPlacementStyle,
  televisionAnnotationBaseBox,
} from "../../src/features/brochure/screenAnnotationGeometry";

describe("TV inch sticker geometry", () => {
  const screen = { left: 100, top: 40, width: 600, height: 337.5 };
  const base = televisionAnnotationBaseBox(screen);

  it("shrinks ten percent around the top-right corner and moves that corner left/down by two canonical pixels", () => {
    const sticker = renderedScreenAnnotationBox(base, 1080, "television");
    expect(sticker.width).toBeCloseTo(base.width * 0.9);
    expect(sticker.height).toBeCloseTo(sticker.width);
    expect(sticker.left + sticker.width).toBeCloseTo(screen.left + screen.width - 2);
    expect(sticker.top).toBe(screen.top + 2);
    expect(sticker.left).toBeGreaterThanOrEqual(screen.left);
    expect(sticker.top + sticker.height).toBeLessThanOrEqual(screen.top + screen.height);
  });

  it.each(BROCHURE_FORMATS)("$id scales the adjustment with the inner reference page, not the output frame", (format) => {
    for (const frameWidth of [320, 794, format.width]) {
      const { contentWidth } = brochureFormatContentGeometry(format, frameWidth);
      const scale = contentWidth / 1080;
      const scaledScreen = Object.fromEntries(Object.entries(screen).map(([key, value]) => [key, value * scale])) as typeof screen;
      const scaledBase = televisionAnnotationBaseBox(scaledScreen);
      const sticker = renderedScreenAnnotationBox(scaledBase, contentWidth, "television");
      expect((sticker.left + sticker.width) / scale).toBeCloseTo(698, 10);
      expect(sticker.top / scale).toBeCloseTo(42, 10);
      expect(sticker.width / scale).toBeCloseTo(178.2, 10);
      expect(sticker.top + sticker.height).toBeLessThanOrEqual(scaledScreen.top + scaledScreen.height);
    }
  });

  it("keeps explicit manual coordinates and scale, including zero coordinates", () => {
    const manual = { x: 0, y: 3, scale: 1.4, horizontalLength: 0.7, hidden: false };
    expect(resolveScreenAnnotationPlacement("television", manual)).toEqual(manual);
    const sticker = renderedScreenAnnotationBox(base, 1080, "television", manual);
    expect(sticker.left + sticker.width).toBeCloseTo(screen.left + screen.width);
    expect(sticker.top).toBeCloseTo(screen.top + 32.4);
    expect(sticker.width).toBeCloseTo(base.width * 1.4);
    expect(resolveScreenAnnotationPlacement("television", { x: 5 }).x).toBe(5);
    expect(resolveScreenAnnotationPlacement("television", { x: 5 }).scale).toBe(0.9);
    expect(resolveScreenAnnotationPlacement("television", { scale: 0.8 }).scale).toBe(0.8);
  });

  it("keeps phone/tablet guides unchanged and rejects invalid saved geometry", () => {
    expect(resolveScreenAnnotationPlacement("other")).toEqual({ x: 0, y: 0, scale: 1 });
    expect(screenAnnotationPlacementStyle("other")).toEqual({ transform: "translate(0cqw,0cqw) scale(1)", transformOrigin: "top right" });
    expect(resolveScreenAnnotationPlacement("television", { x: NaN, y: Infinity, scale: 0 })).toEqual(resolveScreenAnnotationPlacement("television"));
  });
});
