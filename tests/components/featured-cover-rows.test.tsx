import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { CoverPage } from "../../src/features/brochure/Brochure";
import { CoverDesignControls } from "../../src/features/brochure/CoverDesignControls";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);

function campaign(count: number): Campaign {
  return {
    id: "featured-render",
    name: "Featured collection",
    brochurePresetId: "neptun-current",
    coverBandVariant: "hajde",
    brochureFooter: { style: "reference" },
    products: Array.from({ length: count }, (_, index) => ({
      code: `offer-${index}`,
      name: `Offer ${index}`,
      brochurePage: 1,
    })),
  };
}

it.each([1, 2, 3, 4, 10])(
  "renders all %i cover offers with only one featured product",
  (count) => {
    const root = document.createElement("div");
    root.innerHTML = renderToStaticMarkup(
      <CoverPage campaign={campaign(count)} />,
    );
    expect(root.querySelectorAll(".cover-product-frame")).toHaveLength(count);
    expect(root.querySelectorAll(".cover-featured-product")).toHaveLength(1);
    const hero = root.querySelector<HTMLElement>(".cover-featured-product")!;
    expect(hero.style.top).toBe("19%");
    if (count <= 4) expect(hero.style.height).toBe("34.5%");
  },
);

it("renders a saved lower-row single product without restoring its default top position", () => {
  const value = campaign(1);
  value.coverElementPlacements = {
    "product-offer-0": { x: 6, y: 60, width: 88, height: 30 },
  };
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(<CoverPage campaign={value} />);
  const frame = root.querySelector<HTMLElement>(".cover-product-frame")!;
  expect([
    frame.style.left,
    frame.style.top,
    frame.style.width,
    frame.style.height,
  ]).toEqual(["6%", "60%", "88%", "30%"]);
});

it("shows the actual featured default in the layout picker even with one product", () => {
  const view = render(
    <CoverDesignControls campaign={campaign(1)} onUpdate={vi.fn()} />,
  );
  expect(
    view.getByRole("combobox", { name: "Cover product layout" }).textContent,
  ).toContain("One featured product above the rest");
});

it.each(["#1b4075", "#e3e3e3"])(
  "gives both stacked offers a wide automatic photo slot on %s",
  (coverBackgroundColor) => {
    const value = { ...campaign(2), coverBackgroundColor };
    const view = render(<CoverPage campaign={value} />);
    expect(
      view.container.querySelector(".classic-reference-cover"),
    ).toBeTruthy();
    expect(
      view.container.querySelectorAll(".cover-product-wide-default"),
    ).toHaveLength(2);
    const cards = Array.from(
      view.container.querySelectorAll<HTMLElement>(".cover-product-frame"),
    );
    expect(cards[0]!.style.width).toBe("94%");
    expect(cards[1]!.style.width).toBe("94%");
    expect(parseFloat(cards[1]!.style.top)).toBeGreaterThan(
      parseFloat(cards[0]!.style.top) + parseFloat(cards[0]!.style.height),
    );
  },
);

it("keeps manually positioned cover frames and photos outside the wider automatic photo rule", () => {
  const value = campaign(2);
  value.coverElementPlacements = {
    "product-offer-0": { x: 4, y: 20, width: 70, height: 25 },
  };
  value.products[1]!.brochureImagePlacement = { x: 48, y: 49, scale: 0.9 };
  const view = render(<CoverPage campaign={value} />);
  expect(
    view.container.querySelectorAll(".cover-product-wide-default"),
  ).toHaveLength(0);
  const frame = view.container.querySelector<HTMLElement>(
    ".cover-element-product-offer-0",
  )!;
  expect([
    frame.style.left,
    frame.style.top,
    frame.style.width,
    frame.style.height,
  ]).toEqual(["4%", "20%", "70%", "25%"]);
});
