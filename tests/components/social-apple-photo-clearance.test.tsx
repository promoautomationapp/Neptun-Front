import React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SocialApplePhotoClearance } from "../../src/features/social/SocialApplePhotoClearance";
import {
  projectNativeArtworkRect,
  rectsOverlap,
  type ArtworkRect,
} from "../../src/features/brochure/applePhotoGeometry";
import redGeometry from "../../src/features/brochure/redPriceGeometry.json";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function geometry(
  previewScale = 1,
  mode: "normal" | "old-band" | "blocked" | "impossible" = "normal",
) {
  let reads = 0;
  const rects: Record<string, ArtworkRect> = {
    canvas: { x: 0, y: 0, width: 1000, height: 1000 },
    area: { x: 100, y: 100, width: 800, height: 600 },
    photo: { x: 150, y: 150, width: 600, height: 400 },
    price:
      mode === "blocked" || mode === "impossible"
        ? { x: 100, y: 100, width: 800, height: 600 }
        : { x: 650, y: 550, width: 250, height: 120 },
    saving: { x: 400, y: 200, width: 120, height: 120 },
    copy: { x: 120, y: 580, width: 300, height: 60 },
    details: { x: 120, y: 650, width: 450, height: 50 },
  };
  if (mode !== "normal")
    for (const key of ["saving", "copy", "details"])
      rects[key] = { x: 0, y: 0, width: 0, height: 0 };
  if (mode === "impossible") rects.copy = { ...rects.canvas! };
  const base = (element: Element) =>
    rects[element.getAttribute("data-rect") || ""] || {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
  vi.stubGlobal("ResizeObserver", undefined);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains("social-canvas") ? 1000 : 0;
    },
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    600,
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(
    400,
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      reads += 1;
      let rect = { ...base(this) };
      const ancestors = [this];
      while (ancestors.at(-1)?.parentElement)
        ancestors.push(ancestors.at(-1)!.parentElement!);
      for (const element of ancestors) {
        if (element.classList.contains("social-canvas")) break;
        if (!(element instanceof HTMLElement || element instanceof SVGElement))
          continue;
        const frame = base(element);
        const scale = Number.parseFloat(element.style.scale) || 1;
        const [dx = 0, dy = 0] = element.style.translate
          .split(/\s+/)
          .map((value) => Number.parseFloat(value) || 0);
        rect = {
          x:
            frame.x +
            frame.width / 2 +
            (rect.x - frame.x - frame.width / 2) * scale +
            dx,
          y:
            frame.y +
            frame.height / 2 +
            (rect.y - frame.y - frame.height / 2) * scale +
            dy,
          width: rect.width * scale,
          height: rect.height * scale,
        };
      }
      return DOMRect.fromRect({
        x: rect.x * previewScale,
        y: rect.y * previewScale,
        width: rect.width * previewScale,
        height: rect.height * previewScale,
      });
    },
  );
  return { reads: () => reads };
}

function fixture(marked = true, nativePrice = true, helper = true) {
  return (
    <div className="social-canvas" data-rect="canvas">
      <div className="social-product" data-rect="area">
        <img
          data-rect="photo"
          data-social-apple-photo={marked ? "true" : undefined}
          src="/iphone.png"
          alt="iPhone"
          style={{
            objectFit: "contain",
            transform: "translate(17%, 8%) scale(1.25)",
          }}
        />
      </div>
      <div className="social-product-copy" data-rect="copy">
        Apple iPhone
      </div>
      <div
        className="social-price-stack"
        data-rect="price"
        style={{ transform: "translate(3cqw, 2cqw) scale(1.1)" }}
      >
        {nativePrice && (
          <svg
            className="red-reference-price-svg"
            data-rect="price"
            viewBox={`0 0 ${redGeometry.parts.saleBand.width} 100`}
          >
            <path d={redGeometry.parts.oldBand.path} />
          </svg>
        )}
      </div>
      <div className="social-savings-block" data-rect="saving" />
      <div className="social-specs" data-rect="details" />
      {helper && <SocialApplePhotoClearance />}
    </div>
  );
}

