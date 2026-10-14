import React, { useRef } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  ApplePhotoClearance,
  hasApplePhotos,
} from "../../src/features/brochure/ApplePhotoClearance";
import {
  rectsOverlap,
  type ArtworkRect,
} from "../../src/features/brochure/applePhotoGeometry";
import redGeometry from "../../src/features/brochure/redPriceGeometry.json";
import {
  ProductNameDivider,
  materializeProductNameAlignment,
} from "../../src/features/brochure/ProductNameDivider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fixture(marked = true, showClearance = true, withNameDivider = false) {
  function Card() {
    const area = useRef<HTMLDivElement>(null);
    const row = useRef<HTMLDivElement>(null);
    const price = (
      <div
        className="brochure-price"
        style={{ transform: "translate(0px, 0px)" }}
      >
        <span className="reference-saving-tab" />
        <svg className="reference-price-svg">
          {withNameDivider && <rect data-offer-price-divider="true" />}
        </svg>
      </div>
    );
    const article = (
      <article className="brochure-product">
        <div className="brochure-product-image-wrap" ref={area}>
          <div
            className="apple-photo-clearance-primary"
            data-apple-photo-clearance={marked ? "true" : undefined}
          >
            <img
              className="brochure-product-image"
              src="/iphone.png"
              alt="iPhone"
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>
        {withNameDivider ? (
          <div className="brochure-product-bottom" ref={row}>
            <div className="brochure-product-copy">
              <span data-product-name="true">IPHONE 17</span>
            </div>
            {price}
            <ProductNameDivider rowRef={row} />
          </div>
        ) : (
          price
        )}
        <div
          className="product-artwork-item"
          data-apple-photo-clearance={marked ? "true" : undefined}
        >
          <img
            src="/macbook.png"
            alt="MacBook bundle member"
            style={{ objectFit: "contain" }}
          />
        </div>
        {showClearance && <ApplePhotoClearance photoAreaRef={area} />}
      </article>
    );
    return withNameDivider ? (
      <div className="brochure-page">{article}</div>
    ) : (
      article
    );
  }
  return <Card />;
}

