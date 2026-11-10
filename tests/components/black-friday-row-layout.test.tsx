import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { CoverPage, ProductPage } from "../../src/features/brochure/Brochure";
import { splitPages } from "../../src/features/brochure/campaignPages";
import { BlackFridayPage } from "../../src/features/brochure/BlackFridayPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function campaign(count: number): Campaign {
  return {
    id: "bf-row-layout",
    name: "Black collection",
    brochureReferenceDesign: "black-collection",
    brochureFormat: "a3",
    layout: "grid6portrait",
    offerStyle: "current",
    products: Array.from({ length: count }, (_, index): Product => ({
      code: `offer-${index}`,
      name: "TELEVIZOR MODEL LONG NAME",
      brochurePage: 2,
      regular: 499,
      sale: 399,
      image: "/original.png",
      warranty: "2 vite",
      brochureDetails: [
        "4K UHD",
        "Crystal Processor 4K",
        "Smart TV",
        "WiFi",
        "HDR10+",
      ],
    })),
  };
}
it.each([2, 4, 5])(
  "uses automatic square strips and measured price dividers for all %i offers",
  (count) => {
    const value = campaign(count);
    value.products[0]!.brochureImagePlacement = { x: 50, y: 50, scale: 1 };
    const view = render(
      <ProductPage campaign={value} page={splitPages(value)[0]!} />,
    );
    expect(view.container.querySelectorAll(".bf-default-details")).toHaveLength(
      count,
    );
    expect(
      view.container.querySelectorAll(".brochure-product-name-divider"),
    ).toHaveLength(count);
    expect(view.container.querySelectorAll(".bf-singleton-row")).toHaveLength(
      count === 2 ? 2 : count === 5 ? 1 : 0,
    );
    expect(
      view.container.querySelectorAll(".bf-larger-default-photo"),
    ).toHaveLength(count === 2 ? 2 : 0);
    if (count === 2) {
      for (const frame of view.container.querySelectorAll<HTMLElement>(
        ".bf-product-frame",
      )) {
        expect(frame.style.width).toBe("92%");
        expect(frame.style.getPropertyValue("--bf-photo-width")).toBe("96%");
        expect(frame.style.getPropertyValue("--bf-photo-height")).toBe("78%");
      }
    }
  },
);
it("preserves saved image and detail block sizing instead of applying automatic row defaults", () => {
  const value = campaign(2);
  value.products[0]!.brochureImagePlacement = { x: 35, y: 45, scale: 0.8 };
  value.products[0]!.detailBlockPlacements = {
    "0": { x: 1, y: 2, width: 18, height: 6 },
  };
  value.products[1]!.brochureContentPlacement = {
    specs: { x: 2, y: 3, width: 75 },
  };
  const before = structuredClone(value);
  const view = render(
    <ProductPage campaign={value} page={splitPages(value)[0]!} />,
  );
  expect(view.container.querySelectorAll(".bf-default-details")).toHaveLength(
    0,
  );
  expect(
    view.container.querySelectorAll(".bf-larger-default-photo"),
  ).toHaveLength(1);
  const image = view.container.querySelector<HTMLImageElement>(
    ".brochure-product-image",
  )!;
  expect(image.style.left).toBe("35%");
  expect(image.style.transform).toBe("translate(-50%, -50%) scale(0.8)");
  const detail = view.container.querySelector<HTMLElement>(
    '[data-detail-key="0"]',
  )!;
  expect([detail.style.width, detail.style.height]).toEqual(["18%", "6cqw"]);
  expect(value).toEqual(before);
});
it.each(["black-friday", "black-collection"] as const)(
  "leaves the upper cover free and puts %s offers in one bottom row",
  (design) => {
    const value = campaign(2);
    value.brochureReferenceDesign = design;
    value.products.forEach((product) => {
      product.brochurePage = 1;
    });
    const view = render(<CoverPage campaign={value} />);
    expect(view.container.querySelectorAll(".bf-singleton-row")).toHaveLength(
      0,
    );
    expect(view.container.querySelectorAll(".bf-default-details")).toHaveLength(
      2,
    );
    const frames = [
      ...view.container.querySelectorAll<HTMLElement>(".bf-product-frame"),
    ];
    expect(frames.map((frame) => frame.style.top)).toEqual(["48.5%", "48.5%"]);
    expect(frames.map((frame) => frame.style.width)).toEqual(["47%", "47%"]);
    expect(
      view.container.querySelectorAll(".brochure-product-name-divider"),
    ).toHaveLength(2);
  },
);
it("uses saved frame geometry to avoid treating two side-by-side offers as singleton rows", () => {
  const value = campaign(2);
  value.products.forEach((product, index) => {
    product.brochureContentPlacement = {
      frame: { x: 3 + index * 49, y: 15, width: 45, height: 40 },
    };
  });
  const view = render(
    <BlackFridayPage campaign={value} products={value.products} />,
  );
  expect(view.container.querySelectorAll(".bf-singleton-row")).toHaveLength(0);
  expect(
    view.container.querySelectorAll(".bf-larger-default-photo"),
  ).toHaveLength(0);
});
