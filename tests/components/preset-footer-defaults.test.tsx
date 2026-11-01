import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Campaign, CampaignMutator } from "../../src/domain/models";
import { campaignSchema } from "../../src/domain/schemas";
import {
  BrochureFooter,
  CoverPage,
  ProductPage,
} from "../../src/features/brochure/Brochure";
import { FooterDesignControls } from "../../src/features/brochure/FooterDesignControls";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../src/features/brochure/brochurePresets";
import { splitPages } from "../../src/features/brochure/campaignPages";
import { setLanguage } from "../../src/features/brochure/i18n";
import { resolveSettings } from "../../src/features/settings/settings.schema";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);

function campaign(presetId: string): Campaign {
  const value: Campaign = {
    id: "footer",
    name: "Offers",
    startDate: "2026-10-14",
    endDate: "2026-10-26",
    products: Array.from({ length: 5 }, (_, index) => ({
      code: `p${index}`,
      name: `Product ${index}`,
    })),
  };
  applyBrochurePreset(
    value,
    availableBrochurePresets(resolveSettings(null)).find(
      (preset) => preset.id === presetId,
    )!,
  );
  return value;
}

it("starts Featured Product Collection product pages without a logo, line or number, while respecting a saved page choice", () => {
  const value = campaign("neptun-current");
  const page = splitPages(value)[0]!;
  expect(page.showFooter).toBe(false);
  expect(page.showFooterPageNumber).toBe(false);
  const view = render(<ProductPage campaign={value} page={page} />);
  expect(
    view.container.querySelector(".brochure-interior-brand-footer"),
  ).toBeNull();
  value.pages = { 0: { showFooter: true, showFooterPageNumber: true } };
  view.rerender(<ProductPage campaign={value} page={splitPages(value)[0]!} />);
  expect(
    view.container.querySelector(".brochure-interior-brand-footer"),
  ).toBeTruthy();
  expect(
    view.container.querySelector(".brochure-interior-footer-line"),
  ).toBeTruthy();
  expect(
    view.container.querySelector(".brochure-interior-brand-footer b")
      ?.textContent,
  ).toBe("2");
});

it("gives Catalogue Edition an editable fading strip with dynamic dates and installments and no award logos", () => {
  const value = campaign("neptun-uuu-gray");
  expect(campaignSchema.parse(value).brochureFooter).toEqual(
    value.brochureFooter,
  );
  const view = render(<CoverPage campaign={value} />);
  expect(
    view.container.querySelector(".cover-element-october-awards"),
  ).toBeNull();
  expect(view.container.querySelector(".brochure-awards")).toBeNull();
  const footer = view.container.querySelector<HTMLElement>(
    ".brochure-footer-fading",
  )!;
  expect(footer).toBeTruthy();
  expect(footer.style.background).toContain("rgba(255, 66, 40, 0) 100%");
  expect(footer.style.gridTemplateColumns).toBe("55% 1fr");
  expect(footer.querySelector(".brochure-footer-dates")?.textContent).toBe(
    "Vlen 14 – 26 tetor",
  );
  expect(footer.querySelector(".brochure-footer-payment")?.textContent).toBe(
    "Paguani deri në 12 këste me 0% interes.",
  );
  const frame = view.container.querySelector<HTMLElement>(
    ".brochure-footer-element",
  )!;
  expect(frame.style.height).toBe("4%");
  expect(Number.parseFloat(frame.style.top)).toBeCloseTo(100 - 4 - 19 / 13.5);
  value.installments = 24;
  value.startDate = "2026-10-29";
  value.endDate = "2026-11-16";
  view.rerender(<CoverPage campaign={value} />);
  expect(
    view.container.querySelector(".brochure-footer-dates")?.textContent,
  ).toBe("Vlen 29 tetor – 16 nëntor");
  expect(
    view.container.querySelector(".brochure-footer-payment")?.textContent,
  ).toContain("24 këste");
});

it("preserves explicit footer wording, colors, award choice and manual placement", () => {
  const value = campaign("neptun-uuu-gray");
  value.paymentText = "Pagesë sipas marrëveshjes.";
  value.brochureFooter = {
    ...value.brochureFooter,
    dateText: "Oferta e fundjavës",
    from: "#552244",
    showAwards: true,
  };
  value.coverElementPlacements = {
    footer: { x: 4, y: 90, width: 92, height: 6 },
  };
  const view = render(<BrochureFooter campaign={value} />);
  const frame = view.container.querySelector<HTMLElement>(
    ".brochure-footer-element",
  )!;
  expect([
    frame.style.left,
    frame.style.top,
    frame.style.width,
    frame.style.height,
  ]).toEqual(["4%", "90%", "92%", "6%"]);
  expect(
    view.container.querySelector(".brochure-footer-dates")?.textContent,
  ).toBe("Oferta e fundjavës");
  expect(
    view.container.querySelector(".brochure-footer-payment")?.textContent,
  ).toBe("Pagesë sipas marrëveshjes.");
  expect(view.container.querySelector(".brochure-awards")).toBeTruthy();
});

it("lets staff change fading and award visibility in Albanian without resetting other footer settings", () => {
  setLanguage("sq");
  const value = campaign("neptun-uuu-gray");
  const update = vi.fn((mutate: CampaignMutator) => mutate(value));
  const view = render(
    <FooterDesignControls campaign={value} onUpdate={update} />,
  );
  fireEvent.click(
    view.getByRole("checkbox", { name: "Zbehe drejt sfondit të kopertinës" }),
  );
  fireEvent.click(
    view.getByRole("checkbox", { name: "Shfaq logot e çmimeve të fituara" }),
  );
  expect(value.brochureFooter).toMatchObject({
    fadeEnd: false,
    showAwards: true,
    bottom: 19,
    dateSize: 2.8,
  });
});
