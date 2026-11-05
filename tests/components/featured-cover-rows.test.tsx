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
