import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { AwardBadges, StoresPage } from "../../src/features/brochure/Brochure";
import { setLanguage } from "../../src/features/brochure/i18n";
import { resolveSettings } from "../../src/features/settings/settings.schema";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);
const base: Campaign = { id: "awards", name: "Offers", products: [] };

it("uses two clean independent official award images even for legacy combined artwork", () => {
  const view = render(
    <AwardBadges
      campaign={{ ...base, brandAssets: { awards: "/old-combined.png" } }}
      onChange={vi.fn()}
    />,
  );
  expect(view.getByAltText("BestBuy Award").getAttribute("src")).toBe(
    "/brochure-presets/october/bestbuy.png",
  );
  expect(view.getByAltText("QUDAL Quality Medal").getAttribute("src")).toBe(
    "/brochure-presets/october/qudal.png",
  );
  expect(
    view.container.querySelectorAll(".campaign-asset-artwork"),
  ).toHaveLength(2);
  expect(
    view.container.querySelector(".award-combined,.award-default"),
  ).toBeNull();
});

it("keeps each logo's replacement, placement and visibility independent", () => {
  const change = vi.fn();
  const campaign: Campaign = {
    ...base,
    campaignAssets: {
      "stores-bestbuy": {
        image: "/my-bestbuy.png",
        placement: { x: 3, y: 2, width: 45, height: 7 },
      },
      "stores-qudal": { hidden: true },
    },
  };
  const view = render(
    <AwardBadges campaign={campaign} scope="stores" onChange={change} />,
  );
  const bestbuy = view.getByAltText("BestBuy Award");
  expect(bestbuy.getAttribute("src")).toBe("/my-bestbuy.png");
  expect(
    bestbuy.closest<HTMLElement>(".campaign-asset-artwork")?.style.transform,
  ).toBe("translate(3cqw, 2cqw)");
  expect(view.queryByAltText("QUDAL Quality Medal")).toBeNull();
  fireEvent.click(
    view.getByRole("button", { name: "Restore QUDAL Quality Medal" }),
  );
  expect(change).toHaveBeenCalledWith("stores-qudal", { hidden: false });
});

it("shows the stores awards by default without a group move/delete handle", () => {
  const view = render(
    <StoresPage
      campaign={{ ...base, storesBackgroundColor: "#000000" }}
      settings={resolveSettings(null)}
      onCampaignAssetChange={vi.fn()}
      onElementChange={vi.fn()}
      onElementHide={vi.fn()}
    />,
  );
  const group = view.container.querySelector<HTMLElement>(
    '[data-store-element="awards"]',
  )!;
  expect(group).toBeTruthy();
  expect(group.classList.contains("editable")).toBe(false);
  expect(group.querySelector(".stores-element-tools")).toBeNull();
  expect(group.querySelectorAll(".campaign-asset-artwork")).toHaveLength(2);
  expect(view.getByAltText("BestBuy Award")).toBeTruthy();
  expect(view.getByAltText("QUDAL Quality Medal")).toBeTruthy();
});
