import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";
import { splitPages } from "../../src/features/brochure/campaignPages";

function campaign(): Campaign {
  return {
    id: "featured-footer",
    name: "Featured collection",
    brochurePresetId: "neptun-current",
    brochureVisualStyle: "current",
    brochureFooter: { style: "reference" },
    showInteriorFooter: true,
    showFooterPageNumber: true,
    pageDecorationDefaults: { showFooterLogo: false, showFooterLine: false },
    productBackgroundColor: "#1c4075",
    products: [{ code: "tv", name: "TV model", brochurePage: 2 }],
  };
}

function pageElement(value: Campaign) {
  const page = splitPages(value)[0]!;
  const element = document.createElement("div");
  element.innerHTML = renderToStaticMarkup(
    <ProductPage campaign={value} page={page} />,
  );
  return element;
}

it.each(["neptun-current", undefined])(
  "removes inherited footer defaults from the featured collection %s without changing its saved data",
  (preset) => {
    const value = { ...campaign(), brochurePresetId: preset };
    const before = structuredClone(value);
    expect(splitPages(value)[0]).toMatchObject({
      showFooter: false,
      showFooterPageNumber: false,
    });
    const view = pageElement(value);
    expect(view.querySelector(".brochure-interior-brand-footer")).toBeNull();
    expect(view.querySelector(".with-footer")).toBeNull();
    expect(value).toEqual(before);
  },
);

it("restores the classic logo, line and selected page number when the user enables the page footer", () => {
  const value = campaign();
  value.pages = { 0: { showFooter: true, showFooterPageNumber: true } };
  const view = pageElement(value);
  const footer = view.querySelector(".brochure-interior-brand-footer")!;
  expect(footer.querySelector(".neptun-wordmark")).not.toBeNull();
  expect(footer.querySelector(".brochure-interior-footer-line")).not.toBeNull();
  expect(footer.querySelector("b")?.textContent).toBe("2");

  value.pages[0]!.showFooterLogo = false;
  value.pages[0]!.showFooterLine = false;
  value.pages[0]!.showFooterPageNumber = false;
  const changed = pageElement(value);
  expect(changed.querySelector(".neptun-wordmark")).toBeNull();
  expect(changed.querySelector(".brochure-interior-footer-line")).toBeNull();
  expect(changed.querySelector(".brochure-interior-brand-footer b")).toBeNull();
});

it.each(["neptun-october", "neptun-gradient-all", "custom-team-design"])(
  "keeps inherited footer choices for the other design %s",
  (preset) => {
    const value = { ...campaign(), brochurePresetId: preset };
    expect(splitPages(value)[0]).toMatchObject({
      showFooter: true,
      showFooterPageNumber: true,
    });
  },
);