function mockGeometry(
  previewScale = 1,
  options: { legacy?: boolean; shortCover?: boolean } = {},
) {
  const cardWidth = options.shortCover ? 300 : 200;
  const cardHeight = options.shortCover ? 204 : 300;
  const areaHeight = options.shortCover ? 4.2 : 200;
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      if (
        this.classList.contains("brochure-product") ||
        this.classList.contains("brochure-product-bottom")
      )
        return cardWidth;
      if (options.legacy) {
        if (this.closest(".brochure-saving")) return 60;
        const price = this.closest<HTMLElement>(".brochure-price");
        if (price) {
          if (this.tagName === "DEL") return 80;
          if (this.closest("strong")) return 105;
          if (this.closest(".brochure-happy-mark")) return 45;
          return Number.parseFloat(price.style.width) || 100;
        }
      }
      return 0;
    },
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    1000,
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(
    1000,
  );
  vi.spyOn(HTMLImageElement.prototype, "clientWidth", "get").mockImplementation(
    function (this: HTMLImageElement) {
      return this.alt === "iPhone"
        ? options.shortCover
          ? 300
          : 180
        : this.alt === "Çmimi haPPy"
          ? 45
          : options.shortCover
            ? 180
            : 60;
    },
  );
  const correction = (
    rect: ArtworkRect,
    element: HTMLElement,
    origin: ArtworkRect,
    manual = { x: 0, y: 0 },
  ): ArtworkRect => {
    const scale = Number.parseFloat(element.style.scale) || 1;
    const translation = element.style.translate
      .split(/\s+/)
      .map(Number.parseFloat);
    const x = origin.x + origin.width / 2,
      y = origin.y + origin.height / 2;
    return {
      x: x + (rect.x + manual.x - x) * scale + (translation[0] || 0),
      y: y + (rect.y + manual.y - y) * scale + (translation[1] || 0),
      width: rect.width * scale,
      height: rect.height * scale,
    };
  };
  const native = (element: Element): ArtworkRect => {
    if (element.classList.contains("brochure-page"))
      return { x: 0, y: 0, width: 1080, height: 1350 };
    if (element.classList.contains("brochure-product-bottom"))
      return { x: 0, y: 200, width: 200, height: 100 };
    if (
      element.classList.contains("brochure-product-copy") ||
      element.hasAttribute("data-product-name")
    ) {
      const copy = element.closest<HTMLElement>(".brochure-product-copy");
      const automatic =
        copy?.style.translate.split(/\s+/).map(Number.parseFloat) || [];
      const manual = copy?.style.transform.match(
        /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/,
      );
      return {
        x: 3 + (automatic[0] || 0) + (Number(manual?.[1]) || 0),
        y:
          (element.hasAttribute("data-product-name") ? 225 : 210) +
          (automatic[1] || 0) +
          (Number(manual?.[2]) || 0),
        width: element.hasAttribute("data-product-name") ? 75 : 90,
        height: element.hasAttribute("data-product-name") ? 20 : 70,
      };
    }
    if (element.classList.contains("brochure-product"))
      return { x: 0, y: 0, width: cardWidth, height: cardHeight };
    if (element.classList.contains("brochure-product-image-wrap"))
      return { x: 0, y: 0, width: cardWidth, height: areaHeight };
    const saving = element.closest<HTMLElement>(".brochure-saving");
    if (saving) {
      const base = { x: 140, y: 50, width: 60, height: 60 };
      return correction(base, saving, base);
    }
    const price = element.closest<HTMLElement>(".brochure-price");
    if (price) {
      const width =
        Number.parseFloat(price.style.width) ||
        (options.shortCover ? 150 : 100);
      const height = options.shortCover
        ? 116
        : options.legacy
          ? 85
          : width === 200
            ? 210
            : 70;
      const base = {
        x: options.shortCover ? 150 : 100,
        y: options.shortCover ? 0 : 220,
        width,
        height,
      };
      const match = price.style.transform.match(
        /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/,
      );
      const manual = { x: Number(match?.[1]) || 0, y: Number(match?.[2]) || 0 };
      let rect = element.hasAttribute("data-offer-price-divider")
        ? { x: base.x, y: base.y + height * 0.6, width, height: 1 }
        : element.classList.contains("reference-saving-tab")
          ? {
              x: base.x + width / 2,
              y: base.y - width * 0.3,
              width: width / 2,
              height: width * 0.3,
            }
          : element.classList.contains("reference-price-increase")
            ? { x: base.x + width - 40, y: base.y - 25, width: 40, height: 25 }
            : base;
      if (options.legacy && element !== price) {
        if (element.closest(".brochure-price-top"))
          rect = {
            x: base.x + width - (element.tagName === "DEL" ? 80 : width),
            y: base.y,
            width: element.tagName === "DEL" ? 80 : width,
            height: 20,
          };
        else if (element.closest("strong"))
          rect = {
            x: base.x + width - 105,
            y: base.y + 20,
            width: 105,
            height: 50,
          };
        else if (element.closest(".brochure-happy-mark"))
          rect = { x: base.x + 5, y: base.y + 25, width: 45, height: 40 };
        else if (element.closest(".brochure-price-month"))
          rect = { x: base.x, y: base.y + 70, width, height: 15 };
        else rect = { x: base.x, y: base.y + 20, width, height: 50 };
      }
      return correction(rect, price, base, manual);
    }
    const wrapper = element.closest<HTMLElement>(
      ".apple-photo-clearance-primary",
    );
    if (wrapper) {
      const manual =
        element instanceof HTMLElement
          ? element.style.transform.match(
              /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/,
            )
          : null;
      return correction(
        element.tagName === "IMG"
          ? {
              x: (options.shortCover ? 0 : 10) + (Number(manual?.[1]) || 0),
              y: (options.shortCover ? 0 : 10) + (Number(manual?.[2]) || 0),
              width: options.shortCover ? 300 : 180,
              height: options.shortCover ? 4.2 : 180,
            }
          : { x: 0, y: 0, width: cardWidth, height: areaHeight },
        wrapper,
        { x: 0, y: 0, width: cardWidth, height: areaHeight },
      );
    }
    const artwork = element.closest<HTMLElement>(".product-artwork-item");
    if (artwork) {
      const length = (value: string, total: number, fallback: number) =>
        value
          ? Number.parseFloat(value) * (value.endsWith("%") ? total / 100 : 1)
          : fallback;
      const width = length(
        artwork.style.width,
        cardWidth,
        options.shortCover ? 180 : 60,
      );
      const base = {
        x: length(
          artwork.style.left,
          cardWidth,
          options.shortCover ? 120 : 130,
        ),
        y: length(
          artwork.style.top,
          cardHeight,
          options.shortCover ? 20.4 : 10,
        ),
        width,
        height: length(artwork.style.height, cardHeight, width),
      };
      return correction(base, artwork, base);
    }
    return { x: 0, y: 0, width: 0, height: 0 };
  };
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const rect = native(this);
      return DOMRect.fromRect({
        x: rect.x * previewScale,
        y: rect.y * previewScale,
        width: rect.width * previewScale,
        height: rect.height * previewScale,
      });
    },
  );
  if (options.legacy) {
    const originalRange = document.createRange.bind(document);
    vi.spyOn(document, "createRange").mockImplementation(() => {
      const range = originalRange();
      Object.defineProperty(range, "getClientRects", {
        value: () => {
          const parent = range.startContainer.parentElement;
          if (!parent) return [];
          const price = parent.closest<HTMLElement>(".brochure-price");
          if (!price) return [parent.getBoundingClientRect()];
          const width = Number.parseFloat(price.style.width) || 100;
          const base = { x: 100, y: 220, width, height: 85 };
          const manual = price.style.transform.match(
            /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/,
          );
          const rect = parent.classList.contains("brochure-price-month")
            ? correction(
                {
                  x: base.x + width - 120,
                  y: base.y + 70,
                  width: 120,
                  height: 15,
                },
                price,
                base,
                { x: Number(manual?.[1]) || 0, y: Number(manual?.[2]) || 0 },
              )
            : native(parent);
          return [
            DOMRect.fromRect({
              x: rect.x * previewScale,
              y: rect.y * previewScale,
              width: rect.width * previewScale,
              height: rect.height * previewScale,
            }),
          ];
        },
      });
      return range;
    });
  }
}

