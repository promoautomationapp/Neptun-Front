import React from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";
import { PageDecorations } from "../../src/features/brochure/PageDecorations";
import type { BrochurePage } from "../../src/features/brochure/campaignPages";
import { OfferStyleControls } from "../../src/features/brochure/OfferStyleControls";
import { OFFER_STYLES } from "../../src/features/brochure/offerStyles";
import { OCTOBER_ASSETS } from "../../src/features/brochure/octoberDesign";
import {
  availableBrochurePresets,
  applyBrochurePreset,
} from "../../src/features/brochure/brochurePresets";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);
const product = (code: string, extra: Partial<Product> = {}): Product => ({
  code,
  name: `TV ${code}`,
  brand: "LG",
  category: "Electronics",
  subcategory: "Televizorë",
  regular: 449,
  sale: 319,
  image: "/television.svg",
  warranty: "2 VITE",
  brochureDetails: [
    "QLED TV / 4K UHD",
    "Quad Core Processor",
    "HDR10 / Dolby Vision",
  ],
  ...extra,
});
const campaign = (products: Product[]): Campaign => {
  const value: Campaign = { id: "october", name: "October", products };
  applyBrochurePreset(
    value,
    availableBrochurePresets(resolveSettings(null))[1]!,
  );
  return value;
};
const page = (
  products: Product[],
  extra: Partial<BrochurePage> = {},
): BrochurePage => ({
  index: 0,
  title: "Page 2",
  layout: "duo4",
  products,
  image: "",
  backgroundColor: "#e3e3e3",
  backgroundImage: "",
  backgroundGradient: null,
  showFooter: true,
  showFooterPageNumber: true,
  spacing: null,
  ...extra,
});

it("prints the shared category as editable text, leaves mixed-category ribbons blank and uses Apple artwork on Apple pages", () => {
  const products = [
    product("one"),
    product("two", { subcategory: "televizore" }),
  ];
  const value = campaign(products),
    change = vi.fn();
  const view = render(
    <PageDecorations
      campaign={value}
      page={page(products)}
      onChange={change}
    />,
  );
  const heading = view.getByRole("textbox", { name: "Category heading" });
  expect(heading.textContent).toBe("Televizorë");
  heading.textContent = "Oferta të reja";
  fireEvent.blur(heading);
  expect(change).toHaveBeenCalledWith({ headerText: "Oferta të reja" });
  const mixed = [
    product("tv"),
    product("washer", {
      category: "Appliances",
      subcategory: "Washing machines",
    }),
  ];
  view.rerender(<PageDecorations campaign={value} page={page(mixed)} />);
  expect(
    view.container.querySelector(".october-category-ribbon")?.textContent,
  ).toBe("");
  const apple = [product("phone", { brand: "Apple", name: "iPhone 17" })];
  view.rerender(<PageDecorations campaign={value} page={page(apple)} />);
  expect(view.container.querySelector(".october-category-ribbon")).toBeNull();
  expect(
    view.getByAltText("Apple Authorised Reseller").getAttribute("src"),
  ).toBe(OCTOBER_ASSETS.apple);
});

it("removes logo, line and page number independently for only the selected page", () => {
  const products = [product("one")],
    value = campaign(products);
  value.pages = { 0: { showFooterLogo: false } };
  const view = render(
    <PageDecorations campaign={value} page={page(products)} />,
  );
  expect(view.container.querySelector(".october-footer-logo")).toBeNull();
  expect(view.container.querySelector(".october-footer-rule")).toBeTruthy();
  expect(
    view.container.querySelector(".october-page-number")?.textContent,
  ).toBe("2");
  value.pages[0] = { showFooterLine: false };
  view.rerender(<PageDecorations campaign={value} page={page(products)} />);
  expect(view.container.querySelector(".october-footer-logo")).toBeTruthy();
  expect(view.container.querySelector(".october-footer-rule")).toBeNull();
  expect(view.container.querySelector(".october-page-number")).toBeTruthy();
  view.rerender(
    <PageDecorations
      campaign={value}
      page={page(products, { showFooterPageNumber: false })}
    />,
  );
  expect(view.container.querySelector(".october-page-number")).toBeNull();
  expect(view.container.querySelector(".october-footer-logo")).toBeTruthy();
  view.rerender(
    <PageDecorations campaign={value} page={page(products, { index: 1 })} />,
  );
  expect(view.container.querySelector(".october-footer-rule")).toBeTruthy();
  expect(
    view.container.querySelector(".october-page-number")?.textContent,
  ).toBe("3");
  view.rerender(
    <PageDecorations
      campaign={value}
      page={page(products, { showFooter: false })}
    />,
  );
  expect(
    view.container.querySelector(
      ".october-footer-logo,.october-footer-line,.october-footer-number",
    ),
  ).toBeNull();
  expect(view.container.querySelector(".october-category-ribbon")).toBeTruthy();
});

