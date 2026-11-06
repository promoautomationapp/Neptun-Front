import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { CoverPage, ProductPage } from "../../src/features/brochure/Brochure";
import { builtInBrochurePresets } from "../../src/features/brochure/brochurePresets";
import { splitPages } from "../../src/features/brochure/campaignPages";
import { useCampaignEditHistory } from "../../src/features/brochure/useCampaignEditHistory";

afterEach(cleanup);
const products: Product[] = ["GREEN", "GREY"].map((color, index) => ({
  code: `SKU${index}`,
  name: `SAMSUNG ${index === 0 ? "SM-A376BDGBEUC" : "SM-A376BZABEUC"} A37 5G 6/128GB ${color}`,
  brand: "SAMSUNG",
  regular: 449,
  sale: 299,
  image: `/phone-${index}.png`,
  brochurePage: 1,
  brochureOrder: 1,
  specs: { Model: index === 0 ? "SM-A376BDGBEUC" : "SM-A376BZABEUC" },
}));

it("shows one model, photo and shared price with two swatches in all five cover/interior designs", () => {
  for (const preset of builtInBrochurePresets) {
    const campaign: Campaign = {
      ...preset.design,
      id: preset.id,
      name: "Legacy colors",
      products: structuredClone(products),
      includeStoresPage: false,
    };
    const before = structuredClone(campaign);
    const interior = {
      ...campaign,
      products: campaign.products.map((product) => ({
        ...product,
        brochurePage: 2,
      })),
    };
    for (const element of [
      <CoverPage campaign={campaign} />,
      <ProductPage campaign={interior} page={splitPages(interior)[0]!} />,
    ]) {
      const container = document.createElement("div");
      container.innerHTML = renderToStaticMarkup(element);
      expect(
        container.querySelectorAll(".brochure-product"),
        preset.id,
      ).toHaveLength(1);
      expect(
        container.querySelectorAll(".brochure-product-image"),
        preset.id,
      ).toHaveLength(1);
      expect(
        container.querySelectorAll(".brochure-colors i"),
        preset.id,
      ).toHaveLength(2);
      expect(
        container.querySelector(".brochure-product-copy")?.textContent,
        preset.id,
      ).not.toMatch(/GREEN|GREY/);
    }
    expect(campaign).toEqual(before);
  }
});

it("materializes the grouped first SKU before editing so price/name changes and undo/redo remain coherent", async () => {
  const original: Campaign = {
    id: "edit-colors",
    name: "Legacy",
    products: structuredClone(products),
  };
  const persist = vi.fn(async (campaign: Campaign) => campaign);
  const { result } = renderHook(() =>
    useCampaignEditHistory({ activeId: original.id, enabled: true, persist }),
  );
  act(() => result.current.setCampaigns([original]));
  expect(result.current.campaigns[0]?.products).toHaveLength(2);
  let saved: ReturnType<typeof result.current.updateCampaign>;
  act(() => {
    saved = result.current.updateCampaign((draft) => {
      draft.products[0]!.sale = 279;
      draft.products[0]!.name = "A37 5G 6/128 · Edited offer";
    });
  });
  await act(async () => {
    await saved!.saved;
  });
  expect(result.current.campaigns[0]?.products).toHaveLength(1);
  expect(result.current.campaigns[0]?.products[0]).toMatchObject({
    code: "SKU0",
    sale: 279,
    name: "A37 5G 6/128 · Edited offer",
  });
  expect(
    result.current.campaigns[0]?.products[0]?.brochureVariants,
  ).toHaveLength(2);
  act(() => {
    expect(result.current.undoCampaign()).toBe(true);
  });
  expect(result.current.campaigns[0]?.products).toHaveLength(2);
  act(() => {
    expect(result.current.redoCampaign()).toBe(true);
  });
  expect(result.current.campaigns[0]?.products).toHaveLength(1);
});
