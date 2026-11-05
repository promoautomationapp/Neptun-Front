import { afterEach, expect, it, vi } from "vitest";
import {
  televisionScreenBox,
  televisionScreenBoxFromPixels,
  savedScreenBoxForPhoto,
  detectedTelevisionScreenBox,
} from "../../src/features/brochure/screenGeometry";
import { fitTvWallpaperTargets } from "../../src/features/brochure/tvWallpaperFit";

afterEach(() => vi.restoreAllMocks());

function framedTV(background: "transparent" | "white" | "grey", thick = false) {
  const width = 400,
    height = 300;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const frame = { x: 40, y: 35, width: 320, height: 190 };
  const display = thick
    ? { x: 54, y: 45, width: 292, height: 150 }
    : { x: 44, y: 39, width: 312, height: 176 };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const fill = background === "grey" ? 205 : 255;
      pixels.set(
        [fill, fill, fill, background === "transparent" ? 0 : 255],
        offset,
      );
      if (
        (x >= frame.x &&
          x < frame.x + frame.width &&
          y >= frame.y &&
          y < frame.y + frame.height) ||
        (y >= 225 && y < 252 && ((x >= 58 && x < 78) || (x >= 322 && x < 342)))
      )
        pixels.set([20, 20, 20, 255], offset);
      if (
        x >= display.x &&
        x < display.x + display.width &&
        y >= display.y &&
        y < display.y + display.height
      )
        pixels.set([110 + (x % 30), 75 + (y % 20), 30, 255], offset);
    }
  return { width, height, pixels, display };
}

it.each(["transparent", "white", "grey"] as const)(
  "finds the inner display without %s margins, bezel or separated feet",
  (background) => {
    const { pixels, width, height, display } = framedTV(background);
    const box = televisionScreenBoxFromPixels(pixels, width, height)!;
    expect(box).not.toBeNull();
    expect(box.x * width).toBe(display.x);
    expect(box.y * height).toBe(display.y);
    expect(box.width * width).toBe(display.width);
    expect(box.height * height).toBe(display.height);
    expect((box.y + box.height) * height).toBeLessThan(225);
  },
);

it("keeps a thick lower speaker bezel outside the wallpaper", () => {
  const { pixels, width, height, display } = framedTV("white", true);
  const box = televisionScreenBoxFromPixels(pixels, width, height)!;
  expect(box).toEqual({
    x: display.x / width,
    y: display.y / height,
    width: display.width / width,
    height: display.height / height,
  });
});

it("does not mistake white screen lettering for a gap between TV feet", () => {
  const { pixels, width, height, display } = framedTV("white");
  for (let y = 110; y < 145; y++)
    for (let x = 95; x < 305; x++)
      pixels.set([255, 255, 255, 255], (y * width + x) * 4);
  const box = televisionScreenBoxFromPixels(pixels, width, height)!;
  expect(box.y * height).toBe(display.y);
  expect(box.height * height).toBe(display.height);
});

it("does not paint a guessed generic rectangle when the TV pixels cannot be sampled", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const image = document.createElement("img");
  image.src = "/unreadable-tv.png";
  Object.defineProperties(image, {
    naturalWidth: { value: 400 },
    naturalHeight: { value: 300 },
  });
  expect(
    detectedTelevisionScreenBox(
      {
        image: "/unreadable-tv.png",
        screenArtwork: {
          image: "/wallpaper.jpg",
          box: { x: 0.04, y: 0.08, width: 0.92, height: 0.75 },
        },
      },
      image,
    ),
  ).toBeNull();
});

it("replaces an old oversized saved rectangle with the current photo's actual display", async () => {
  const { pixels, width, height, display } = framedTV("transparent");
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage() {},
    getImageData: () => ({ data: pixels }),
  } as unknown as CanvasRenderingContext2D);
  const image = document.createElement("img");
  image.src = "/wrong-saved-fit.png";
  Object.defineProperties(image, {
    naturalWidth: { value: width },
    naturalHeight: { value: height },
  });
  const product = {
    code: "TV",
    name: "TV LED",
    subcategory: "TV",
    image: "/wrong-saved-fit.png",
    screenArtwork: {
      image: "/old-wallpaper.jpg",
      box: { x: 0.01, y: 0.01, width: 0.98, height: 0.98 },
    },
  };
  const expected = {
    x: display.x / width,
    y: display.y / height,
    width: display.width / width,
    height: display.height / height,
  };
  expect(televisionScreenBox(product, image)).toEqual(expected);
  const plan = await fitTvWallpaperTargets([product], {
    loadImage: async () => image,
  });
  expect(plan.fits[0]?.box).toEqual(expected);
  expect(plan.unfittedCodes).toEqual([]);
});

it.each([
  { x: -0.1, y: 0.1, width: 0.8, height: 0.5 },
  { x: 0.1, y: 0.1, width: 1.1, height: 0.5 },
  { x: 0.1, y: 0.9, width: 0.8, height: 0.5 },
  { x: 0.1, y: Number.NaN, width: 0.8, height: 0.5 },
])("does not trust invalid legacy display geometry %j", (box) => {
  expect(
    savedScreenBoxForPhoto({
      image: "/photo.png",
      screenArtwork: { image: "/wallpaper.jpg", box },
    }),
  ).toBeNull();
});
