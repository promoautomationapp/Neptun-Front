import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";
import { brochurePage } from "../fixtures/brochure-page";

function rendered(product: Product) {
  const campaign: Campaign = {
    id: "screens",
    name: "Screen offers",
    products: [product],
  };
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(
    <ProductPage campaign={campaign} page={brochurePage([product])} />,
  );
  return root;
}

it("uses the shared guide for localized tablets, monitors and notebooks while retaining saved placement", () => {
  for (const subcategory of ["TABLETA", "EKRAN", "NOTEBOOK"]) {
    const root = rendered({
      code: "device",
      name: "ABC123",
      brand: "Samsung",
      subcategory,
      regular: 499,
      sale: 399,
      image: "/device.png",
      specs: { Ekrani: "11 inch" },
      screenAnnotationPlacement: { x: 0, y: 1, scale: 1.2 },
    });
    const label = root.querySelector<HTMLElement>(
      ".screen-size-annotation.screen-size-other",
    );
    expect(label, subcategory).not.toBeNull();
    expect(label!.getAttribute("aria-label")).toBe("11 inch screen");
    expect(label!.style.transform).toBe("translate(0cqw,1cqw) scale(1.2)");
  }
});

it("never renders inch artwork for iPhone or iPad with saved manual label settings", () => {
  for (const [name, subcategory, size] of [
    ["iPhone 17", "SMARTPHONE", 6.3],
    ["iPad Air", "TABLETA", 11],
  ] as const) {
    for (const brand of [undefined, "APPLE"]) {
      const root = rendered({
        code: "apple",
        name,
        brand,
        subcategory,
        regular: 999,
        sale: 899,
        image: "/apple.png",
        specs: { Ekrani: `${size} inch` },
        brochureDetails: [`Ekrani: ${size} inch`],
        screenAnnotationPlacement: { x: 0, y: 0, scale: 2 },
      });
      expect(root.querySelector(".screen-size-annotation"), name).toBeNull();
      expect(root.querySelector(".has-screen-annotation"), name).toBeNull();
    }
  }
});
