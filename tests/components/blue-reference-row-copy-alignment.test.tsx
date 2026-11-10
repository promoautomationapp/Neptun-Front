import React, { useRef } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BlueReferenceRowCopyAlignment } from "../../src/features/brochure/BlueReferenceRowCopyAlignment";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function Fixture({ footerTop = 703, manual = false }) {
  const page = useRef<HTMLElement>(null);
  return (
    <section className="brochure-page" ref={page} data-footer-top={footerTop}>
      <article
        className="brochure-product blue-reference-offer details-left phone"
        data-default-bottom-row="true"
      >
        <div className="brochure-product-copy">
          <span data-product-name="true">Phone</span>
        </div>
        <span className="brochure-colors blue-reference-colors" />
      </article>
      <article
        className="brochure-product blue-reference-offer watch"
        data-default-bottom-row={manual ? undefined : "true"}
      >
        <div
          className="brochure-product-copy"
          data-copy-frame-manual={manual ? "true" : undefined}
          style={manual ? { transform: "translate(3cqw, 2cqw)" } : undefined}
        >
          Watch
        </div>
        <div className="brochure-specs" data-detail-layout="strip" />
        <div className="reference-saving-tab" style={{ left: "71%" }} />
      </article>
      <footer className="cover-element-footer" />
      <BlueReferenceRowCopyAlignment pageRef={page} />
    </section>
  );
}
function measurements() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const page = this.closest<HTMLElement>(".brochure-page");
      const watch = this.closest(".watch");
      let top = 0,
        width = 760,
        height = 900,
        left = 0;
      if (this.classList.contains("brochure-product")) {
        top = 400;
        width = 342;
        height = 284;
      }
      if (this.classList.contains("brochure-product-copy")) {
        top = watch ? 628.3 : 617;
        height = 684 - top;
        width = 194;
      }
      if (this.classList.contains("brochure-specs")) {
        top = 607.94;
        height = 28.12;
        width = 201;
      }
      if (this.classList.contains("brochure-colors")) {
        top = 592;
        height = 11;
        width = 25;
      }
      if (this.hasAttribute("data-product-name")) {
        top = 633;
        height = 20;
        width = 194;
      }
      if (this.tagName === "FOOTER") {
        top = Number(page?.dataset.footerTop);
        height = 20;
        width = 700;
      }
      if (watch) left = 360;
      return {
        top,
        left,
        width,
        height,
        bottom: top + height,
        right: left + width,
      } as DOMRect;
    },
  );
}
it("shares the required watch clearance with its phone peer and puts colors just above the phone's visible copy", () => {
  measurements();
  const view = render(<Fixture />);
  const phone = view.container.querySelector<HTMLElement>(".phone")!;
  const watch = view.container.querySelector<HTMLElement>(".watch")!;
  expect(phone.style.getPropertyValue("--blue-copy-row-offset")).toBe(
    "11.98px",
  );
  expect(watch.style.getPropertyValue("--blue-copy-row-offset")).toBe(
    "11.98px",
  );
  expect(phone.style.getPropertyValue("--blue-phone-colors-offset")).toBe(
    "37.76px",
  );
  expect(
    watch.querySelector<HTMLElement>(".reference-saving-tab")?.style.cssText,
  ).toBe("left: 71%;");
});
it("fits automatic copy uniformly before it can cross a tight footer gutter", () => {
  measurements();
  const view = render(<Fixture footerTop={690} />);
  const cards = [
    ...view.container.querySelectorAll<HTMLElement>(".brochure-product"),
  ];
  const scales = cards.map((card) =>
    Number(card.style.getPropertyValue("--blue-copy-row-scale")),
  );
  expect(scales[0]).toBe(scales[1]);
  expect(scales[0]).toBeLessThan(1);
  for (const card of cards)
    expect(
      Number.parseFloat(card.style.getPropertyValue("--blue-copy-row-offset")),
    ).toBeLessThanOrEqual(1.78);
});
it("leaves saved manual regions outside the shared automatic alignment", () => {
  measurements();
  const view = render(<Fixture manual />);
  const watch = view.container.querySelector<HTMLElement>(".watch")!;
  expect(watch.style.getPropertyValue("--blue-copy-row-offset")).toBe("");
  expect(
    watch.querySelector<HTMLElement>(".brochure-product-copy")?.style.transform,
  ).toBe("translate(3cqw, 2cqw)");
});
