import React from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import {
  BrochureFooter,
  CoverPage,
} from "../../src/features/brochure/Brochure";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../src/features/brochure/brochurePresets";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const product: Product = {
  code: "tv",
  name: "TV LED Model",
  brand: "Samsung",
  category: "TV",
  specs: { Ekrani: '65"' },
  regular: 749,
  sale: 529,
  warranty: "2 vite",
  brochureDetails: [
    "Smart TV",
    "4K UHD",
    "One UI Tizen",
    "Crystal Processor 4K",
    "HDR10+",
  ],
};
function brochure(id = "neptun-current"): Campaign {
  const campaign: Campaign = {
    id: "reference",
    name: "November offers",
    startDate: "2026-11-05",
    endDate: "2026-11-21",
    products: [
      product,
      { ...product, code: "two" },
      { ...product, code: "three" },
    ],
  };
  applyBrochurePreset(
    campaign,
    availableBrochurePresets(resolveSettings(null)).find(
      (preset) => preset.id === id,
    )!,
  );
  return campaign;
}

it("uses six editable horizontal badges on the Classic hero cover without changing Blue", () => {
  const change = vi.fn(),
    edit = vi.fn();
  const campaign = brochure();
  const view = render(
    <CoverPage
      campaign={campaign}
      onProductChange={change}
      onEditDetails={edit}
    />,
  );
  expect(view.container.querySelector(".classic-reference-cover")).toBeTruthy();
  const hero = view.container.querySelector(".cover-featured-product")!;
  const specs = hero.querySelector(
    '.brochure-specs[data-detail-layout="strip"]',
  )!;
  expect(specs.querySelectorAll(".product-detail-block")).toHaveLength(6);
  expect(within(specs as HTMLElement).getByText("HDR10+")).toBeTruthy();
  fireEvent.doubleClick(within(specs as HTMLElement).getByText("HDR10+"));
  expect(edit).toHaveBeenCalledWith(product, "4");
  view.rerender(<CoverPage campaign={brochure("neptun-october")} />);
  expect(view.container.querySelector(".classic-reference-cover")).toBeNull();
  expect(view.container.querySelector(".brochure-october")).toBeTruthy();
  expect(view.container.querySelector(".reference-offer-footer")).toBeNull();
});

it("flows reference payment and campaign-derived validity with only the printed emphasis", () => {
  const campaign = brochure();
  const view = render(<BrochureFooter campaign={campaign} />);
  const footer = view.container.querySelector(".reference-offer-footer")!;
  expect(footer.textContent).toBe(
    "Paguani deri në 12 këste me 0% interes. Vlen 5 nëntor – 21 nëntor, në dyqane dhe online.",
  );
  expect(
    [...footer.querySelectorAll("strong")].map(
      (element) => element.textContent,
    ),
  ).toEqual(["12 këste", "0% interes.", "Vlen 5 nëntor – 21 nëntor,"]);
  expect(footer.querySelector("strong")!.nextSibling?.textContent).toBe(" me ");
  expect(
    footer.querySelector(".brochure-footer-dates")!.lastChild?.textContent,
  ).toBe(" në dyqane dhe online.");
  view.rerender(
    <BrochureFooter
      campaign={{
        ...campaign,
        installments: 24,
        startDate: "2027-01-09",
        endDate: "2027-01-10",
      }}
    />,
  );
  expect(footer.textContent).toContain("24 këste");
  expect(footer.textContent).toContain("Vlen 9 janar – 10 janar");
  expect(footer.textContent).not.toMatch(/tetor|nëntor/);
});

it("preserves custom wording and saves both footer fields as plain editable text", () => {
  const change = vi.fn();
  const campaign = {
    ...brochure(),
    paymentText: "Pagesë në 6 këste sipas marrëveshjes.",
    brochureFooter: {
      style: "reference" as const,
      dateText: "Oferta e fundjavës",
    },
  };
  const view = render(
    <BrochureFooter campaign={campaign} onTextChange={change} />,
  );
  const payment = view.getByRole("textbox", { name: "Footer payment text" });
  const dates = view.getByRole("textbox", { name: "Brochure dates text" });
  expect(payment.textContent).toBe(campaign.paymentText);
  expect(
    [...payment.querySelectorAll("strong")].map(
      (element) => element.textContent,
    ),
  ).toEqual(["6 këste"]);
  expect(dates.querySelector("strong")).toBeNull();
  payment.textContent = "Custom payment <text>";
  fireEvent.blur(payment);
  dates.textContent = "Custom validity";
  fireEvent.blur(dates);
  expect(change.mock.calls).toEqual([
    ["paymentText", "Custom payment <text>"],
    ["dateText", "Custom validity"],
  ]);
  expect(campaign.paymentText).toBe("Pagesë në 6 këste sipas marrëveshjes.");
});

