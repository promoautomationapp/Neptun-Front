import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";
import { PostCanvas } from "../../src/features/social/SocialStudio";
import { createPost } from "../../src/features/social/postModel";
import { brochurePage } from "../fixtures/brochure-page";

const phone: Product = {
  code: "PHONE-GREEN",
  name: "A37 5G 6/128 GREEN",
  brand: "SAMSUNG",
  image: "/phone.png",
  brochureVariants: [
    { code: "PHONE-GREEN", color: { name: "Green", hex: "#3b9964" } },
    { code: "PHONE-GRAY", color: { name: "Gray", hex: "#9098a0" } },
    { code: "PHONE-PURPLE", color: { name: "Purple", hex: "#855ab6" } },
    { code: "PHONE-WHITE", color: { name: "White", hex: "#ffffff" } },
  ],
};
const tv: Product = {
  code: "TV",
  name: "TV LED BEKO 55BHU7800",
  image: "/tv.png",
};
const speaker: Product = {
  code: "SPEAKER",
  name: "JBL GO4",
  image: "/speaker.png",
};

it.each([2, 3])(
  "shows one group of color circles for the phone inside a %s-model brochure and social offer",
  (count) => {
    const offer: Product = {
      code: "SHARED-OFFER",
      name: "TV + PHONE",
      sale: 599,
      regular: 998,
      bundleProducts: [tv, phone, speaker].slice(0, count),
    };
    const campaign: Campaign = {
      id: "variants",
      name: "Variants",
      products: [offer],
      includeStoresPage: false,
    };
    const before = structuredClone(offer);
    const rendered = [
      <ProductPage campaign={campaign} page={brochurePage([offer])} />,
      <PostCanvas
        post={{
          ...createPost(),
          products: [offer],
          showNeptunLogo: false,
          showEventLogo: false,
        }}
      />,
    ];
    for (const canvas of rendered) {
      const container = document.createElement("div");
      container.innerHTML = renderToStaticMarkup(canvas);
      const colors = container.querySelector(
        `[role="group"][aria-label="Ngjyrat: ${phone.name}"]`,
      );
      expect(colors).not.toBeNull();
      expect(
        [...colors!.querySelectorAll('[role="img"]')].map((dot) =>
          dot.getAttribute("aria-label"),
        ),
      ).toEqual(["Green", "Gray", "Purple", "White"]);
      expect(
        container.querySelectorAll(".bundle-variant-color-group"),
      ).toHaveLength(1);
      expect(
        container.querySelector(
          '[aria-label="Ngjyrat: TV LED BEKO 55BHU7800"]',
        ),
      ).toBeNull();
    }
    expect(offer).toEqual(before);
  },
);
