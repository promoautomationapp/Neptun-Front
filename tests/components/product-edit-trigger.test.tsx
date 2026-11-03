import React from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";
import { setLanguage } from "../../src/features/brochure/i18n";
import { brochurePage } from "../fixtures/brochure-page";

const product: Product = {
  code: "tv-offer",
  name: "Samsung television",
  brand: "SAMSUNG",
  regular: 549,
  sale: 399,
  brochureDetails: ["4K Ultra HD", "Smart TV"],
};
const campaign: Campaign = {
  id: "edit-trigger",
  name: "Offers",
  products: [product],
  offerStyle: "current",
  includeStoresFooter: false,
};

afterEach(() => {
  cleanup();
  setLanguage("en");
});

it.each([
  ["en", "Edit product"],
  ["sq", "Ndrysho produktin"],
])(
  "keeps the %s product pencil named and its actions usable",
  (language, label) => {
    setLanguage(language!);
    const edit = vi.fn();
    const view = render(
      <ProductPage
        campaign={campaign}
        page={brochurePage([product])}
        onEditDetails={edit}
      />,
    );
    const trigger = view.getByLabelText(`${label}: ${product.name}`);
    expect(trigger.tagName).toBe("SUMMARY");
    expect(trigger.getAttribute("title")).toBe(`${label}: ${product.name}`);
    expect(trigger.textContent).toBe("");
    expect(trigger.querySelector("svg[aria-hidden='true']")).not.toBeNull();
    const menu = trigger.closest("details")!;
    expect(menu.getAttribute("data-export-hide")).toBe("true");
    menu.open = true;
    fireEvent(menu, new Event("toggle"));
    fireEvent.click(
      within(
        document.querySelector<HTMLElement>(".cs-product-menu-popover")!,
      ).getByRole("button", {
        name: `${language === "sq" ? "Ndrysho detajet e produktit" : "Edit product details"}: ${product.name}`,
      }),
    );
    expect(edit).toHaveBeenCalledWith(product);
    expect(menu.open).toBe(false);
  },
);

it("omits the product editing control from a read-only/export page", () => {
  const view = render(
    <ProductPage campaign={campaign} page={brochurePage([product])} />,
  );
  expect(view.container.querySelector(".cs-product-tools")).toBeNull();
});
