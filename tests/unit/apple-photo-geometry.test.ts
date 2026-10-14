import { expect, it } from "vitest";
import {
  fitArtworkInside,
  fitPhotoAroundArtwork,
  projectNativeArtworkRect,
  rectsOverlap,
  type ArtworkRect,
} from "../../src/features/brochure/applePhotoGeometry";

const bounds = { x: 0, y: 0, width: 200, height: 200 };
const expanded = (rect: ArtworkRect, gap: number) => ({
  x: rect.x - gap,
  y: rect.y - gap,
  width: rect.width + gap * 2,
  height: rect.height + gap * 2,
});

it("retains a safe requested image position and aspect ratio", () => {
  const requested = { x: 10, y: 10, width: 80, height: 120 };
  expect(
    fitPhotoAroundArtwork(requested, bounds, [
      { x: 130, y: 90, width: 70, height: 110 },
    ]),
  ).toEqual({ rect: requested, scale: 1 });
});

it("finds the largest clear region beside both a price and its raised savings tab", () => {
  const requested = { x: 20, y: 10, width: 160, height: 180 };
  const artwork = [
    { x: 100, y: 130, width: 100, height: 70 },
    { x: 145, y: 80, width: 55, height: 50 },
  ];
  const result = fitPhotoAroundArtwork(requested, bounds, artwork, 3);
  expect(result).not.toBeNull();
  if (!result) throw new Error("Expected photo space");
  expect(result.scale).toBeCloseTo(127 / 180);
  expect(result.rect.width / result.rect.height).toBeCloseTo(160 / 180);
  for (const part of artwork)
    expect(rectsOverlap(result.rect, expanded(part, 3))).toBe(false);
});

it("handles moved/resized artwork, returns a real obstruction, and does not mutate saved rectangles", () => {
  const requested = { x: 10, y: 10, width: 180, height: 180 };
  const obstruction = { ...bounds };
  const saved = structuredClone({ requested, obstruction });
  expect(fitPhotoAroundArtwork(requested, bounds, [obstruction])).toBeNull();
  expect({ requested, obstruction }).toEqual(saved);
  const lowered = fitArtworkInside(obstruction, {
    x: 0,
    y: 140,
    width: 200,
    height: 160,
  });
  expect(lowered).not.toBeNull();
  const result = fitPhotoAroundArtwork(
    requested,
    bounds,
    lowered ? [lowered.rect] : [],
  );
  expect(result?.scale).toBeCloseTo(137 / 180);
});

it("scales the same solution uniformly in a preview/export frame", () => {
  const requested = { x: 20, y: 0, width: 150, height: 180 };
  const artwork = { x: 100, y: 130, width: 100, height: 70 };
  const scale = (rect: ArtworkRect) => ({
    x: rect.x / 2,
    y: rect.y / 2,
    width: rect.width / 2,
    height: rect.height / 2,
  });
  const original = fitPhotoAroundArtwork(requested, bounds, [artwork], 4);
  const preview = fitPhotoAroundArtwork(
    scale(requested),
    scale(bounds),
    [scale(artwork)],
    2,
  );
  expect(preview?.scale).toBe(original?.scale);
  expect(preview?.rect).toEqual(original && scale(original.rect));
});

it("clamps even oversized saved artwork inside card bounds without stretching", () => {
  const result = fitArtworkInside(
    { x: -50, y: -10, width: 400, height: 100 },
    bounds,
  );
  expect(result).toEqual({
    scale: 0.5,
    rect: { x: 0, y: 15, width: 200, height: 50 },
  });
  expect(
    fitPhotoAroundArtwork({ x: 0, y: 0, width: 0, height: 100 }, bounds, []),
  ).toBeNull();
});

it("projects regular-price overflow above an SVG viewBox as a real artwork obstacle", () => {
  const overflow = projectNativeArtworkRect(
    { x: 50, y: -25, width: 75, height: 25 },
    { x: 100, y: 100, width: 125, height: 65 },
    125,
  );
  expect(overflow).toEqual({ x: 150, y: 75, width: 75, height: 25 });
  const result = fitPhotoAroundArtwork(
    { x: 10, y: 10, width: 180, height: 180 },
    bounds,
    overflow ? [overflow, { x: 100, y: 100, width: 125, height: 65 }] : [],
    3,
  );
  expect(result).not.toBeNull();
  if (overflow && result)
    expect(rectsOverlap(result.rect, expanded(overflow, 3))).toBe(false);
});