function clearOfArtwork(container: HTMLElement) {
  const parts = [
    ...container.querySelectorAll(".reference-price-svg,.reference-saving-tab"),
  ].map((element) => element.getBoundingClientRect());
  for (const image of container.querySelectorAll<HTMLImageElement>("img")) {
    const rect = image.getBoundingClientRect();
    const scale = Math.min(
      rect.width / image.naturalWidth,
      rect.height / image.naturalHeight,
    );
    const width = image.naturalWidth * scale,
      height = image.naturalHeight * scale;
    const photo = {
      x: rect.x + (rect.width - width) / 2,
      y: rect.y + (rect.height - height) / 2,
      width,
      height,
    };
    for (const part of parts) {
      const obstacle = {
        x: part.x,
        y: part.y,
        width: part.width,
        height: part.height,
      };
      expect(rectsOverlap(photo, obstacle)).toBe(false);
    }
  }
}

function paintedFixture(shortCover = false) {
  function Card() {
    const area = useRef<HTMLDivElement>(null);
    return (
      <div className="brochure-page">
        <article className="brochure-product">
          <div className="brochure-product-image-wrap" ref={area}>
            <div
              className="apple-photo-clearance-primary"
              data-apple-photo-clearance="true"
            >
              <img
                className="brochure-product-image"
                src="/iphone.png"
                alt="iPhone"
                style={{ objectFit: "contain" }}
              />
            </div>
            {!shortCover && (
              <span
                className="brochure-saving"
                style={{ boxShadow: "0 .5cqw 1cqw rgba(0, 30, 54, .25)" }}
              >
                <i>KURSENI</i>
                <b className="brochure-saving-amount">
                  250<small>€</small>
                </b>
              </span>
            )}
          </div>
          <div
            className="brochure-price"
            style={{
              transform: "translate(0px, 0px)",
              ...(shortCover
                ? {}
                : { boxShadow: "2px 3px 4px rgba(0, 0, 0, .2)" }),
            }}
          >
            {shortCover ? (
              <svg className="reference-price-svg" />
            ) : (
              <>
                <div className="brochure-price-top">
                  <del>1699 €</del>
                </div>
                <div className="brochure-price-sale">
                  <span className="brochure-happy-mark">
                    <img src="/happy.svg" alt="Çmimi haPPy" />
                  </span>
                  <strong>
                    <span>1449</span>
                    <small>€</small>
                  </strong>
                </div>
                <div className="brochure-price-month">
                  <span>KËSTI </span>12 × 120.8 €
                </div>
                <span data-export-hide="true">Drag price</span>
              </>
            )}
          </div>
          <div
            className="product-artwork-item"
            data-apple-photo-clearance="true"
            style={
              shortCover ? { left: "40%", top: "10%", width: "60%" } : undefined
            }
          >
            <img
              src="/macbook.png"
              alt="MacBook bundle member"
              style={{ objectFit: "contain" }}
            />
          </div>
          <ApplePhotoClearance photoAreaRef={area} />
        </article>
      </div>
    );
  }
  return <Card />;
}

