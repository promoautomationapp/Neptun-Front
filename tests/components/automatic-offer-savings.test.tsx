import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../src/features/brochure/brochurePresets";
import {
  analyzeBrochureRows,
  inferBrochureColumns,
} from "../../src/features/brochure/brochureImport";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { brochurePage } from "../fixtures/brochure-page";

function renderedPage(products: Product[], presetIndex: number) {
  const campaign: Campaign = { id: "prices", name: "Offers", products };
  applyBrochurePreset(
    campaign,
    availableBrochurePresets(resolveSettings(null))[presetIndex]!,
  );
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(
    <ProductPage
      campaign={campaign}
      page={brochurePage(products, { backgroundColor: "#1b4075" })}
    />,
  );
  return root;
}

it.each([0, 1])(
  "renders the actual automatic savings choice in price design %s, including the €30 boundary and category exceptions",
  (preset) => {
    const products: Product[] = [
      { code: "cable", name: "HDMI cable", regular: 99, sale: 29.99 },
      { code: "speaker", name: "Speaker", regular: 40, sale: 30 },
      {
        code: "coffee",
        name: "ABC123",
        categoryPath: "Small appliances > Aparat kafeje",
        regular: 49,
        sale: 19,
      },
    ];
    const root = renderedPage(products, preset);
    const labels = Array.from(
      root.querySelectorAll(
        ".red-reference-saving,.reference-saving-tab,.brochure-saving",
      ),
      (badge) => badge.getAttribute("aria-label") || badge.textContent,
    );
    expect(labels).toHaveLength(3);
    expect(labels[0]).toMatch(/zbritje/i);
    expect(labels[1]).toMatch(/kurseni/i);
    expect(labels[2]).toMatch(/kurseni/i);
  },
);

it("renders mixed Excel products sharing page.order as one offer with one shared price in both price designs", () => {
  const headers = ["Code", "Product name", "Brochure position", "Promo price"];
  const columns = { ...inferBrochureColumns(headers), codeCol: 0, priceCol: 3 };
  const catalog: Product[] = [
    { code: "TV", name: "Beko television", regular: 549, brand: "Beko" },
    { code: "AUDIO", name: "Sony soundbar", regular: 399, brand: "Sony" },
  ];
  const imported = analyzeBrochureRows(
    [
      ["TV", "Beko television", "2.3", 599],
      ["AUDIO", "Sony soundbar", "2.3", ""],
    ],
    columns,
    catalog,
  );
  expect(imported.skipped).toEqual([]);
  expect(imported.products).toHaveLength(1);
  for (const preset of [0, 1]) {
    const root = renderedPage(imported.products, preset);
    expect(root.querySelectorAll(".brochure-product")).toHaveLength(1);
    expect(root.querySelectorAll(".brochure-price")).toHaveLength(1);
    expect(root.querySelector(".brochure-price")?.textContent).toContain("599");
    expect(root.textContent).toContain("Beko television");
    expect(root.textContent).toContain("Sony soundbar");
  }
});
