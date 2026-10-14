import React, { useRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import {
  ProductNameDivider,
  materializeProductNameAlignment,
} from "../../src/features/brochure/ProductNameDivider";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const rect = (
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  toJSON: () => ({}),
});

function fixture(native: boolean, manual: boolean) {
  let movement = 0;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      if (this.classList.contains("brochure-page"))
        return rect(0, 0, 1080, 1350);
      if (this.classList.contains("brochure-product-bottom"))
        return rect(0, 100, 500, 130);
      if (this.hasAttribute("data-offer-price-divider"))
        return rect(350, 150 + movement, 150, 1);
      if (this.classList.contains("brochure-price-sale"))
        return rect(350, 120 + movement, 150, 30);
      if (this.classList.contains("brochure-price-month"))
        return rect(390, 151 + movement, 110, 40);
      if (this.classList.contains("product-name")) {
        const translate = (this.parentElement?.style.translate ?? "").match(
          / (-?[\d.]+)px$/,
        );
        const savedMove = this.parentElement?.style.transform.match(
          /translateY\((-?[\d.]+)px\)/,
        );
        return rect(
          0,
          130 + Number(translate?.[1] ?? 0) + Number(savedMove?.[1] ?? 0),
          230,
          20,
        );
      }
      return rect(0, 0, 1, 1);
    },
  );
  function Harness() {
    const rowRef = useRef<HTMLDivElement>(null);
    return (
      <div className="brochure-page">
        <article className="brochure-product">
          <div className="brochure-product-bottom" ref={rowRef}>
            <div
              className="brochure-product-copy"
              style={{ transform: manual ? "translate(2cqw,3cqw)" : undefined }}
            >
              <span className="brochure-colors">Color dots</span>
              <strong>beko</strong>
              <span className="product-name" data-product-name="true">
                RROBALARËSE B3WFU49215WPBB
              </span>
            </div>
            <div className="brochure-price">
              {native ? (
                <svg>
                  <rect data-offer-price-divider="true" />
                </svg>
              ) : (
                <>
                  <div className="brochure-price-sale">299 €</div>
                  <div className="brochure-price-month">KËSTI 12x24.9 €</div>
                </>
              )}
            </div>
            <ProductNameDivider rowRef={rowRef} alignName={!manual} />
          </div>
        </article>
      </div>
    );
  }
  const view = render(<Harness />);
  return {
    ...view,
    move: (amount: number) => {
      movement = amount;
      const price =
        view.container.querySelector<HTMLElement>(".brochure-price");
      if (!price) throw new Error("Missing price fixture");
      price.style.transform = `translateY(${amount}px)`;
    },
  };
}

it("starts below the product name at the native orange/installment boundary and follows a live price move", async () => {
  const view = fixture(true, false);
  const line = () =>
    view.container.querySelector<HTMLElement>(".brochure-product-name-divider");
  expect(line()?.style.top).toBe("50.5px");
  expect(line()?.style.left).toBe("0px");
  expect(line()?.style.width).toBe("500px");
  expect(
    view.container.querySelector<HTMLElement>(".brochure-product-copy")?.style
      .translate,
  ).toBe("0 -1.5px");
  view.move(10);
  await waitFor(() => expect(line()?.style.top).toBe("60.5px"));
  expect(
    view.container.querySelector<HTMLElement>(".brochure-product-copy")?.style
      .translate,
  ).toBe("0 8.5px");
});

it("uses the HTML orange/installment boundary without changing a manually moved product name", () => {
  const view = fixture(false, true);
  const line = view.container.querySelector<HTMLElement>(
    ".brochure-product-name-divider",
  );
  expect(line?.style.top).toBe("50.5px");
  const copy = view.container.querySelector<HTMLElement>(
    ".brochure-product-copy",
  );
  expect(copy?.style.translate).toBe("");
  expect(copy?.style.transform).toBe("translate(2cqw,3cqw)");
});

it("materializes default alignment for a live name drag and restores it after cancellation", async () => {
  const view = fixture(true, false);
  const copy = view.container.querySelector<HTMLElement>(
    ".brochure-product-copy",
  );
  if (!copy) throw new Error("Missing copy fixture");
  const originalStyle = copy.style.cssText;
  const offset = materializeProductNameAlignment(copy, 1080, 1);
  expect(offset.y).toBeCloseTo((-1.5 / 1080) * 100);
  copy.style.transform = "translateY(8.5px)";
  await waitFor(() => expect(copy.style.translate).toBe(""));
  expect(copy.style.transform).toBe("translateY(8.5px)");
  copy.style.cssText = originalStyle;
  delete copy.dataset.nameDividerManual;
  view.move(10);
  await waitFor(() => expect(copy.style.translate).toBe("0 8.5px"));
});
