import React, { useRef } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BlueReferenceDetailAlignment } from "../../src/features/brochure/BlueReferenceDetailAlignment";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function Fixture({
  enabled = true,
  automaticPhoto = false,
  manualCopy = false,
  anchored = false,
}) {
  const photo = useRef<HTMLDivElement>(null);
  return (
    <article
      className="brochure-product"
      data-default-photo={automaticPhoto ? "true" : undefined}
      data-default-bottom-row={anchored ? "true" : undefined}
    >
      <div ref={photo} />
      <div className="brochure-specs" data-detail-layout="strip" />
      <div
        className="brochure-product-copy"
        data-copy-frame-manual={manualCopy ? "true" : undefined}
        style={manualCopy ? { transform: "translate(3cqw, 4cqw)" } : undefined}
      />
      <div
        className="reference-saving-tab"
        style={{ left: "71%", top: "20px" }}
      />
      <BlueReferenceDetailAlignment photoAreaRef={photo} enabled={enabled} />
    </article>
  );
}
function measurements() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const top = this.classList.contains("brochure-specs")
        ? 120
        : this.classList.contains("reference-saving-tab")
          ? 100
          : this.classList.contains("brochure-product-copy")
            ? 140
            : 0;
      const height = this.classList.contains("reference-saving-tab")
        ? 60
        : this.classList.contains("brochure-specs")
          ? 40
          : this.classList.contains("brochure-product-copy")
            ? 50
            : 300;
      return {
        top,
        left: 0,
        width: 400,
        height,
        bottom: top + height,
        right: 400,
      } as DOMRect;
    },
  );
}
it("aligns the automatic detail row to the savings center without moving savings", () => {
  measurements();
  const view = render(<Fixture />);
  expect(
    (view.container.querySelector(".brochure-specs") as HTMLElement).style
      .translate,
  ).toBe("0 -10px");
  expect(
    (view.container.querySelector(".reference-saving-tab") as HTMLElement).style
      .cssText,
  ).toBe("left: 71%; top: 20px;");
});
it("leaves manually positioned rows alone", () => {
  measurements();
  const view = render(<Fixture enabled={false} />);
  expect(
    (view.container.querySelector(".brochure-specs") as HTMLElement).style
      .translate,
  ).toBe("");
});

it("reserves the complete automatic photograph above the aligned row and shifts only automatic copy below it", () => {
  measurements();
  const view = render(<Fixture automaticPhoto />);
  const card = view.container.querySelector<HTMLElement>(".brochure-product")!;
  expect(
    Number.parseFloat(
      card.style.getPropertyValue("--blue-reference-photo-height"),
    ),
  ).toBeCloseTo(108.52, 2);
  expect(
    card.querySelector<HTMLElement>(".brochure-product-copy")?.style.translate,
  ).toBe("0 12.22px");
  expect(
    card.querySelector<HTMLElement>(".reference-saving-tab")?.style.cssText,
  ).toBe("left: 71%; top: 20px;");
});

it("keeps manually positioned copy unchanged while aligning the automatic detail row", () => {
  measurements();
  const view = render(<Fixture manualCopy />);
  const copy = view.container.querySelector<HTMLElement>(
    ".brochure-product-copy",
  )!;
  expect(copy.style.translate).toBe("");
  expect(copy.style.transform).toBe("translate(3cqw, 4cqw)");
  expect(
    view.container.querySelector<HTMLElement>(".brochure-specs")?.style
      .translate,
  ).toBe("0 -10px");
});

it("keeps automatic anchored copy on its shared row baseline without shifting the savings or detail center", () => {
  measurements();
  const view = render(<Fixture anchored />);
  const card = view.container.querySelector<HTMLElement>(".brochure-product")!;
  expect(
    card.querySelector<HTMLElement>(".brochure-product-copy")?.style.translate,
  ).toBe("");
  expect(
    card.querySelector<HTMLElement>(".brochure-specs")?.style.translate,
  ).toBe("0 -10px");
  expect(
    card.querySelector<HTMLElement>(".reference-saving-tab")?.style.cssText,
  ).toBe("left: 71%; top: 20px;");
});
