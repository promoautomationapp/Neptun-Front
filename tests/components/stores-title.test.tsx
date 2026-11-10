import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { StoresPage } from "../../src/features/brochure/Brochure";
import {
  preserveStoresHeadingRibbon,
  storesHeadingPlacement,
} from "../../src/features/brochure/storesDesign";
import { campaignSchema } from "../../src/domain/schemas";

function markup(campaign: Campaign) {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(<StoresPage campaign={campaign} />);
  return root;
}
const base: Campaign = {
  id: "title",
  name: "Stores",
  products: [],
  storesBackgroundColor: "#000000",
};

it("splits the compact ribbon and editable title into independent elements for ordinary black pages", () => {
  const page = markup(base);
  const ribbon = page.querySelector<HTMLElement>(
    '[data-store-element="headingRibbon"]',
  )!;
  const text = page.querySelector<HTMLElement>(
    '[data-store-element="heading"]',
  )!;
  expect(ribbon.style.height).toBe("2.8%");
  expect(text.style.height).toBe("2.8%");
  expect(ribbon.querySelector(".stores-heading")).toBeNull();
  expect(text.querySelector(".stores-heading-ribbon")).toBeNull();
  expect(page.querySelectorAll(".stores-heading")).toHaveLength(1);
  expect(
    page.querySelector<HTMLElement>('[data-store-element="hajde"]')?.style
      .width,
  ).toBe("32%");
});

it.each([undefined, { x: 8, y: 5, width: 55, height: 4 }])(
  "keeps the ribbon stationary on the first separate text move, including a legacy combined placement %j",
  (legacy) => {
    const campaign = structuredClone(base);
    campaign.storesElementPlacements = legacy ? { heading: legacy } : {};
    const expected = legacy || storesHeadingPlacement(campaign);
    preserveStoresHeadingRibbon(campaign);
    campaign.storesElementPlacements.heading = {
      x: 20,
      y: 30,
      width: 40,
      height: 3,
    };
    preserveStoresHeadingRibbon(campaign);
    expect(campaign.storesElementPlacements.headingRibbon).toEqual(expected);
    const page = markup(campaign);
    expect(
      page.querySelector<HTMLElement>('[data-store-element="headingRibbon"]')
        ?.style.left,
    ).toBe(`${expected.x}%`);
    expect(
      page.querySelector<HTMLElement>('[data-store-element="heading"]')?.style
        .left,
    ).toBe("20%");
  },
);

it("persists separate paint and size and removes either part without removing the other", () => {
  const campaign = campaignSchema.parse({
    ...base,
    storesHeadingFontSize: 2.4,
    storesHeadingTextColor: "#123456",
    storesHeadingRibbonColor: "#fedcba",
    storesHiddenElements: ["heading"],
  });
  let page = markup(campaign);
  expect(page.querySelector('[data-store-element="heading"]')).toBeNull();
  expect(
    page.querySelector(".stores-heading-ribbon")?.getAttribute("style"),
  ).toContain("background:#fedcba");
  campaign.storesHiddenElements = ["headingRibbon"];
  page = markup(campaign);
  expect(page.querySelector('[data-store-element="headingRibbon"]')).toBeNull();
  expect(
    page.querySelector(".stores-heading")?.getAttribute("style"),
  ).toContain("color:#123456");
  expect(
    page.querySelector(".stores-heading")?.getAttribute("style"),
  ).toContain(`font-size:${2.4 / 0.41}cqw`);
});
