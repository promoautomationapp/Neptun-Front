import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import type { BrochurePage } from "../../src/features/brochure/campaignPages";
import { ProductPage } from "../../src/features/brochure/Brochure";
import { defaultProductImageScale } from "../../src/features/brochure/tvSpecs";
import { ProductLayoutControls } from "../../src/features/brochure/ProductLayoutControls";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(() => cleanup());
const page = (products: Product[]): BrochurePage => ({
  index: 0,
  products,
  layout: "grid6",
  image: "",
  backgroundColor: "",
  backgroundImage: "",
  backgroundGradient: null,
  showFooter: true,
  showFooterPageNumber: true,
  spacing: null,
  title: "TVs",
});
const tv = (inches: number): Product => ({
  code: String(inches),
  name: `TV LED ${inches}ABC`,
  subcategory: "TV",
  specs: { Përmasat: `${inches} inch` },
  image: `/tv-${inches}.png`,
  regular: 999,
  sale: 799,
});

it("renders gently increasing TV sizes within photo slots, including export markup", () => {
  const products = [32, 43, 55, 65, 75, 85, 98, 120].map(tv);
  const campaign: Campaign = {
    id: "sizes",
    name: "TVs",
    products,
    layout: "grid6",
    theme: "blue",
  };
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(
    <ProductPage campaign={campaign} page={page(products)} />,
  );
  const scales = Array.from(
    root.querySelectorAll<HTMLImageElement>(".brochure-product-image"),
    (image) =>
      Number(image.style.transform.match(/scale\(([\d.]+)\)/)?.[1] ?? "1"),
  );
  expect(scales).toHaveLength(products.length);
  expect(
    scales.every(
      (scale, index) => scale <= 1 && (!index || scale > scales[index - 1]!),
    ),
  ).toBe(true);
  expect(
    defaultProductImageScale(tv(75)) / defaultProductImageScale(tv(65)),
  ).toBeLessThan(1.1);
  expect(
    defaultProductImageScale(tv(65)) / defaultProductImageScale(tv(55)),
  ).toBeGreaterThan(1.07);
  expect(defaultProductImageScale({ name: "Unknown", subcategory: "TV" })).toBe(
    1,
  );
  expect(
    defaultProductImageScale({ name: "PHONE", subcategory: "SMARTPHONE" }),
  ).toBe(1);
});

it("keeps saved manual photo sizes and resets back to the inch-based default", () => {
  setLanguage("en");
  const manual: Product = {
    ...tv(65),
    brochureImagePlacement: { x: 42, y: 48, scale: 1.2 },
  };
  const campaign: Campaign = {
    id: "saved",
    name: "Saved",
    products: [manual],
    theme: "blue",
  };
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(
    <ProductPage campaign={campaign} page={page([manual])} />,
  );
  expect(
    root.querySelector<HTMLImageElement>(".brochure-product-image")?.style
      .transform,
  ).toContain("scale(1.2)");
  const change = vi.fn();
  const view = render(
    <ProductLayoutControls
      product={manual}
      campaign={campaign}
      onChange={change}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Reset photo position" }));
  expect(change).toHaveBeenCalledWith("brochureImagePlacement", null);
  view.rerender(
    <ProductLayoutControls
      product={{ ...manual, brochureImagePlacement: null }}
      campaign={campaign}
      onChange={change}
    />,
  );
  expect(
    (view.getAllByLabelText("Size (%)")[0] as HTMLInputElement).value,
  ).toBe(String(Math.round(defaultProductImageScale(manual) * 100)));
  fireEvent.change(view.getByLabelText("Left (%)"), {
    target: { value: "55" },
  });
  expect(change).toHaveBeenLastCalledWith(
    "brochureImagePlacement",
    expect.objectContaining({ x: 55, scale: defaultProductImageScale(manual) }),
  );
});
