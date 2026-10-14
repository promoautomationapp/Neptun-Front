import { brochurePage } from "../fixtures/brochure-page";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import {
  CoverPage,
  ProductPage,
  StoresPage,
} from "../../src/features/brochure/Brochure";
import { largeBundlePanelColors } from "../../src/features/brochure/largeBundleLayout";
import { pageBackgroundReadability } from "../../src/features/brochure/pageBackground";

const members: Product[] = ["Oven", "Hob", "Dishwasher"].map((name, index) => ({
  code: String(index),
  name,
  brand: "BEKO",
  image: `/${name}.png`,
  brochureDetails: ["Actual specification"],
  warranty: "5 VITE",
}));
const set: Product = {
  code: "set",
  name: "SET BEKO",
  brand: "BEKO",
  image: "/Oven.png",
  regular: 1008,
  sale: 629,
  bundleProducts: members,
};
const base: Campaign = {
  id: "backgrounds",
  name: "Offers",
  products: [set],
  theme: "blue",
  offerStyle: "current",
  brochureFormat: "neptun1080x1350",
  coverProductCodes: ["set"],
  showCoverHeadline: false,
  showCoverMessage: false,
  showCoverBand: false,
};
function html(node: React.ReactNode) {
  const element = document.createElement("div");
  element.innerHTML = renderToStaticMarkup(node);
  return element;
}

it.each([
  "#245b89",
  "#993366",
  "#eeaa66",
  "#93aa69",
  "#777777",
  "#f1f2f4",
  "#000000",
  "#ffffff",
])(
  "keeps shared set pricing and independent members on %s cover and product pages",
  (color) => {
    const campaign = {
      ...base,
      coverBackgroundColor: color,
      productBackgroundColor: color,
    };
    const before = structuredClone(campaign);
    for (const view of [
      html(<CoverPage campaign={campaign} />),
      html(<ProductPage campaign={campaign} page={brochurePage([set])} />),
    ]) {
      const panel = view.querySelector<HTMLElement>(".large-bundle-offer");
      const expected = largeBundlePanelColors(color);
      expect(panel?.style.getPropertyValue("--large-bundle-panel-color")).toBe(
        expected.background,
      );
      expect(panel?.style.getPropertyValue("--large-bundle-copy-color")).toBe(
        expected.foreground,
      );
      expect(view.querySelectorAll(".brochure-price")).toHaveLength(1);
      expect(view.querySelectorAll(".large-bundle-member-copy")).toHaveLength(
        3,
      );
      expect(view.querySelectorAll(".large-bundle-plus")).toHaveLength(2);
      expect(view.textContent).toContain("Actual specification");
    }
    expect(campaign).toEqual(before);
  },
);

it("preserves a mixed-gradient page and image stores background with readable movable regions", () => {
  const campaign: Campaign = {
    ...base,
    productBackgroundColor: "#225533",
    storesBackgroundColor: "#edae57",
    storesBackgroundImage: "/store-background.svg",
    storesSnapshot: {
      stores: [
        {
          city: "Prishtinë",
          name: "Central Park",
          address: "Actual address",
          phone: "046 828 000",
        },
      ],
      contact: { disclaimer: "Actual terms" },
    },
  };
  const page = brochurePage([set], {
    backgroundGradient: { from: "#36012a", to: "#fde7ac", angle: 135 },
  });
  const view = html(<ProductPage campaign={campaign} page={page} />);
  const section = view.querySelector<HTMLElement>(".brochure-interior");
  expect(section?.classList.contains("needs-contrast-surfaces")).toBe(true);
  expect(
    section?.style.getPropertyValue("--brochure-page-background"),
  ).toContain("#36012a, #fde7ac");
  const stores = html(
    <StoresPage
      campaign={campaign}
      settings={{ stores: [], contact: {} }}
      onPlaceStore={undefined}
      onReorderStore={undefined}
      onArtworkChange={undefined}
      onArtworkRemove={undefined}
      onElementChange={undefined}
      onElementHide={undefined}
      onHideStore={undefined}
      onStoreChange={undefined}
      onContactChange={undefined}
    />,
  );
  const storeSection = stores.querySelector<HTMLElement>(
    ".stores-reference-page",
  );
  expect(storeSection?.classList.contains("needs-contrast-surfaces")).toBe(
    true,
  );
  expect(storeSection?.style.color).toBe("rgb(28, 64, 117)");
  expect(
    stores
      .querySelector(".brochure-page-background-image")
      ?.getAttribute("src"),
  ).toBe("/store-background.svg");
  expect(stores.textContent).toContain("PRISHTINË");
  expect(stores.textContent).toContain("046 828 000");
  expect(
    stores.querySelectorAll("[data-store-element]").length,
  ).toBeGreaterThan(3);
  expect(pageBackgroundReadability(campaign, "stores").needsSurface).toBe(true);
});
