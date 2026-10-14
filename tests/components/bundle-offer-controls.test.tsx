import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Campaign, Product } from "../../src/domain/models";
import { BundleOfferControls } from "../../src/features/brochure/BundleOfferControls";
import { largeBundlePanelColors } from "../../src/features/brochure/largeBundleLayout";
import { createBundleOffer } from "../../src/features/brochure/productBundles";
import { validBackgroundImage } from "../../src/features/brochure/pageBackground";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const members: Product[] = [
  {
    code: "oven",
    name: "Beko oven",
    regular: 399,
    brochureDetails: [
      "72 L",
      "GRILL, VENTILATOR",
      "STEAM",
      "PROGRAM 1",
      "PROGRAM 2",
    ],
    warranty: "5 VITE",
  },
  {
    code: "hob",
    name: "Beko hob",
    regular: 299,
    brochureDetails: [{ key: "zones", text: "4 + 1 ZONA" }],
  },
  { code: "dishwasher", name: "Beko dishwasher", regular: 310 },
];
const offer: Product = {
  ...createBundleOffer(members),
  code: "set",
  sale: 629,
  brochurePage: 2,
};
const campaign: Campaign = {
  id: "test",
  name: "Brochure",
  products: [offer],
  pages: { 0: { layout: "classic8", backgroundColor: "#6aa2c3" } },
};

it("keeps set settings collapsed and uses the actual page color, with every member detail editable", () => {
  const onChange = vi.fn();
  const view = render(
    <BundleOfferControls
      product={offer}
      campaign={campaign}
      onChange={onChange}
    />,
  );
  expect(view.container.querySelector("details")?.open).toBe(false);
  const color = view.getByLabelText("Set panel color") as HTMLInputElement;
  expect(color.value).toBe(largeBundlePanelColors("#6aa2c3").background);
  const text = view.getByLabelText(
    "Set member details: Beko oven",
  ) as HTMLTextAreaElement;
  expect(text.value).toContain("PROGRAM 2");
  expect(text.value).toContain("5 VITE GARANCION");
  fireEvent.change(text, { target: { value: "Beko oven\n72 L / GRILL" } });
  expect(onChange).toHaveBeenLastCalledWith("bundleMemberDetails", {
    oven: "Beko oven\n72 L / GRILL",
  });
  fireEvent.change(color, { target: { value: "#335577" } });
  expect(onChange).toHaveBeenLastCalledWith("bundlePanelColor", "#335577");
});

it("uploads a replacement set logo locally without a paid provider or network request", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const onChange = vi.fn();
  const view = render(
    <BundleOfferControls product={offer} onChange={onChange} />,
  );
  const svg = new File(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="blue"/></svg>',
    ],
    "brand.svg",
    { type: "image/svg+xml" },
  );
  fireEvent.change(view.getByLabelText("Set brand logo"), {
    target: { files: [svg] },
  });
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(
      "brandLogo",
      expect.stringMatching(/^data:image\/svg\+xml;base64,/),
    ),
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("preserves supplied facts from both set members rather than only the catalog specification map", () => {
  const paired = createBundleOffer(members.slice(0, 2));
  expect(paired.brochureDetails).toContain("PROGRAM 2");
  expect(paired.brochureDetails).toContain("4 + 1 ZONA");
  expect(paired.regular).toBe(698);
});

it("can preview uploaded SVG/AVIF page backgrounds before backend canonicalization", () => {
  expect(validBackgroundImage("data:image/svg+xml;base64,PHN2Zz4=")).toBe(
    "data:image/svg+xml;base64,PHN2Zz4=",
  );
  expect(validBackgroundImage("data:image/avif;base64,AA==")).toBe(
    "data:image/avif;base64,AA==",
  );
  expect(validBackgroundImage("data:text/html;base64,AA==")).toBe("");
});
