import { afterEach, expect, it, vi } from "vitest";
import type { ScreenArtwork } from "../../src/domain/models";
import {
  normalizeScreenPhotoSource,
  savedScreenBoxForPhoto,
  screenArtworkForPhotoChange,
  televisionScreenBox,
  visibleImageBounds,
} from "../../src/features/brochure/screenGeometry";

const manualBox = { x: 0.15, y: 0.12, width: 0.72, height: 0.55 };
const artwork: ScreenArtwork = {
  image: "/wallpaper.jpg",
  box: manualBox,
  detectedFor: "/tv-original.png",
  fit: "cover",
};
afterEach(() => vi.restoreAllMocks());

function photo(src: string, currentSrc = "") {
  const image = document.createElement("img");
  image.src = src;
  Object.defineProperties(image, {
    currentSrc: { configurable: true, value: currentSrc },
    naturalWidth: { value: 100 },
    naturalHeight: { value: 80 },
  });
  return image;
}

it("retains a manual screen fit for the same normalized photo source", () => {
  const image = photo("/tv-original.png");
  const product = { image: "/tv-original.png", screenArtwork: artwork };
  expect(televisionScreenBox(product, image)).toEqual(manualBox);
  expect(screenArtworkForPhotoChange(artwork, product.image, image.src)).toBe(
    artwork,
  );
  expect(televisionScreenBox(product, image)).not.toBe(manualBox);
});

it("rejects saved geometry when the product's main photo changes", () => {
  expect(
    savedScreenBoxForPhoto({
      image: "/tv-cropped.png",
      screenArtwork: artwork,
    }),
  ).toBeNull();
  expect(
    televisionScreenBox({ image: "/tv-cropped.png", screenArtwork: artwork }),
  ).toEqual({ x: 0.04, y: 0.08, width: 0.92, height: 0.75 });
});

it("checks the actual bundle artwork photo even when the member's image field is older", () => {
  const image = photo(
    "/tv-original.png",
    new URL("/member-upload.jpg", document.baseURI).href,
  );
  expect(
    savedScreenBoxForPhoto(
      { image: "/tv-original.png", screenArtwork: artwork },
      image,
    ),
  ).toBeNull();
  expect(
    savedScreenBoxForPhoto(
      { image: "/old-member.png", screenArtwork: artwork },
      photo("/tv-original.png"),
    ),
  ).toEqual(manualBox);
});

it("preserves legacy manual boxes until an explicit replacement invalidates them", () => {
  const legacy: ScreenArtwork = {
    image: "/wallpaper.jpg",
    box: manualBox,
    fit: "contain",
  };
  expect(
    savedScreenBoxForPhoto({
      image: "/tv-original.png",
      screenArtwork: legacy,
    }),
  ).toEqual(manualBox);
  expect(
    screenArtworkForPhotoChange(legacy, "/tv-original.png", "/tv-cropped.png"),
  ).toEqual({ image: "/wallpaper.jpg", fit: "contain" });
  expect(legacy.box).toEqual(manualBox);
});

it("removes only source-bound geometry on replacement and never mutates saved wallpaper", () => {
  expect(
    screenArtworkForPhotoChange(artwork, "/tv-original.png", "/tv-cropped.png"),
  ).toEqual({ image: "/wallpaper.jpg", fit: "cover" });
  expect(artwork.box).toEqual(manualBox);
  expect(artwork.detectedFor).toBe("/tv-original.png");
  expect(
    screenArtworkForPhotoChange(undefined, "/old.png", "/new.png"),
  ).toBeUndefined();
});

it("keeps a manual fit during export while treating changed crop parameters as a new image", () => {
  const original = "https://www.neptun-ks.com/tv.png?crop=wide";
  const proxy = `/api/export-image?url=${encodeURIComponent(original)}`;
  expect(normalizeScreenPhotoSource(proxy)).toBe(original);
  expect(
    savedScreenBoxForPhoto({
      image: proxy,
      screenArtwork: { ...artwork, detectedFor: original },
    }),
  ).toEqual(manualBox);
  expect(
    savedScreenBoxForPhoto({
      image: "https://www.neptun-ks.com/tv.png?crop=square",
      screenArtwork: { ...artwork, detectedFor: original },
    }),
  ).toBeNull();
});

it("refits a differently cropped photo locally and shares the bounded sample across geometry consumers", () => {
  const pixels = new Uint8ClampedArray(100 * 80 * 4).fill(255);
  for (let y = 15; y < 50; y++)
    for (let x = 20; x < 80; x++) {
      const offset = (y * 100 + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 40;
    }
  const drawImage = vi.fn();
  const getImageData = vi.fn(() => ({ data: pixels }));
  const context = {
    drawImage,
    getImageData,
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => context,
  );
  const image = photo(
    "/tv-original.png",
    new URL("/tv-cropped.png", document.baseURI).href,
  );
  const product = { image: "/tv-original.png", screenArtwork: artwork };
  expect(televisionScreenBox(product, image)).toEqual({
    x: 0.21,
    y: 0.2,
    width: 0.58,
    height: 0.4125,
  });
  televisionScreenBox(product, image);
  visibleImageBounds(image);
  expect(drawImage).toHaveBeenCalledTimes(1);
  expect(getImageData).toHaveBeenCalledTimes(1);
  Object.defineProperty(image, "currentSrc", {
    value: new URL("/another-crop.png", document.baseURI).href,
  });
  televisionScreenBox(product, image);
  expect(drawImage).toHaveBeenCalledTimes(2);
});

it("uses the safe contained-photo fallback when the local photo cannot be sampled", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
    throw new Error("Tainted canvas");
  });
  expect(
    televisionScreenBox(
      { image: "/new-photo.png", screenArtwork: artwork },
      photo("/new-photo.png"),
    ),
  ).toEqual({ x: 0.04, y: 0.08, width: 0.92, height: 0.75 });
});
