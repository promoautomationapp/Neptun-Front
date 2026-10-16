import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Product, SocialPost } from "../../src/domain/models";
import { setLanguage } from "../../src/features/brochure/i18n";
import { PostCanvas } from "../../src/features/social/SocialStudio";
import { createPost } from "../../src/features/social/postModel";

beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal("ResizeObserver", undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fixture(product: Partial<Product> = {}): SocialPost {
  return {
    ...createPost(),
    showEventLogo: false,
    showNeptunLogo: false,
    showInches: false,
    products: [
      {
        code: "84001234",
        name: "Beko appliance",
        brand: "BEKO",
        brandLogo: "/test-brand.svg",
        offerStyle: "current",
        regular: 499,
        sale: 399,
        brochureDetails: [
          { key: "capacity", text: "8 KG" },
          { key: "motor", text: "Inverter" },
        ],
        warranty: "5 vite",
        ...product,
      },
    ],
  };
}

it("renders the brochure name, code, native red price and connected name divider", () => {
  const view = render(<PostCanvas post={fixture()} />);
  const row = view.container.querySelector(".social-product-bottom");
  expect(row?.querySelector("[data-product-name]")?.textContent).toBe(
    "Beko appliance",
  );
  expect(row?.querySelector(".brochure-product-code")?.textContent).toBe(
    "84001234",
  );
  expect(row?.querySelectorAll(".red-reference-price-svg")).toHaveLength(1);
  expect(row?.querySelector("[data-offer-price-divider]")).not.toBeNull();
  expect(row?.querySelector(".brochure-product-name-divider")).not.toBeNull();
  expect(view.container.querySelector(".social-detail-strip")).not.toBeNull();
  expect(
    view.container.querySelectorAll(
      ".social-detail-strip > .product-detail-block",
    ),
  ).toHaveLength(3);
});

it("restores savings independently of price and exposes its own move and resize handles", () => {
  const placement = vi.fn();
  const post = fixture({
    offerPlacements: {
      price: { x: 2, y: 3, scale: 1.1 },
      savings: { x: -4, y: -8, scale: 1.3 },
    },
  });
  const view = render(<PostCanvas post={post} onMoveOfferBlock={placement} />);
  const price = view.container.querySelector<HTMLElement>(
    ".social-price-stack",
  );
  const savings = view.container.querySelector<HTMLElement>(
    ".social-savings-block",
  );
  expect(price?.style.transform).toBe("translate(2cqw, 3cqw) scale(1.1)");
  expect(savings?.style.transform).toBe("translate(-4cqw, -8cqw) scale(1.3)");
  expect(price?.contains(savings)).toBe(false);
  expect(savings?.parentElement).toBe(price?.parentElement);
  expect(savings?.querySelector(".red-reference-saving")).not.toBeNull();
  expect(view.getByRole("button", { name: "Move savings badge" })).toBeTruthy();
  expect(
    view.getByRole("button", { name: "Resize savings badge" }),
  ).toBeTruthy();
});

it("edits the shared brand artwork without sending its tool click to the product editor", () => {
  const change = vi.fn();
  const edit = vi.fn();
  const view = render(
    <PostCanvas
      post={fixture({ detailBlockPlacements: { __brand: { x: 1, y: 2 } } })}
      onMoveOfferBlock={vi.fn()}
      onChangeProduct={change}
      onEditDetails={edit}
    />,
  );
  const brand = view.container.querySelector<HTMLElement>(
    ".brochure-brand-artwork",
  );
  expect(brand?.style.transform).toBe("translate(1cqw, 2cqw)");
  expect(view.getByAltText("BEKO").getAttribute("src")).toBe("/test-brand.svg");
  expect(
    view.getByLabelText("Replace brand logo: Beko appliance"),
  ).toBeTruthy();
  fireEvent.click(
    view.getByRole("button", { name: "Remove detail block: __brand" }),
  );
  expect(change).toHaveBeenCalledWith("84001234", "hideBrandLogo", true);
  expect(edit).not.toHaveBeenCalled();
});

it("opens product editing on a double-click while keeping normal copy and tool clicks local", () => {
  const edit = vi.fn();
  const view = render(
    <PostCanvas
      post={fixture()}
      onMoveOfferBlock={vi.fn()}
      onChangeProduct={vi.fn()}
      onEditDetails={edit}
    />,
  );
  fireEvent.click(view.getByText("Beko appliance"));
  fireEvent.click(view.getByRole("button", { name: "Move product name" }));
  fireEvent.click(view.getByRole("button", { name: "Resize price" }));
  expect(edit).not.toHaveBeenCalled();
  fireEvent.doubleClick(view.getByText("Beko appliance"));
  expect(edit).toHaveBeenCalledExactlyOnceWith("84001234");
});

it("keeps the read-only canvas free of grid guides, detail toggles and editing tools", () => {
  const post = { ...fixture(), showGrid: true };
  const view = render(<PostCanvas post={post} />);
  const canvas = view.container.querySelector(".social-canvas");
  expect(canvas?.classList.contains("social-guides")).toBe(false);
  expect(
    view.container.querySelector(".product-detail-block.editable"),
  ).toBeNull();
  expect(
    view.container.querySelector(".product-detail-block-tools"),
  ).toBeNull();
  expect(view.container.querySelector(".social-offer-block-tools")).toBeNull();
  expect(view.queryAllByRole("button")).toHaveLength(0);
  expect(view.container.querySelector(".social-detail-strip")).not.toBeNull();
});

it.each(["showDetails", "showPrice"] as const)(
  "removes the measured divider when %s is disabled",
  (visibility) => {
    const view = render(
      <PostCanvas post={{ ...fixture(), [visibility]: false }} />,
    );
    expect(
      view.container.querySelector(".brochure-product-name-divider"),
    ).toBeNull();
  },
);