function expectLegacyPaintClearance(
  container: HTMLElement,
  previewScale: number,
) {
  const price = container.querySelector<HTMLElement>(".brochure-price");
  const saving = container.querySelector<HTMLElement>(".brochure-saving");
  if (!price || !saving) throw new Error("Missing legacy artwork");
  const parts = [
    price,
    saving,
    ...price.querySelectorAll<HTMLElement>("*:not([data-export-hide])"),
  ].map((element) => element.getBoundingClientRect());
  const walker = document.createTreeWalker(price, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (
      !node.textContent?.trim() ||
      node.parentElement?.closest("[data-export-hide]")
    )
      continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    parts.push(...Array.from(range.getClientRects()));
  }
  const shadow = (
    element: HTMLElement,
    dx: number,
    dy: number,
    extent: number,
  ) => {
    const rect = element.getBoundingClientRect();
    const factor = rect.width / element.offsetWidth;
    return DOMRect.fromRect({
      x: rect.x + (dx - extent) * factor,
      y: rect.y + (dy - extent) * factor,
      width: rect.width + extent * 2 * factor,
      height: rect.height + extent * 2 * factor,
    });
  };
  parts.push(shadow(saving, 0, 5.4, 16.2), shadow(price, 2, 3, 6));
  for (const image of container.querySelectorAll<HTMLImageElement>(
    '[data-apple-photo-clearance="true"] img',
  )) {
    const rect = image.getBoundingClientRect();
    for (const part of parts.filter(
      (part) => part.width > 0 && part.height > 0,
    )) {
      const gap = 3 * previewScale;
      expect(
        rectsOverlap(rect, {
          x: part.x - gap,
          y: part.y - gap,
          width: part.width + gap * 2,
          height: part.height + gap * 2,
        }),
      ).toBe(false);
    }
  }
}

