import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { BrandLogoManager } from "../../src/features/brochure/BrandLogoManager";
import { ProductBrandArtwork } from "../../src/features/brochure/ProductBrandArtwork";
import { BUILTIN_BRAND_LOGOS } from "../../src/features/brochure/brandLogos";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(() => {
  cleanup();
  setLanguage("sq");
});

it("explicitly applies an already prepared logo over BF per-product SVGs and matching set members", () => {
  setLanguage("en");
  const campaign: Campaign = {
    id: "bf",
    name: "BF",
    brandLogoColor: "#663399",
    products: [
      {
        code: "cover",
        name: "TV",
        brand: "LG",
        brandLogo: "/brochure-presets/black-friday/brands/p01-01.svg",
        brochurePage: 1,
      },
      {
        code: "inside",
        name: "TV",
        brand: "lg",
        brandLogo: "/brochure-presets/black-friday/brands/p03-04.svg",
        brochurePage: 3,
      },
      {
        code: "set",
        name: "Set",
        brand: "BEKO / LG",
        bundleProducts: [
          {
            code: "member",
            name: "LG TV",
            brand: "LG",
            brandLogo: "/source-member.svg",
          },
          {
            code: "beko",
            name: "Beko TV",
            brand: "BEKO",
            brandLogo: "/beko.svg",
          },
        ],
      },
    ],
  };
  const update = vi.fn((mutate) => mutate(campaign));
  const content = () => (
    <>
      <BrandLogoManager campaign={campaign} onUpdate={update} />
      <ProductBrandArtwork
        campaign={campaign}
        product={campaign.products![0]!}
      />
    </>
  );
  const view = render(content());
  view.container.querySelector<HTMLDetailsElement>("details")!.open = true;
  fireEvent.click(view.getByRole("button", { name: "LG" }));
  fireEvent.click(view.getByRole("button", { name: "Use prepared logo" }));
  expect(update).not.toHaveBeenCalled();
  fireEvent.click(
    view.getByRole("button", { name: "Apply to all LG products" }),
  );
  view.rerender(content());
  expect(update).toHaveBeenCalledOnce();
  expect(campaign.brandLogos?.LG).toBe(BUILTIN_BRAND_LOGOS.LG);
  expect(campaign.products![0]!.brandLogo).toBe(BUILTIN_BRAND_LOGOS.LG);
  expect(campaign.products![1]!.brandLogo).toBe(BUILTIN_BRAND_LOGOS.LG);
  expect(campaign.products![2]!.bundleProducts![0]!.brandLogo).toBe(
    BUILTIN_BRAND_LOGOS.LG,
  );
  expect(campaign.products![2]!.bundleProducts![1]!.brandLogo).toBe(
    "/beko.svg",
  );
  expect(campaign.brandLogoColor).toBe("#663399");
  expect(
    view.container
      .querySelector(".brochure-brand-artwork img")
      ?.getAttribute("src"),
  ).toBe(BUILTIN_BRAND_LOGOS.LG);
  expect(view.getByRole("status").textContent).toContain("this brochure");
});
