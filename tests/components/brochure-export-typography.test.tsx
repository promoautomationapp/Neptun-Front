import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  brochureExportFontCSS,
  captureBrochurePage,
} from "../../src/features/brochure/BrochureExport";
import { setLanguage } from "../../src/features/brochure/i18n";
import { brochureExportGeometry } from "../../src/features/brochure/brochureFormat";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
function page() {
  const root = document.createElement("section");
  root.style.fontFamily = "SkolaSans";
  root.style.fontSize = "14px";
  root.innerHTML =
    '<svg><text style="font-family: TSTAR Headline; font-size: 29.44px; font-weight: 700">65”</text></svg>';
  document.body.append(root);
  return root;
}
it("includes SVG-only inch fonts in each page's embedded fonts and removes temporary probes", async () => {
  const root = page();
  const embed = vi.fn(async (node: HTMLElement) => {
    // The library discovers HTML descendants only; the SVG family must be bridged.
    expect(
      [...node.querySelectorAll("span")].some((probe) =>
        /TSTAR Headline/.test(probe.style.fontFamily),
      ),
    ).toBe(true);
    return '@font-face{font-family:"TSTAR Headline";src:url(data:font/ttf;base64,font)}';
  });
  expect(await brochureExportFontCSS(root, embed)).toContain("data:font/ttf");
  expect(root.querySelector('[data-export-hide="true"]')).toBeNull();
  root.querySelector("text")!.style.fontFamily = "TSTAR";
  await brochureExportFontCSS(root, async (node) => {
    expect(
      [...node.querySelectorAll("span")].some(
        (probe) => probe.style.fontFamily === "TSTAR",
      ),
    ).toBe(true);
    return "@font-face{font-family:TSTAR;src:url(data:font/ttf;base64,font)}";
  });
});
it("reports missing font resources instead of downloading silently substituted typography", async () => {
  const root = page();
  await expect(
    brochureExportFontCSS(
      root,
      async () => '@font-face{font-family:TSTAR;src:url("")}',
    ),
  ).rejects.toThrow("Brochure fonts could not be loaded");
  expect(root.querySelector('[data-export-hide="true"]')).toBeNull();
});
it.each([false, true])(
  "pins SVG weight, family and exact size during capture and restores them after failure=%s",
  async (fail) => {
    const root = page();
    const geometry = brochureExportGeometry("neptun1080x1350");
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
      width: geometry.previewWidth,
      height: geometry.previewHeight,
    } as DOMRect);
    const canvas = document.createElement("canvas");
    canvas.width = geometry.width;
    canvas.height = geometry.height;
    const toCanvas = vi.fn(async () => {
      const rule = root.querySelector("style")!.textContent;
      expect(rule).toContain('font-family: "TSTAR Headline" !important');
      expect(rule).toContain("font-weight: 700 !important");
      expect(rule).toContain("font-size: 29.44px !important");
      if (fail) throw new Error("Capture failed");
      return canvas;
    });
    if (fail)
      await expect(
        captureBrochurePage(root, geometry, { toCanvas }),
      ).rejects.toThrow("Capture failed");
    else
      expect(await captureBrochurePage(root, geometry, { toCanvas })).toBe(
        canvas,
      );
    expect(root.querySelector("style")).toBeNull();
    expect(root.querySelector("[data-brochure-export-font]")).toBeNull();
    expect(root.querySelector("text")!.style.fontWeight).toBe("700");
  },
);
