import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LargeBundleOffer } from "../../src/features/brochure/LargeBundleOffer";
import type { Product } from "../../src/domain/models";
import type * as ScreenGeometry from "../../src/features/brochure/screenGeometry";

vi.mock("../../src/features/brochure/screenGeometry", async (original) => ({
  ...(await original<typeof ScreenGeometry>()),
  visibleImageBounds: () => null,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("moves the SVG plus to the actual contained-image gap after loading and manual photo movement", async () => {
  let phoneX = 400;
  vi.stubGlobal("ResizeObserver", undefined);
  vi.spyOn(
    HTMLImageElement.prototype,
    "naturalWidth",
    "get",
  ).mockImplementation(function (this: HTMLImageElement) {
    return this.alt === "TV" ? 600 : 100;
  });
  vi.spyOn(
    HTMLImageElement.prototype,
    "naturalHeight",
    "get",
  ).mockImplementation(function (this: HTMLImageElement) {
    return this.alt === "TV" ? 372 : 200;
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      if (this.classList.contains("large-bundle-offer"))
        return DOMRect.fromRect({ x: 100, y: 100, width: 1000, height: 600 });
      const frame = this.closest<HTMLElement>(".bundle-product-image");
      const code = frame?.dataset.bundleArtworkCode;
      return DOMRect.fromRect({
        x: code === "tv" ? 130 : code === "phone" ? phoneX : 700,
        y: 124,
        width: 200,
        height: 200,
      });
    },
  );
  const product: Product = {
    code: "set",
    name: "Set",
    bundleProducts: [
      { code: "tv", name: "TV" },
      { code: "phone", name: "Phone" },
      { code: "last", name: "Other" },
    ],
  };
  const before = structuredClone(product);
  const artwork = (moved = false) => (
    <div>
      {product.bundleProducts!.map((member) => (
        <div
          key={member.code}
          className="bundle-product-image"
          data-bundle-artwork-code={member.code}
          style={{ left: member.code === "phone" && moved ? "40%" : "20%" }}
        >
          <img src={`/${member.code}.png`} alt={member.name} />
        </div>
      ))}
    </div>
  );
  const props = {
    product,
    price: <div>One offer</div>,
    renderMember: (member: Product) => <span>{member.name}</span>,
  };
  const view = render(<LargeBundleOffer {...props} artwork={artwork()} />);
  const firstPlus =
    view.container.querySelector<HTMLElement>(".large-bundle-plus")!;
  await waitFor(() =>
    expect(Number.parseFloat(firstPlus.style.left)).toBeCloseTo(29),
  );
  expect(Number.parseFloat(firstPlus.style.top)).toBeCloseTo(20.66667);
  expect(firstPlus.querySelector("svg path")).toBeTruthy();
  phoneX = 440;
  view.rerender(<LargeBundleOffer {...props} artwork={artwork(true)} />);
  await waitFor(() =>
    expect(Number.parseFloat(firstPlus.style.left)).toBeCloseTo(31),
  );
  phoneX = 460;
  fireEvent.load(view.getByAltText("Phone"));
  await waitFor(() =>
    expect(Number.parseFloat(firstPlus.style.left)).toBeCloseTo(32),
  );
  expect(product).toEqual(before);
});
