import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import {
  BundleBrandArtwork,
  bundleBrandArtworks,
} from "../../src/features/brochure/BundleBrandArtwork";
import { BUILTIN_BRAND_LOGOS } from "../../src/features/brochure/brandLogos";
import { RedReferenceSavings } from "../../src/features/brochure/RedReferencePrice";
import { redTextWidth } from "../../src/features/brochure/redPriceModel";
import geometry from "../../src/features/brochure/redPriceGeometry.json";

afterEach(cleanup);
const product: Product = {
  code: "mixed",
  name: "TV and phones",
  brand: "BEKO / Samsung",
  regular: 2195,
  sale: 299,
  bundleProducts: [
    { code: "tv", name: "TV", brand: "BEKO" },
    ...["black", "grey", "violet", "white"].map((code) => ({
      code,
      name: `Phone ${code}`,
      brand: "Samsung",
    })),
  ],
};
const campaign: Campaign = {
  id: "mixed-brands",
  name: "Mixed",
  products: [product],
};

it("renders the distinct member logos rather than a joined brand-name fallback", () => {
  const view = render(
    <BundleBrandArtwork campaign={campaign} product={product} />,
  );
  expect(view.getAllByRole("img")).toHaveLength(2);
  expect(view.getByRole("img", { name: "BEKO" }).getAttribute("src")).toBe(
    BUILTIN_BRAND_LOGOS.BEKO,
  );
  expect(view.getByRole("img", { name: "Samsung" }).getAttribute("src")).toBe(
    BUILTIN_BRAND_LOGOS.SAMSUNG,
  );
  expect(view.container.textContent).toBe("");
  expect(
    bundleBrandArtworks(campaign, { ...product, brand: "BEKO" }),
  ).toHaveLength(2);
});

it("keeps a chosen composite logo and resolves each member's custom logo", () => {
  expect(
    bundleBrandArtworks(campaign, {
      ...product,
      brandLogo: "/chosen-composite.png",
    }),
  ).toEqual([{ name: product.brand, source: "/chosen-composite.png" }]);
  const custom = {
    ...campaign,
    brandLogos: { SAMSUNG: "/custom-samsung.png" },
  };
  expect(bundleBrandArtworks(custom, product)[1]?.source).toBe(
    "/custom-samsung.png",
  );
  expect(
    bundleBrandArtworks(
      {
        ...campaign,
        brandLogos: { "BEKO / SAMSUNG": "/campaign-composite.png" },
      },
      product,
    ),
  ).toEqual([{ name: product.brand, source: "/campaign-composite.png" }]);
});

it.each([1896, 1896.99, 12896])(
  "insets a %s euro saving and leaves a readable currency gap",
  (amount) => {
    const view = render(
      <RedReferenceSavings product={{ ...product, regular: amount + 299 }} />,
    );
    const text = view.container.querySelector<SVGTextElement>(
      "[data-saving-amount]",
    )!;
    const size = Number(text.getAttribute("font-size"));
    expect(text.textContent).toMatch(/ \u20ac$/);
    expect(
      redTextWidth(text.textContent || "", size, "bold", -0.06),
    ).toBeLessThanOrEqual(geometry.parts.savingCircle.width * 0.76 + 0.01);
    expect(view.getByRole("img").getAttribute("aria-label")).toContain(
      String(amount),
    );
  },
);

it("keeps the short savings and percentage reference artwork", () => {
  const view = render(
    <RedReferenceSavings product={{ ...product, regular: 399 }} />,
  );
  expect(
    view.container.querySelector("[data-saving-amount]")?.textContent,
  ).toBe("100€");
  view.rerender(
    <RedReferenceSavings product={product} savingMode="percentage" />,
  );
  expect(
    view.container.querySelector("[data-saving-amount]")?.textContent,
  ).toBe("86%");
});

it("reduces the visible circle and both text lines by ten percent while retaining saved placement", () => {
  const style = {
    width: "18cqw",
    left: "42%",
    top: "33%",
    transform: "translate(-2cqw, 3cqw) scale(1.4)",
  };
  const view = render(<RedReferenceSavings product={product} style={style} />);
  const badge = view.getByRole("img");
  const svg = badge.querySelector("svg")!;
  const [left, top, width, height] = svg
    .getAttribute("viewBox")!
    .split(" ")
    .map(Number);
  const circle = geometry.parts.savingCircle;
  expect((circle.width + 1.4) / width!).toBeCloseTo(0.9);
  expect((circle.height + 1.4) / height!).toBeCloseTo(0.9);
  expect(left! + width! / 2).toBeCloseTo(circle.x + circle.width / 2);
  expect(top! + height! / 2).toBeCloseTo(circle.y + circle.height / 2);
  expect(badge.style.width).toBe(style.width);
  expect(badge.style.left).toBe(style.left);
  expect(badge.style.top).toBe(style.top);
  expect(badge.style.transform).toBe(style.transform);
  expect(svg.querySelectorAll("text")).toHaveLength(2);
  expect(badge.getAttribute("aria-label")).toBe("KURSENI 1896€");
});
