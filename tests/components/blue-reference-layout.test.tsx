import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";
import { brochurePage } from "../fixtures/brochure-page";

function page(product: Product, campaign: Partial<Campaign> = {}) {
  const value: Campaign = {
    id: "blue-style",
    name: "Offers",
    offerStyle: "card",
    theme: "light",
    products: [product],
    ...campaign,
  };
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(
    <ProductPage
      campaign={value}
      page={{ ...brochurePage([product]), title: "Televisions" }}
    />,
  );
  return root;
}
const tv: Product = {
  code: "tv-code",
  name: "TV QLED",
  brand: "BEKO",
  regular: 499,
  sale: 299,
  image: "/tv.png",
  warranty: "2 vite",
  brochureDetails: [
    "QLED TV",
    "4K Ultra HD",
    "144Hz",
    "HDR10+",
    "Dolby Vision",
    "Dolby Atmos",
  ],
  brochureVariants: [
    { code: "tv-code", color: { name: "Black", hex: "#000000" } },
    { code: "tv-white", color: { name: "White", hex: "#ffffff" } },
  ],
};

it("renders three readable TV facts, colors before details and warranty under name in any blue-price preset", () => {
  const root = page(tv, { brochurePresetId: "team-custom" });
  const card = root.querySelector(".brochure-product")!;
  expect(
    card.querySelectorAll(".brochure-specs > .product-detail-block"),
  ).toHaveLength(3);
  for (const fact of tv.brochureDetails!.slice(0, 3))
    expect(card.querySelector(".brochure-specs")?.textContent).toContain(fact);
  expect(card.querySelector(".brochure-specs")?.textContent).not.toContain(
    "Dolby Atmos",
  );
  expect(card.querySelector(".brochure-product-code")).toBeNull();
  expect(
    card.querySelector(".brochure-product-copy .brochure-warranty-line")
      ?.textContent,
  ).toBe("2 VITE GARANCION");
  const children = [...card.children];
  expect(
    children.indexOf(card.querySelector(":scope > .brochure-colors")!),
  ).toBeLessThan(
    children.indexOf(card.querySelector(".brochure-product-bottom")!),
  );
  expect(root.querySelector(".october-category-ribbon")?.textContent).toBe(
    "Televisions",
  );
  expect(
    card.querySelector<HTMLElement>(".reference-saving-tab")?.style.left,
  ).not.toBe("auto");
});

it("keeps a supplied printed code as an explicit opt-in", () => {
  expect(
    page({ ...tv, brochureCode: "TV SPECIAL" }).querySelector(
      ".brochure-product-code",
    )?.textContent,
  ).toBe("TV SPECIAL");
});

it("uses the saved category title or derives a category instead of printing a generic page number in the ribbon", () => {
  const value: Campaign = {
    id: "headings",
    name: "Offers",
    products: [tv],
    offerStyle: "card",
    pages: { 0: { title: "Telefonat" } },
  };
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(
    <ProductPage campaign={value} page={brochurePage([tv])} />,
  );
  expect(root.querySelector(".october-category-ribbon")?.textContent).toBe(
    "Telefonat",
  );
  root.innerHTML = renderToStaticMarkup(
    <ProductPage
      campaign={{ ...value, pages: {} }}
      page={brochurePage([{ ...tv, subcategory: "TV" }])}
    />,
  );
  expect(root.querySelector(".october-category-ribbon")?.textContent).toBe(
    "TV",
  );
});

it("uses four narrow left-phone groups even when the campaign inherits a bottom placement preference", () => {
  const phone: Product = {
    ...tv,
    code: "phone",
    name: "SAMSUNG GALAXY A37 5G",
    brand: "SAMSUNG",
    category: "SMARTPHONE",
    brochureDetails: [
      "Android 16",
      "Kamera: 50 MP",
      "Front: 12 MP",
      "6 GB / 128 GB",
      "Bateria: 5000 mAh",
      '6.7" AMOLED',
    ],
  };
  const root = page(phone, {
    productDesign: {
      details: { placement: "bottom" },
    } as Campaign["productDesign"],
  });
  expect(root.querySelector(".brochure-product.details-left")).not.toBeNull();
  const row = root.querySelector('.brochure-specs[data-detail-layout="left"]');
  expect(row?.querySelectorAll(":scope > .product-detail-block")).toHaveLength(
    4,
  );
  expect(row?.textContent).not.toContain("AMOLED");
});

it("keeps Apple branding in the page header and preserves its name and warranty together", () => {
  const root = page({
    ...tv,
    code: "ipad",
    name: "IPAD APPLE 11",
    brand: "APPLE",
  });
  const card = root.querySelector(".brochure-product")!;
  expect(
    root.querySelector('img[alt="Apple Authorised Reseller"]'),
  ).not.toBeNull();
  expect(card.querySelector(".brochure-brand-mark")).toBeNull();
  expect(card.querySelector(".brochure-product-top-name")?.textContent).toBe(
    "IPAD APPLE 11",
  );
  expect(
    card.querySelector(".brochure-product-top-warranty")?.textContent,
  ).toBe("2 VITE GARANCION");
});

it("renders an explicit right stack and preserves the draggable detail blocks", () => {
  const root = page({
    ...tv,
    name: "SAMSUNG GALAXY A37",
    brand: "SAMSUNG",
    detailPlacement: "right",
    brochureDetails: ["Android 16", "6 GB / 128 GB"],
    detailBlockPlacements: { "0": { x: 1, y: 2 } },
  });
  expect(root.querySelector(".brochure-product.details-right")).not.toBeNull();
  const row = root.querySelector('.brochure-specs[data-detail-layout="right"]');
  expect(
    row?.querySelector('[data-detail-key="0"]')?.getAttribute("style"),
  ).toContain("translate(1cqw, 2cqw)");
});
