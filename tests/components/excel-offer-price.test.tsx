import { brochurePage } from "../fixtures/brochure-page";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPage, validOffer } from "../../src/features/brochure/Brochure";

it("renders the actual Excel offer and installment without inventing a regular price or savings", () => {
  const product: Product = {
    code: "99001",
    name: "Beko oven BBIE123",
    brand: "BEKO",
    regular: null,
    sale: 299,
    catalogMissing: true,
    source: "import",
    brochureDetails: ["72 L", "2400 W"],
  };
  const campaign: Campaign = {
    id: "excel",
    name: "Excel",
    products: [product],
    offerStyle: "current",
    theme: "blue",
  };
  expect(validOffer(product)).toBe(true);
  for (const editable of [false, true]) {
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(
      <ProductPage
        campaign={campaign}
        page={brochurePage([product])}
        {...(editable ? { onEditImage: () => {} } : {})}
      />,
    );
    expect(root.querySelector(".brochure-price.missing")).toBeNull();
    expect(root.querySelector(".brochure-price")?.textContent).toContain("299");
    expect(
      root.querySelector(".brochure-price")?.getAttribute("aria-label") ||
        root.querySelector(".brochure-price svg")?.getAttribute("aria-label"),
    ).not.toContain("rregullt: 0");
    expect(root.querySelector(".brochure-red-reference-saving")).toBeNull();
    expect(root.textContent).toContain("72 L");
    const notice = root.querySelector(".missing-catalog-notice");
    if (editable) expect(notice).not.toBeNull();
    else expect(notice).toBeNull();
  }
});