it("fits primary and bundle Apple photos during a live unsaved price move and resize, then settles", async () => {
  mockGeometry(0.5);
  const view = render(fixture());
  clearOfArtwork(view.container);
  const price = view.container.querySelector<HTMLElement>(".brochure-price");
  const card = view.container.querySelector<HTMLElement>(".brochure-product");
  if (!price || !card) throw new Error("Missing artwork");
  const resync = vi.fn();
  view.container
    .querySelector(".brochure-product-image-wrap")
    ?.addEventListener("brochure-photo-clearance", resync);
  await act(async () => {
    price.style.width = "200px";
    price.style.transform = "translate(-100px, -220px)";
    price.querySelector(".reference-saving-tab")?.remove();
    await Promise.resolve();
    await Promise.resolve();
  });
  clearOfArtwork(view.container);
  expect(card.dataset.appleClearanceLimited).toBe("true");
  expect(price.style.transform).toBe("translate(-100px, -220px)");
  expect(price.style.width).toBe("200px");
  expect(Number.parseFloat(price.style.scale)).toBeLessThan(1);
  expect(resync).toHaveBeenCalled();
  const displayed = [
    ...view.container.querySelectorAll<HTMLElement>(
      "[data-apple-photo-clearance],.brochure-price",
    ),
  ].map((element) => element.getAttribute("style"));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(
    [
      ...view.container.querySelectorAll<HTMLElement>(
        "[data-apple-photo-clearance],.brochure-price",
      ),
    ].map((element) => element.getAttribute("style")),
  ).toEqual(displayed);
  view.unmount();
  expect(price.style.translate).toBe("");
  expect(price.style.scale).toBe("");
  expect(price.style.transform).toBe("translate(-100px, -220px)");
});

it("protects legacy Apple text, logo and separate white badge shadows after a live narrow price move", async () => {
  mockGeometry(0.5, { legacy: true });
  const view = render(paintedFixture());
  expectLegacyPaintClearance(view.container, 0.5);
  const price = view.container.querySelector<HTMLElement>(".brochure-price");
  const saving = view.container.querySelector<HTMLElement>(".brochure-saving");
  const month = price?.querySelector(".brochure-price-month");
  if (!price || !saving || !month?.lastChild)
    throw new Error("Missing legacy fixture");
  await act(async () => {
    price.style.width = "45px";
    price.style.transform = "translate(-90px, -185px)";
    await Promise.resolve();
  });
  const range = document.createRange();
  range.selectNodeContents(month.lastChild);
  expect(range.getClientRects()[0]?.left).toBeLessThan(
    month.getBoundingClientRect().left,
  );
  expectLegacyPaintClearance(view.container, 0.5);
  expect(price.style.width).toBe("45px");
  expect(price.style.transform).toBe("translate(-90px, -185px)");
  expect(saving.style.boxShadow).toContain("cqw");
  const snapshot = view.container.innerHTML;
  await act(async () => {
    for (let index = 0; index < 8; index++) await Promise.resolve();
  });
  expect(view.container.innerHTML).toBe(snapshot);
  view.unmount();
  expect(price.style.width).toBe("45px");
  expect(price.style.transform).toBe("translate(-90px, -185px)");
  expect(price.style.scale).toBe("");
  expect(price.style.translate).toBe("");
  expect(saving.style.scale).toBe("");
  expect(saving.style.translate).toBe("");
});

it("includes a native higher-price warning above the SVG as a photo obstacle", async () => {
  mockGeometry(0.5);
  const view = render(fixture());
  const price = view.container.querySelector<HTMLElement>(".brochure-price");
  if (!price) throw new Error("Missing price");
  const warning = document.createElement("span");
  warning.className = "reference-price-increase brochure-price-warning";
  warning.textContent = "−12%";
  await act(async () => {
    price.querySelector(".reference-saving-tab")?.remove();
    price.append(warning);
    price.style.transform = "translate(-25px, -100px)";
    await Promise.resolve();
  });
  clearOfArtwork(view.container);
  const rect = warning.getBoundingClientRect();
  const gap = 1.5;
  for (const image of view.container.querySelectorAll<HTMLImageElement>("img"))
    expect(
      rectsOverlap(image.getBoundingClientRect(), {
        x: rect.x - gap,
        y: rect.y - gap,
        width: rect.width + gap * 2,
        height: rect.height + gap * 2,
      }),
    ).toBe(false);
  expect(price.style.transform).toBe("translate(-25px, -100px)");
});