it("keeps saved cover frames, region placement, image scale, badge dimensions and footer geometry", () => {
  const campaign = brochure();
  campaign.coverElementPlacements = {
    "product-tv": { x: 4, y: 11, width: 90, height: 40 },
    footer: { x: 5, y: 94, width: 90, height: 4 },
  };
  campaign.products[0] = {
    ...campaign.products[0]!,
    image: "/tv.png",
    brochureImagePlacement: { x: 48, y: 49, scale: 0.9 },
    brochureContentPlacement: {
      specs: { x: 3, y: 1, width: 65 },
      price: { x: -1, y: 2, width: 24 },
    },
    detailBlockPlacements: { "0": { x: 1, y: 0.5, width: 18, height: 6 } },
  };
  const original = structuredClone(campaign);
  const view = render(<CoverPage campaign={campaign} />);
  const frame = view.container.querySelector<HTMLElement>(
    ".cover-element-product-tv",
  )!;
  expect([
    frame.style.left,
    frame.style.top,
    frame.style.width,
    frame.style.height,
  ]).toEqual(["4%", "11%", "90%", "40%"]);
  const card = frame.querySelector<HTMLElement>(".brochure-product")!;
  expect(card.dataset.defaultLayout).toBeUndefined();
  const image = frame.querySelector<HTMLImageElement>(
    ".brochure-product-image",
  )!;
  expect([image.style.left, image.style.top, image.style.transform]).toEqual([
    "48%",
    "49%",
    "translate(-50%, -50%) scale(0.9)",
  ]);
  const price = frame.querySelector<HTMLElement>(".brochure-price")!;
  expect([price.style.width, price.style.transform]).toEqual([
    "24%",
    "translate(-1cqw, 2cqw)",
  ]);
  const specs = frame.querySelector<HTMLElement>(".brochure-specs")!;
  expect([specs.style.width, specs.style.transform]).toEqual([
    "65%",
    "translate(3cqw, 1cqw)",
  ]);
  const badge = specs.querySelector<HTMLElement>('[data-detail-key="0"]')!;
  expect([badge.style.width, badge.style.height, badge.style.maxWidth]).toEqual(
    ["18%", "6cqw", "none"],
  );
  const footer = view.container.querySelector<HTMLElement>(
    ".brochure-footer-element",
  )!;
  expect([
    footer.style.left,
    footer.style.top,
    footer.style.width,
    footer.style.height,
  ]).toEqual(["5%", "94%", "90%", "4%"]);
  expect(campaign).toEqual(original);
});

it("scales default Classic and Blue cover cards for all assigned offers while retaining custom content geometry", () => {
  const campaign = brochure();
  campaign.products.push({ ...product, code: "four" });
  campaign.products.forEach((item) => {
    item.brochurePage = 1;
  });
  const view = render(<CoverPage campaign={campaign} />);
  expect(view.container.querySelectorAll(".cover-product-frame")).toHaveLength(
    4,
  );
  const small = view.container.querySelector<HTMLElement>(
    ".cover-element-product-four",
  )!;
  expect(
    Number(small.style.getPropertyValue("--cover-card-scale")),
  ).toBeLessThan(1);
  expect(small.querySelector("[data-cover-card-default=true]")).toBeTruthy();
  const blue = brochure("neptun-october");
  blue.products.forEach((item) => {
    item.brochurePage = 1;
  });
  view.rerender(<CoverPage campaign={blue} />);
  expect(view.container.querySelectorAll(".cover-product-frame")).toHaveLength(
    3,
  );
  const blueCard = view.container.querySelector<HTMLElement>(
    ".cover-element-product-three",
  )!;
  expect(
    Number(blueCard.style.getPropertyValue("--cover-card-scale")),
  ).toBeLessThan(1);
  expect(blueCard.querySelector("[data-cover-card-default=true]")).toBeTruthy();
  blue.products[2]!.brochureContentPlacement = {
    price: { x: 2, y: 1, width: 25 },
  };
  view.rerender(<CoverPage campaign={blue} />);
  expect(
    view.container.querySelector(
      ".cover-element-product-three [data-cover-card-default=true]",
    ),
  ).toBeNull();
});