it("uses transparent native asset files and respects page-specific hiding and custom pagination text", () => {
  const products = [product("one")],
    value = campaign(products),
    change = vi.fn();
  expect(value.brandAssets).toMatchObject({
    neptun: OCTOBER_ASSETS.neptun,
    storesHajde: OCTOBER_ASSETS.hajde,
    balfin: OCTOBER_ASSETS.balfin,
  });
  value.pages = {
    0: {
      footerNumber: "A2",
      showOnlineLogo: false,
      footerLineColor: "#446688",
    },
  };
  const view = render(
    <PageDecorations
      campaign={value}
      page={page(products)}
      onChange={change}
    />,
  );
  expect(view.queryByAltText("Buy online and in store")).toBeNull();
  expect(view.getByAltText("NEPTUN").getAttribute("src")).toBe(
    OCTOBER_ASSETS.neptun,
  );
  const number = view.getByRole("textbox", { name: "Page number" });
  expect(number.textContent).toBe("A2");
  number.textContent = "Custom";
  fireEvent.blur(number);
  expect(change).toHaveBeenCalledWith({ footerNumber: "Custom" });
  expect(
    (view.container.querySelector(".october-footer-rule") as HTMLElement).style
      .backgroundColor,
  ).toBe("rgb(68, 102, 136)");
  delete value.pages[0]!.showOnlineLogo;
  view.rerender(<PageDecorations campaign={value} page={page(products)} />);
  expect(view.getByAltText("Buy online and in store").getAttribute("src")).toBe(
    OCTOBER_ASSETS.online,
  );
});

it("renders a complete October product page with the blue price card and a single editable decoration system", () => {
  const products = Array.from({ length: 4 }, (_, index) =>
    product(String(index)),
  );
  const value = campaign(products),
    update = vi.fn(),
    decorate = vi.fn();
  const view = render(
    <ProductPage
      campaign={value}
      page={page(products)}
      onProductChange={update}
      onPageDecorationChange={decorate}
    />,
  );
  expect(
    view.container.querySelector(".brochure-october.layout-duo4"),
  ).toBeTruthy();
  expect(view.container.querySelectorAll(".brochure-product")).toHaveLength(4);
  expect(view.container.querySelectorAll(".reference-price-card")).toHaveLength(
    4,
  );
  expect(view.container.querySelectorAll(".reference-saving-tab")).toHaveLength(
    4,
  );
  expect(
    view.container.querySelector(".brochure-interior-brand-footer"),
  ).toBeNull();
  expect(view.container.querySelectorAll(".october-footer-logo")).toHaveLength(
    1,
  );
  expect(view.getByRole("textbox", { name: "Category heading" })).toBeTruthy();
});

it("offers exactly the original red price design and the PDF blue design while keeping savings choice separate", () => {
  expect(OFFER_STYLES.map((style) => style.id)).toEqual(["current", "card"]);
  const change = vi.fn();
  const view = render(
    <OfferStyleControls
      styleValue="card"
      savingValue="amount"
      onStyleChange={change}
      onSavingChange={vi.fn()}
    />,
  );
  const designs = within(
    view.getByRole("group", { name: "Offer card style" }),
  ).getAllByRole("button");
  expect(designs).toHaveLength(2);
  expect(designs[1]!.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(designs[0]!);
  expect(change).toHaveBeenCalledWith("current");
  expect(
    within(view.getByRole("group", { name: "Savings label" })).getAllByRole(
      "button",
    ),
  ).toHaveLength(2);
});