it("keeps an added Apple photo visible and clear when a cover photo wrap is only 4.2 canonical pixels high", async () => {
  mockGeometry(0.5, { shortCover: true });
  const view = render(paintedFixture(true));
  clearOfArtwork(view.container);
  const extra = view.container.querySelector<HTMLElement>(
    ".product-artwork-item",
  );
  const primary = view.container.querySelector<HTMLImageElement>(
    ".brochure-product-image",
  );
  const area = view.container.querySelector(".brochure-product-image-wrap");
  if (!extra || !primary || !area) throw new Error("Missing cover fixture");
  expect(extra.style.left).toBe("40%");
  expect(extra.style.top).toBe("10%");
  expect(extra.style.width).toBe("60%");
  expect(extra.getBoundingClientRect().width).toBeGreaterThan(4.2 * 0.5);
  const actual = primary.getBoundingClientRect();
  const drawScale = Math.min(
    actual.width / primary.naturalWidth,
    actual.height / primary.naturalHeight,
  );
  const actualHeight = primary.naturalHeight * drawScale;
  const top = actual.y + (actual.height - actualHeight) / 2;
  expect(top).toBeGreaterThanOrEqual(area.getBoundingClientRect().top);
  expect(top + actualHeight).toBeLessThanOrEqual(
    area.getBoundingClientRect().bottom,
  );
  const price = view.container
    .querySelector(".reference-price-svg")
    ?.getBoundingClientRect();
  const photo = extra.getBoundingClientRect();
  if (!price) throw new Error("Missing cover price");
  expect(
    rectsOverlap(photo, {
      x: price.x - 1.5,
      y: price.y - 1.5,
      width: price.width + 3,
      height: price.height + 3,
    }),
  ).toBe(false);
});

