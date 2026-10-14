import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it } from "vitest";
import { BrochureEditor } from "../../src/features/studio/Studio";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));

it("opens the brochure with product, logo and page edit controls available", () => {
  const campaign = {
    id: "edit-proof", name: "Fall offers", type: "Fall offers", theme: "blue",
    products: [{ code: "tv-1", name: "TV LED 65", brand: "LG", image: "/tv.png", regular: 700, sale: 500, brochurePage: 1 }],
    coverProductCodes: ["tv-1"],
  };
  const markup = renderToStaticMarkup(React.createElement(BrochureEditor, {
    campaign, settings: { stores: [], contact: {} }, user: {}, members: [],
    onUpdate: () => {}, onToast: () => {}, onReviewAction: async () => true, onAiReview: () => {}, onReCut: () => {},
    onPrint: () => {}, onExport: () => {}, onAddProducts: () => {}, onImportProducts: () => {},
    onEditImage: () => {}, onEditScreen: () => {}, onEditDetails: () => {}, onEditPrice: () => {}, onEditSavings: () => {}, onMakeSocial: () => {},
  } as unknown as React.ComponentProps<typeof BrochureEditor>));
  expect(markup).toContain("cs-page-preview edit-view");
  expect(markup).toContain("Change cover logo");
  expect(markup).toContain("Add image to page");
  expect(markup).toContain("Preview only");
  expect(markup).toContain("Change image: TV LED 65");
  expect(markup).toContain("Move cover logo");
});
