import { brochurePage } from "../fixtures/brochure-page";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";

const apple: Product = {
  code: "iphone-reference",
  name: "IPHONE 17 PRO",
  brand: "APPLE",
  subcategory: "SMARTPHONE",
  image: "/iphone-reference.png",
  regular: 1499,
  sale: 1329,
  warranty: "1 vit",
  specs: { Memorje: "256 GB", Lidhja: "Bluetooth 5.3" },
};

function page(product: Product, offerStyle = "current", theme = "blue") {
  const campaign: Campaign = {
    id: "apple-reference",
    name: "Apple reference",
    products: [product],
    offerStyle,
    theme,
    priceLogo: "symbol",
    includeStoresFooter: false,
    includeStoresPage: false,
  };
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <ProductPage campaign={campaign} page={brochurePage([product])} />,
  );
  const card = container.querySelector<HTMLElement>(".brochure-product");
  if (!card) throw new Error("Product offer was not rendered");
  return { container, card };
}

it("puts current Apple capacity and the one-year warranty in one compact details row with the same native printed price as other brands", () => {
  const { card } = page(apple);
  const row = card.querySelector(".brochure-specs");
  const capacity = row?.querySelector('[data-detail-key="Memorje"]');
  expect(capacity?.textContent).toBe("256 GB");
  expect(capacity?.classList.contains("detail-filled")).toBe(true);
  expect(row?.querySelector('[data-detail-key="Lidhja"]')?.textContent).toBe(
    "Bluetooth 5.3",
  );

  const warranty = row?.querySelector<HTMLElement>(".brochure-warranty");
  expect(warranty?.querySelector("b")?.textContent).toBe("1");
  expect(warranty?.querySelector(".brochure-warranty-unit")?.textContent).toBe(
    "VIT",
  );
  expect(warranty?.querySelector(".brochure-warranty-label")?.textContent).toBe(
    "GARANCION",
  );
  expect(warranty?.classList.contains("detail-filled")).toBe(false);
  expect(card.querySelectorAll('[data-detail-key="__warranty"]')).toHaveLength(
    1,
  );
  expect(
    card.querySelector(".brochure-product-copy .brochure-warranty-line"),
  ).toBeNull();
  expect(card.querySelector(".red-reference-price-svg")?.textContent).toContain("1329");
  expect(card.querySelector(".red-reference-price-svg")?.textContent).toContain("KËSTI");
  expect(card.querySelector(".brochure-price-sale")).toBeNull();
});

it("keeps the gray Apple card's ordinary copy and warranty beside its name rather than adopting the current strip", () => {
  const { container, card } = page(apple, "card", "light");
  expect(container.querySelector(".brochure-page.light")).not.toBeNull();
  const row = card.querySelector(".brochure-specs");
  expect(row?.querySelector(".detail-filled")).toBeNull();
  expect(
    row?.querySelector('[data-detail-key="Lidhja"] .detail-copy')?.textContent,
  ).toBe("Bluetooth 5.3");
  expect(row?.querySelector('[data-detail-key="__warranty"]')).toBeNull();
  const warranty = card.querySelector(
    ".brochure-product-copy .brochure-warranty-line",
  );
  expect(warranty?.textContent).toBe("1 VIT GARANCION");
  expect(card.querySelectorAll('[data-detail-key="__warranty"]')).toHaveLength(
    1,
  );
  expect(card.querySelector(".reference-price-svg")).not.toBeNull();
  expect(card.querySelector(".red-reference-price-svg")).toBeNull();
});

it("protects added and nested composite Apple photos in a mixed offer without marking its known Samsung member", () => {
  const samsung: Product = {
    code: "samsung-member",
    name: "GALAXY S26",
    brand: "SAMSUNG",
    image: "/samsung-member.png",
  };
  const nested: Product = {
    code: "nested-offer",
    name: "Two-device offer",
    brand: "APPLE / SAMSUNG",
    image: "/nested-composite.png",
    bundleProducts: [apple, samsung],
  };
  const mixed: Product = {
    code: "mixed-offer",
    name: "Device bundle",
    brand: "APPLE / SAMSUNG",
    regular: 1999,
    sale: 1599,
    bundleProducts: [samsung, nested],
    productArtworks: [
      {
        id: "added-photo",
        type: "image",
        image: "/added-composite.png",
        x: 5,
        y: 5,
        width: 30,
        relativeTo: "product",
      },
      {
        id: "nested-photo",
        type: "bundle-product",
        memberCode: nested.code,
        image: nested.image,
        x: 35,
        y: 5,
        width: 30,
        relativeTo: "product",
      },
      {
        id: "samsung-photo",
        type: "bundle-product",
        memberCode: samsung.code,
        image: samsung.image,
        x: 65,
        y: 5,
        width: 30,
        relativeTo: "product",
      },
    ],
  };
  const { card } = page(mixed);
  const photos = [
    ...card.querySelectorAll<HTMLImageElement>(".product-artwork-item > img"),
  ];
  expect(photos).toHaveLength(3);
  const protectedPhoto = (source: string) =>
    photos
      .find((image) => image.getAttribute("src") === source)
      ?.parentElement?.getAttribute("data-apple-photo-clearance");
  expect(protectedPhoto("/added-composite.png")).toBe("true");
  expect(protectedPhoto("/nested-composite.png")).toBe("true");
  expect(protectedPhoto("/samsung-member.png")).toBeNull();
  expect(card.querySelectorAll(".brochure-price")).toHaveLength(1);
});