it("does not change an unmarked non-Apple card and restores corrections when the marker is removed", async () => {
  mockGeometry();
  const unmarked = render(fixture(false));
  expect(
    unmarked.container.querySelector<HTMLElement>(".brochure-price")?.style
      .translate,
  ).toBe("");
  unmarked.unmount();
  const view = render(fixture());
  const price = view.container.querySelector<HTMLElement>(".brochure-price");
  if (!price) throw new Error("Missing price");
  await act(async () => {
    for (const element of view.container.querySelectorAll(
      "[data-apple-photo-clearance]",
    ))
      element.removeAttribute("data-apple-photo-clearance");
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(price.style.translate).toBe("");
  expect(price.style.scale).toBe("");
});

it("recognizes Apple bundle members while rejecting compatible-device accessory brands", () => {
  expect(hasApplePhotos({ brand: "BELKIN", name: "IPHONE COVER" })).toBe(false);
  expect(
    hasApplePhotos({
      name: "BUNDLE",
      bundleProducts: [{ code: "m", name: "MacBook Air", brand: "APPLE" }],
    }),
  ).toBe(true);
});

it("uses the rendered portrait dimensions and follows photo move/cancel without overwriting the requested transform", async () => {
  mockGeometry();
  vi.spyOn(
    HTMLImageElement.prototype,
    "naturalWidth",
    "get",
  ).mockImplementation(function (this: HTMLImageElement) {
    return this.alt === "iPhone" ? 500 : 1000;
  });
  const view = render(fixture());
  const photo = view.container.querySelector<HTMLImageElement>(
    ".brochure-product-image",
  );
  const wrapper = photo?.parentElement;
  if (!photo || !wrapper) throw new Error("Missing portrait");
  expect(wrapper.style.scale).toBe("");
  const initialTranslation = wrapper.style.translate;
  await act(async () => {
    photo.style.transform = "translate(80px, 100px)";
    await Promise.resolve();
    await Promise.resolve();
  });
  clearOfArtwork(view.container);
  expect(photo.style.transform).toBe("translate(80px, 100px)");
  await act(async () => {
    photo.style.transform = "translate(0px, 0px)";
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(wrapper.style.scale).toBe("");
  expect(wrapper.style.translate).toBe(initialTranslation);
});

it("keeps scale-down dimensions correct at half preview scale", async () => {
  mockGeometry(0.5);
  const view = render(fixture());
  const photo = view.container.querySelector<HTMLImageElement>(
    ".brochure-product-image",
  );
  if (!photo) throw new Error("Missing photo");
  await act(async () => {
    photo.style.objectFit = "scale-down";
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(photo.parentElement?.style.scale).toBe("");
  clearOfArtwork(view.container);
});

it("keeps an Apple bundle photo clear of the red regular-price band above the viewBox", async () => {
  mockGeometry();
  const view = render(fixture());
  const price = view.container.querySelector<HTMLElement>(".brochure-price");
  const svg = price?.querySelector("svg");
  if (!price || !svg) throw new Error("Missing red price");
  await act(async () => {
    price.querySelector(".reference-saving-tab")?.remove();
    svg.setAttribute("class", "red-reference-price-svg");
    svg.setAttribute(
      "viewBox",
      `0 0 ${redGeometry.parts.saleBand.width} ${redGeometry.parts.installmentBand.y + redGeometry.parts.installmentBand.height}`,
    );
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", redGeometry.parts.oldBand.path);
    svg.append(path);
    price.style.transform = "translate(0px, -80px)";
    await Promise.resolve();
    await Promise.resolve();
  });
  clearOfArtwork(view.container);
  const body = svg.getBoundingClientRect();
  const factor = body.width / redGeometry.parts.saleBand.width;
  const band = redGeometry.parts.oldBand;
  const oldPrice = {
    x: body.x + band.x * factor,
    y: body.y + band.y * factor,
    width: band.width * factor,
    height: band.height * factor,
  };
  for (const image of view.container.querySelectorAll("img")) {
    const rect = image.getBoundingClientRect();
    expect(
      rectsOverlap(
        { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        oldPrice,
      ),
    ).toBe(false);
  }
});

it("protects photo and native SVG shadow footprints as well as the price body", async () => {
  mockGeometry();
  const view = render(fixture());
  const price = view.container.querySelector<HTMLElement>(".brochure-price");
  const svg = price?.querySelector("svg");
  const photo = view.container.querySelector<HTMLImageElement>(
    ".brochure-product-image",
  );
  if (!price || !svg || !photo) throw new Error("Missing shadow fixture");
  await act(async () => {
    svg.setAttribute("viewBox", "0 0 100 70");
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const filter = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "filter",
    );
    const shadow = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "feDropShadow",
    );
    shadow.setAttribute("dx", "4");
    shadow.setAttribute("dy", "4");
    shadow.setAttribute("stdDeviation", "3");
    filter.append(shadow);
    defs.append(filter);
    svg.append(defs);
    photo.style.filter = "drop-shadow(0px 6px 4px rgba(0, 0, 0, 0.3))";
    price.style.transform = "translate(0px, -90px)";
    await Promise.resolve();
    await Promise.resolve();
  });
  const body = svg.getBoundingClientRect();
  const priceFactor = body.width / 100;
  const paintedPrice = {
    x: body.x - 5 * priceFactor,
    y: body.y - 5 * priceFactor,
    width: body.width + 18 * priceFactor,
    height: body.height + 18 * priceFactor,
  };
  const image = photo.getBoundingClientRect();
  const photoFactor = image.width / photo.clientWidth;
  const paintedPhoto = {
    x: image.x - 12 * photoFactor,
    y: image.y - 6 * photoFactor,
    width: image.width + 24 * photoFactor,
    height: image.height + 24 * photoFactor,
  };
  expect(
    rectsOverlap(paintedPhoto, {
      x: paintedPrice.x - 3,
      y: paintedPrice.y - 3,
      width: paintedPrice.width + 6,
      height: paintedPrice.height + 6,
    }),
  ).toBe(false);
  expect(paintedPrice.x).toBeGreaterThanOrEqual(3 - 0.000001);
  expect(paintedPrice.x + paintedPrice.width).toBeLessThanOrEqual(
    197 + 0.000001,
  );
});

it("protects a bundle/additional photo while its displayed size and position change", async () => {
  mockGeometry();
  const view = render(fixture());
  const member = view.container.querySelector<HTMLElement>(
    ".product-artwork-item",
  );
  if (!member) throw new Error("Missing bundle photo");
  const initialCorrection = member.style.translate;
  await act(async () => {
    member.style.left = "50%";
    member.style.top = "50%";
    member.style.width = "90%";
    await Promise.resolve();
    await Promise.resolve();
  });
  clearOfArtwork(view.container);
  expect(member.style.left).toBe("50%");
  expect(member.style.top).toBe("50%");
  expect(member.style.width).toBe("90%");
  await act(async () => {
    member.style.left = "130px";
    member.style.top = "10px";
    member.style.width = "60px";
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(member.style.translate).toBe(initialCorrection);
  expect(member.style.scale).toBe("");
});

it("settles both observers after live price/name edits and keeps photos clear", async () => {
  mockGeometry(0.5);
  const view = render(fixture(true, true, true));
  const price = view.container.querySelector<HTMLElement>(".brochure-price");
  const copy = view.container.querySelector<HTMLElement>(
    ".brochure-product-copy",
  );
  const line = view.container.querySelector<HTMLElement>(
    ".brochure-product-name-divider",
  );
  if (!price || !copy || !line) throw new Error("Missing combined fixture");
  await waitFor(() => expect(line.dataset.active).toBe("true"));
  clearOfArtwork(view.container);

  await act(async () => {
    price.style.width = "130px";
    price.style.transform = "translate(-35px, -80px)";
    for (let index = 0; index < 6; index++) await Promise.resolve();
  });
  clearOfArtwork(view.container);
  const boundary = view.container
    .querySelector("[data-offer-price-divider]")
    ?.getBoundingClientRect();
  const row = view.container
    .querySelector(".brochure-product-bottom")
    ?.getBoundingClientRect();
  if (!boundary || !row) throw new Error("Missing boundary");
  expect(Number.parseFloat(line.style.top)).toBeCloseTo(
    (boundary.top - row.top) / 0.5,
  );

  const alignedStyle = copy.style.cssText;
  const offset = materializeProductNameAlignment(copy, 540, 0.5);
  const savedTransform = `translate(15px, ${(offset.y / 100) * 1080 + 5}px)`;
  await act(async () => {
    copy.style.transform = savedTransform;
    for (let index = 0; index < 6; index++) await Promise.resolve();
  });
  expect(copy.style.translate).toBe("");
  expect(copy.style.transform).toBe(savedTransform);
  clearOfArtwork(view.container);
  await act(async () => {
    copy.style.cssText = alignedStyle;
    delete copy.dataset.nameDividerManual;
    for (let index = 0; index < 6; index++) await Promise.resolve();
  });
  clearOfArtwork(view.container);
  await act(async () => {
    for (let index = 0; index < 6; index++) await Promise.resolve();
  });
  const snapshot = view.container.innerHTML;
  const reads = vi.mocked(Element.prototype.getBoundingClientRect).mock.calls
    .length;
  await act(async () => {
    for (let index = 0; index < 8; index++) await Promise.resolve();
  });
  expect(view.container.innerHTML).toBe(snapshot);
  expect(
    vi.mocked(Element.prototype.getBoundingClientRect).mock.calls.length,
  ).toBe(reads);
  expect(price.style.transform).toBe("translate(-35px, -80px)");
  expect(price.style.width).toBe("130px");
});