function rectangle(element: Element): ArtworkRect {
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

it.each([1, 0.5])(
  "keeps the requested Apple photo inside its product frame and clear of every offer layer at preview scale %s",
  (previewScale) => {
    geometry(previewScale);
    const view = render(fixture());
    const image = view.getByAltText("iPhone") as HTMLImageElement;
    const photo = rectangle(image);
    const frame = rectangle(view.container.querySelector(".social-product")!);
    expect(image.style.transform).toBe("translate(17%, 8%) scale(1.25)");
    expect(Number.parseFloat(image.style.scale)).toBeLessThan(1);
    expect(photo.x).toBeGreaterThanOrEqual(frame.x);
    expect(photo.y).toBeGreaterThanOrEqual(frame.y);
    expect(photo.x + photo.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(photo.y + photo.height).toBeLessThanOrEqual(frame.y + frame.height);
    for (const obstacle of view.container.querySelectorAll(
      ".social-price-stack,.social-savings-block,.social-product-copy,.social-specs",
    ))
      expect(rectsOverlap(photo, rectangle(obstacle))).toBe(false);
  },
);

it("includes the regular-price band painted above the red SVG viewport", () => {
  geometry(1, "old-band");
  const view = render(fixture());
  const svg = view.container.querySelector("svg")!;
  const oldBand = projectNativeArtworkRect(
    redGeometry.parts.oldBand,
    rectangle(svg),
    redGeometry.parts.saleBand.width,
  )!;
  expect(oldBand.y).toBeLessThan(rectangle(svg).y);
  expect(rectsOverlap(rectangle(view.getByAltText("iPhone")), oldBand)).toBe(
    false,
  );
});

it("reserves display space when a manually placed overlay covers the complete photo region", () => {
  geometry(1, "blocked");
  const view = render(fixture(true, false));
  const price = view.container.querySelector<HTMLElement>(
    ".social-price-stack",
  )!;
  expect(
    view.container.querySelector<HTMLElement>(".social-canvas")?.dataset
      .socialAppleClearanceLimited,
  ).toBe("true");
  expect(price.style.transform).toBe("translate(3cqw, 2cqw) scale(1.1)");
  expect(price.style.translate).not.toBe("");
  expect(
    rectsOverlap(rectangle(view.getByAltText("iPhone")), rectangle(price)),
  ).toBe(false);
});

it("remeasures requested edits and image readiness without recursively applying its own corrections", async () => {
  const measurements = geometry();
  const view = render(fixture());
  const image = view.getByAltText("iPhone") as HTMLImageElement;
  const original = image.style.transform;
  await act(async () => {
    await Promise.resolve();
  });
  const initialReads = measurements.reads();
  const firstCorrection = image.style.cssText;
  await act(async () => {
    await Promise.resolve();
  });
  expect(measurements.reads()).toBe(initialReads);
  const price = view.container.querySelector<HTMLElement>(
    ".social-price-stack",
  )!;
  price.style.width = "90%";
  await waitFor(() =>
    expect(measurements.reads()).toBeGreaterThan(initialReads),
  );
  expect(image.style.cssText).toBe(firstCorrection);
  expect(image.style.transform).toBe(original);
  const beforeLoad = measurements.reads();
  await act(async () => {
    image.dispatchEvent(new Event("load"));
  });
  expect(measurements.reads()).toBeGreaterThan(beforeLoad);
  view.rerender(fixture(false));
  await waitFor(() => expect(image.style.translate).toBe(""));
  expect(image.style.scale).toBe("");
  view.rerender(fixture());
  await waitFor(() =>
    expect(Number.parseFloat(image.style.scale)).toBeLessThan(1),
  );
  view.rerender(fixture(true, true, false));
  expect(image.style.translate).toBe("");
  expect(image.style.scale).toBe("");
  expect(image.style.transform).toBe(original);
});

it("leaves unmarked product photos unchanged", () => {
  geometry();
  const view = render(fixture(false));
  const image = view.getByAltText("iPhone") as HTMLImageElement;
  expect(image.style.translate).toBe("");
  expect(image.style.scale).toBe("");
});

it("temporarily suppresses a photo when fixed artwork leaves no clear slot anywhere", () => {
  geometry(1, "impossible");
  const view = render(fixture(true, false));
  const image = view.getByAltText("iPhone") as HTMLImageElement;
  expect(image.style.scale).toBe("0");
  expect(image.style.transform).toBe("translate(17%, 8%) scale(1.25)");
  expect(
    view.container.querySelector<HTMLElement>(".social-product-copy")?.style
      .scale,
  ).toBe("");
});
