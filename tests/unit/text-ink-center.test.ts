import { afterEach, expect, it, vi } from "vitest";
import { centerTextInk } from "../../src/features/brochure/textInkCenter";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("uses measured font ink to center a font with an asymmetric baseline box", () => {
  vi.stubGlobal("CSS", { supports: () => false });
  const measureText = vi.fn(() => ({
    actualBoundingBoxAscent: 8,
    actualBoundingBoxDescent: 0,
    fontBoundingBoxAscent: 7,
    fontBoundingBoxDescent: 3,
  }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText,
    font: "",
  } as unknown as CanvasRenderingContext2D);
  const element = document.createElement("span");
  element.style.textTransform = "uppercase";
  element.textContent = "Telefonat";
  centerTextInk(element);
  expect(measureText).toHaveBeenCalledWith("TELEFONAT");
  expect(element.style.getPropertyValue("--glyph-center-offset")).toBe("2px");
});
it("lets native cap/baseline trimming handle supported renderers without a fixed offset", () => {
  vi.stubGlobal("CSS", { supports: () => true });
  const context = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
  const element = document.createElement("span");
  element.style.setProperty("--glyph-center-offset", "2px");
  centerTextInk(element);
  expect(element.style.getPropertyValue("--glyph-center-offset")).toBe("");
  expect(context).not.toHaveBeenCalled();
});
it("uses the same measured centering for captured details even when native trimming exists", () => {
  vi.stubGlobal("CSS", { supports: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: () => ({
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 0,
      fontBoundingBoxAscent: 7,
      fontBoundingBoxDescent: 3,
    }),
  } as unknown as CanvasRenderingContext2D);
  const element = document.createElement("b");
  element.textContent = "Google TV";
  centerTextInk(element, true, false);
  expect(element.style.getPropertyValue("--glyph-center-offset")).toBe("2px");
});
