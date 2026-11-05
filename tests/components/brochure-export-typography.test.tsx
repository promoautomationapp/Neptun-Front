import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  brochureExportFontCSS,
  captureBrochurePage,
  readyImages,
  missingExportPhotos,
} from "../../src/features/brochure/BrochureExport";
import { setLanguage } from "../../src/features/brochure/i18n";
import { brochureExportGeometry } from "../../src/features/brochure/brochureFormat";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("leaves blank space for failed photos while preserving loaded photos during export", async () => {
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  const root = document.createElement("section");
  root.innerHTML =
    '<img src="/missing.png" alt="Missing product"><img src="/good.png">';
  const [missing, loaded] = root.querySelectorAll("img");
  Object.defineProperties(missing!, {
    complete: { value: true },
    naturalWidth: { value: 0 },
  });
  Object.defineProperties(loaded!, {
    complete: { value: true },
    naturalWidth: { value: 300 },
  });
  vi.spyOn(missing!, "getBoundingClientRect").mockReturnValue({
    width: 280,
    height: 190,
  } as DOMRect);
  await readyImages(root);
  expect(missing!.style.visibility).toBe("hidden");
  expect(missing!.style.width).toBe("280px");
  expect(missing!.style.height).toBe("190px");
  expect(missing!.src).toMatch(/^data:image\/gif;base64,/);
  expect(loaded!.getAttribute("src")).toBe("/good.png");
  expect(loaded!.style.visibility).toBe("");
});

it("continues exporting when a photo never finishes loading", async () => {
  vi.useFakeTimers();
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  const root = document.createElement("section");
  root.innerHTML = '<img src="/stalled.png">';
  const image = root.querySelector("img")!;
  Object.defineProperties(image, {
    complete: { value: false },
    naturalWidth: { value: 0 },
  });
  const preparing = readyImages(root);
  await vi.advanceTimersByTimeAsync(10_000);
  await preparing;
  expect(image.style.visibility).toBe("hidden");
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
it("identifies missing photos by product, code and page, including set members", () => {
  expect(
    missingExportPhotos(
      [
        { code: "84001", name: "Phone" },
        { code: "hidden", name: "Intentionally hidden", showImage: false },
        { code: "found", name: "Ready", image: "/ready.png" },
        {
          code: "set",
          name: "Set",
          bundleProducts: [
            { code: "84002", name: "Oven" },
            { code: "84003", name: "Hob", localImage: "/hob.png" },
          ],
        },
      ],
      "Page 2",
    ),
  ).toEqual(["Page 2 · Phone (84001)", "Page 2 · Oven (84002)"]);
});
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
it("requires the original Cera Pro headline font to be embedded for cover exports", async () => {
  const root = document.createElement("section");
  root.style.fontFamily = '"Cera Pro"';
  root.style.fontWeight = "700";
  root.textContent = "Çmimet flasin vetë!";
  document.body.append(root);
  await expect(brochureExportFontCSS(root, async () => "")).rejects.toThrow(
    "Brochure fonts could not be loaded",
  );
  const css =
    '@font-face{font-family:"Cera Pro";font-weight:700;src:url(data:font/otf;base64,font)}';
  expect(await brochureExportFontCSS(root, async () => css)).toBe(css);
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
    const toCanvas = vi.fn(
      async (
        _page: HTMLElement,
        options?: { imagePlaceholder?: string; includeQueryParams?: boolean },
      ) => {
        expect(options?.imagePlaceholder).toMatch(/^data:image\/gif;base64,/);
        expect(options?.includeQueryParams).toBe(true);
        const rule = root.querySelector("style")!.textContent;
        expect(rule).toContain('font-family: "TSTAR Headline" !important');
        expect(rule).toContain("font-weight: 700 !important");
        expect(rule).toContain("font-size: 29.44px !important");
        if (fail) throw new Error("Capture failed");
        return canvas;
      },
    );
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
