import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";
import { ProductBrandArtwork } from "../../src/features/brochure/ProductBrandArtwork";
import { bundleBrandArtworks } from "../../src/features/brochure/BundleBrandArtwork";
import { blackCollectionDesignDefaults, blackFridayDesignDefaults } from "../../src/features/brochure/blackFridayDesign";
import { brochurePage } from "../fixtures/brochure-page";

const iphone: Product = { code: "iphone", name: "iPhone 17 Pro", brand: "APPLE", image: "/iphone.png", brandLogo: "/imported-apple-logo.png", regular: 1699, sale: 1549 };
const ipad: Product = { ...iphone, code: "ipad", name: "iPad 11", image: "/ipad.png" };
function markup(node: React.ReactNode) {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(node);
  return root;
}
test.each([false, true])("Black Friday Apple-only pages show one editable reseller mark, with no repeated source brand logos (clean=%s)", (clean) => {
  const campaign: Campaign = { ...(clean ? blackCollectionDesignDefaults() : blackFridayDesignDefaults()), id: "apple-page", name: "Apple page", products: [iphone, ipad], includeStoresFooter: false };
  const root = markup(<ProductPage campaign={campaign} page={brochurePage(campaign.products)} />);
  expect(root.querySelectorAll('.brochure-apple-page-branding img[alt="Apple Authorised Reseller"]')).toHaveLength(1);
  expect(root.querySelectorAll('.brochure-product [data-detail-key="__brand"]')).toHaveLength(0);
  expect(root.querySelectorAll('[data-apple-photo-clearance="true"]')).toHaveLength(2);
  const mixed = { ...campaign, products: [iphone, { ...ipad, brand: "SAMSUNG", name: "Samsung Tab" }] };
  expect(markup(<ProductPage campaign={mixed} page={brochurePage(mixed.products)} />).querySelector(".brochure-apple-page-branding")).toBeNull();
});
test("an explicitly restored Apple offer logo and a replacement reseller mark stay available", () => {
  const campaign: Campaign = { ...blackCollectionDesignDefaults(), id: "apple-edits", name: "Apple edits", products: [iphone], campaignAssets: { "product-0-apple-reseller": { image: "/custom-reseller.png" } }, includeStoresFooter: false };
  const root = markup(<ProductPage campaign={campaign} page={brochurePage(campaign.products)} />);
  expect(root.querySelector('.brochure-apple-page-branding img')?.getAttribute("src")).toBe("/custom-reseller.png");
  expect(root.querySelector('.brochure-apple-reseller-default')).toBeNull();
  const restored = markup(<ProductBrandArtwork campaign={campaign} product={{ ...iphone, hideBrandLogo: false }} />);
  expect(restored.querySelector('img')?.getAttribute("src")).toBe("/imported-apple-logo.png");
  expect(bundleBrandArtworks(campaign, { ...iphone, bundleProducts: [iphone, ipad] })).toEqual([]);
});
