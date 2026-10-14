import { useRef } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DefaultSavingsClearance } from "../../src/features/brochure/DefaultSavingsClearance";
import redGeometry from "../../src/features/brochure/redPriceGeometry.json";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function Fixture({ enabled = true }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section className="brochure-page">
      <article className="brochure-product">
        <div ref={ref}>
          <span className="brochure-red-reference-saving" />
        </div>
        <div className="brochure-product-bottom">
          <div className="brochure-price">
            <svg className="red-reference-price-svg" />
          </div>
        </div>
        <DefaultSavingsClearance photoAreaRef={ref} enabled={enabled} />
      </article>
    </section>
  );
}
it.each([540, 1080])(
  "keeps the savings circle clear of the overflowing old price at page width %i",
  (width) => {
    const scale = width / 1080;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const badge = this.classList.contains("brochure-red-reference-saving");
        const translated = badge
          ? Number.parseFloat(
              (this as HTMLElement).style.translate.split(" ")[1] || "0",
            )
          : 0;
        return {
          x: 400 * scale,
          y: 150 * scale + translated,
          left: 400 * scale,
          right: 500 * scale,
          top: 150 * scale + translated,
          bottom: 210 * scale + translated,
          width: 100 * scale,
          height: 60 * scale,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );
    const getRect = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        if (
          this.classList.contains("brochure-page") ||
          this.classList.contains("brochure-product")
        )
          return {
            left: 0,
            top: 0,
            right: width,
            bottom: width,
            width,
            height: width,
          } as DOMRect;
        if (
          this.classList.contains("brochure-price") ||
          this.classList.contains("red-reference-price-svg")
        )
          return {
            left: 400 * scale,
            top: 200 * scale,
            right: 500 * scale,
            bottom: 270 * scale,
            width: 100 * scale,
            height: 70 * scale,
          } as DOMRect;
        return getRect.call(this);
      },
    );
    const view = render(<Fixture />);
    const badge = view.container.querySelector<HTMLElement>(
      ".brochure-red-reference-saving",
    )!;
    const oldPriceTop =
      (200 +
        (redGeometry.parts.oldBand.y * 100) /
          redGeometry.parts.saleBand.width) *
      scale;
    expect(badge.getBoundingClientRect().bottom).toBeCloseTo(
      oldPriceTop - 6 * scale,
    );
    view.rerender(<Fixture enabled={false} />);
    expect(badge.style.translate).toBe("");
  },
);
