import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";
import { SocialProductVisual } from "../../src/features/social/CanvasLayers";
import { bundleScreenArtworkPlacement } from "../../src/features/brochure/ProductArtworkLayer";
import { brochurePage } from "../fixtures/brochure-page";

const television: Product = {
  code: "screen",
  name: "TV LED 55MODEL",
  subcategory: "TV",
  brand: "Samsung",
  image: "/same-photo.png",
  regular: 499,
  sale: 399,
  specs: { Ekrani: '55"' },
  screenArtwork: {
    image: "/saved-wallpaper.png",
    box: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 },
  },
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    400,
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(
    200,
  );
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return DOMRect.fromRect({
        x: 0,
        y: 0,
        width: this.classList.contains("brochure-page") ? 1080 : 400,
        height: 300,
      });
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("removes saved wallpaper and inch overlays immediately when the brochure photo belongs to Apple", () => {
  const page = (product: Product) => {
    const campaign: Campaign = {
      id: "screen-policy",
      name: "Screen policy",
      products: [product],
    };
    return <ProductPage campaign={campaign} page={brochurePage([product])} />;
  };
  const view = render(page(television));
  expect(view.container.querySelector(".brochure-screen-image")).not.toBeNull();
  const apple: Product = {
    ...television,
    name: "iPhone 17",
    brand: "Apple",
    subcategory: "SMARTPHONE",
    specs: { Ekrani: '6.3"' },
    screenAnnotationPlacement: { x: 0, y: 0, scale: 2 },
  };
  view.rerender(page(apple));
  expect(
    view.container.querySelector(
      ".brochure-screen-image,.screen-size-annotation",
    ),
  ).toBeNull();
  expect(view.getByAltText("iPhone 17").getAttribute("src")).toBe(
    television.image,
  );
});

it("blocks old screen overlays in social even when the image URL and saved artwork do not change", () => {
  const canvas = (product: Product) => (
    <div className="social-canvas">
      <article className="social-product">
        <SocialProductVisual product={product} image={product.image} />
      </article>
    </div>
  );
  const view = render(canvas(television));
  fireEvent.load(view.getByAltText(television.name));
  expect(
    view.container.querySelector(".social-product-screen-image"),
  ).not.toBeNull();
  view.rerender(
    canvas({
      ...television,
      name: "iPad Air",
      brand: "Apple",
      subcategory: "TABLET",
      specs: { Ekrani: '11"' },
    }),
  );
  expect(
    view.container.querySelector(
      ".social-product-screen-image,.screen-size-annotation",
    ),
  ).toBeNull();
  expect(view.getByAltText("iPad Air").getAttribute("src")).toBe(
    television.image,
  );
});

it("never adds a bundle wallpaper over an Apple photo even with an imported TV category", () => {
  expect(
    bundleScreenArtworkPlacement(
      { ...television, brand: "Apple" },
      document.createElement("img"),
      document.createElement("div"),
    ),
  ).toBeNull();
});
