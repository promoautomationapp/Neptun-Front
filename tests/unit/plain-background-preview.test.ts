import { afterEach, expect, it, vi } from "vitest";
import { plainBackgroundPreview } from "../../src/features/social/plainBackgroundPreview";
const originalContext = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  "getContext",
)!;
class PreviewImage {
  naturalWidth = 5;
  naturalHeight = 5;
  crossOrigin = "";
  src = "";
  async decode() {}
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(
    HTMLCanvasElement.prototype,
    "getContext",
    originalContext,
  );
});
it("returns no preview when a 2D canvas is unavailable", async () => {
  vi.stubGlobal("Image", PreviewImage);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  expect(await plainBackgroundPreview("/photo.png")).toBeNull();
});
it("clears only border-connected white pixels and preserves enclosed white product details", async () => {
  vi.stubGlobal("Image", PreviewImage);
  const pixels = new Uint8ClampedArray(5 * 5 * 4).fill(255);
  for (let y = 1; y < 4; y++)
    for (let x = 1; x < 4; x++) {
      const offset = (y * 5 + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 40;
    }
  const center = (2 * 5 + 2) * 4;
  pixels[center] = pixels[center + 1] = pixels[center + 2] = 255;
  const frame: ImageData = {
    data: pixels,
    width: 5,
    height: 5,
    colorSpace: "srgb",
  };
  const context: Pick<
    CanvasRenderingContext2D,
    "drawImage" | "getImageData" | "putImageData"
  > = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => frame),
    putImageData: vi.fn(),
  };
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: () => context,
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/png;base64,preview",
  );
  expect(await plainBackgroundPreview("/photo.png")).toBe(
    "data:image/png;base64,preview",
  );
  expect(pixels[3]).toBe(0);
  expect(pixels[center + 3]).toBe(255);
  expect(pixels[(1 * 5 + 1) * 4 + 3]).toBe(255);
  expect(context.putImageData).toHaveBeenCalledWith(frame, 0, 0);
});
