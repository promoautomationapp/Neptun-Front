import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { CoverPage } from "../../src/features/brochure/Brochure";
import { CoverDesignControls } from "../../src/features/brochure/CoverDesignControls";
import { setLanguage } from "../../src/features/brochure/i18n";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../src/features/brochure/brochurePresets";
import { coverProductPlacement } from "../../src/features/brochure/coverElements";
import { resolveSettings } from "../../src/features/settings/settings.schema";

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
    expect(hero.style.top).toBe("28%");
    if (count <= 4) expect(hero.style.height).toBe("31%");
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

it.each(["pair", "row"])(
  "records a staff-selected %s cover layout so reloading cannot migrate it",
  (layout) => {
    const value = campaign(2);
    const view = render(
      <CoverDesignControls
        campaign={value}
        onUpdate={(mutate) => mutate(value)}
      />,
    );
    fireEvent.click(
      view.getByRole("combobox", { name: "Cover product layout" }),
    );
    fireEvent.click(
      view.getByRole("option", {
        name:
          layout === "pair"
            ? "Two products beside each other"
            : "Products in one row",
      }),
    );
    expect(value.coverProductLayout).toBe(layout);
    expect(value.coverProductLayoutManual).toBe(true);
  },
);

it.each(["neptun-current", "neptun-gradient-all"])(
  "renders the real %s collection as one above the rest even with saved legacy pair frames",
  (presetId) => {
    const settings = resolveSettings(null);
    settings.brochure.coverProductLayout = "pair";
    settings.brochure.coverBackground.color = "#1b4075";
    const preset = availableBrochurePresets(settings).find(
      (item) => item.id === presetId,
    )!;
    expect(preset.design.coverProductLayout).toBe("hero");
    for (const count of [2, 3, 4]) {
      const value = campaign(count);
      applyBrochurePreset(value, preset);
      value.coverProductLayout = "pair";
      const legacy = { ...value, coverProductLayoutManual: true };
      value.coverElementPlacements = Object.fromEntries(
        value.products.map((product, index) => [
          `product-${product.code}`,
          coverProductPlacement(legacy, index, count),
        ]),
      );
      if (count === 2) {
        value.coverProductLayout = "hero";
        value.coverElementPlacements = {
          "product-offer-0": { x: 3, y: 58, width: 45, height: 34 },
          "product-offer-1": { x: 52, y: 58, width: 45, height: 34 },
        };
      }
      const original = structuredClone(value);
      const root = document.createElement("div");
      root.innerHTML = renderToStaticMarkup(<CoverPage campaign={value} />);
      const [top, ...bottom] = [
        ...root.querySelectorAll<HTMLElement>(".cover-product-frame"),
      ];
      expect(top!.style.top).toBe("28%");
      expect(top!.style.width).toBe("90%");
      expect(bottom).toHaveLength(count - 1);
      expect(new Set(bottom.map((frame) => frame.style.top)).size).toBe(1);
      for (const frame of bottom)
        expect(parseFloat(frame.style.top)).toBeGreaterThan(
          parseFloat(top!.style.top) + parseFloat(top!.style.height),
        );
      if (count === 2) {
        expect(bottom[0]!.style.width).toBe("90%");
        expect(
          root.querySelectorAll(".cover-product-wide-default"),
        ).toHaveLength(2);
      }
      expect(value).toEqual(original);
    }
  },
);

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
    expect(cards[0]!.style.width).toBe("90%");
    expect(cards[1]!.style.width).toBe("90%");
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
