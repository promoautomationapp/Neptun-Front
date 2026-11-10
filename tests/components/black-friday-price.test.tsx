import React from "react";
import { cleanup, render, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  BlackFridayPrice,
  BlackFridaySavings,
} from "../../src/features/brochure/BlackFridayPrice";
import { RedReferencePrice } from "../../src/features/brochure/RedReferencePrice";
import { savingsBadgeDefaults } from "../../src/features/brochure/savingsBadgeAppearance";

afterEach(cleanup);
const product = {
  code: "tv",
  name: "TV QNED 65QNED85A3C",
  regular: 1249,
  sale: 799,
};

it("uses the supplied Black Friday orange price with black old price and charcoal installments", () => {
  const view = render(<BlackFridayPrice product={product} />);
  const svg = view.container.querySelector(
    'svg[data-price-variant="black-friday"]',
  )!;
  expect(svg).toBeTruthy();
  expect(svg.querySelector('path[stroke="#000000"]')).toBeTruthy();
  expect(svg.querySelector('g[fill="#000000"]')).toBeTruthy();
  const gradients = svg.querySelectorAll("linearGradient");
  expect(gradients[1]!.firstElementChild?.getAttribute("stop-color")).toBe(
    "rgb(63.9066094763 63.9066094763 63.9066094763)",
  );
  expect(gradients[1]!.lastElementChild?.getAttribute("stop-color")).toBe(
    "#2c2c2c",
  );
  expect(gradients[1]!.children[1]?.getAttribute("offset")).toBe(
    "80.9090909091%",
  );
  expect(
    svg.querySelector(".red-price-label")?.getAttribute("font-weight"),
  ).toBe("400");
  expect(svg.getAttribute("aria-label")).toContain("799");
  expect(view.container.textContent).toContain("66.");
});

it("leaves the earlier orange artwork unchanged", () => {
  const view = render(<RedReferencePrice product={product} />);
  expect(
    view.container.querySelector('[data-price-variant="black-friday"]'),
  ).toBeNull();
  expect(view.container.querySelector('path[stroke="#1c4075"]')).toBeTruthy();
  expect(
    view.container
      .querySelectorAll("linearGradient")[1]!
      .firstElementChild?.getAttribute("stop-color"),
  ).toBe("#01a2dd");
});

it("preserves the exact displayed source installment while the source offer price applies", () => {
  const source = {
    ...product,
    sale: 34.99,
    brochureInstallment: { amount: 2.5, count: 12, sale: 34.99 },
  };
  const view = render(<BlackFridayPrice product={source} />);
  expect(view.getByRole("img").getAttribute("aria-label")).toContain(
    "12x2.5 €",
  );
  view.rerender(<BlackFridayPrice product={{ ...source, sale: 69.99 }} />);
  expect(view.getByRole("img").getAttribute("aria-label")).toContain(
    "12x5.8 €",
  );
});

it("keeps black savings editable and honors custom colors and hidden state", () => {
  const edit = vi.fn();
  const view = render(
    <BlackFridaySavings product={product} onEditSavings={edit} />,
  );
  expect(view.container.querySelector('g[fill="#000000"]')).toBeTruthy();
  expect(view.container.querySelector("svg>path")?.getAttribute("fill")).toBe(
    "#fff",
  );
  expect(
    view.container.querySelector("g>text")?.getAttribute("font-weight"),
  ).toBe("400");
  fireEvent.click(view.getByRole("button"));
  expect(edit).toHaveBeenCalledWith(product);
  view.rerender(
    <BlackFridaySavings
      product={{
        ...product,
        savingsBadge: { backgroundColor: "#334455", textColor: "#ffcc00" },
      }}
    />,
  );
  expect(view.container.querySelector('g[fill="#ffcc00"]')).toBeTruthy();
  expect(view.container.querySelector("svg>path")?.getAttribute("fill")).toBe(
    "#334455",
  );
  view.rerender(
    <BlackFridaySavings
      product={{
        ...product,
        brochureContentPlacement: { saving: { hidden: true } },
      }}
    />,
  );
  expect(view.container.querySelector("svg")).toBeNull();
  expect(
    savingsBadgeDefaults(
      {
        id: "bf",
        name: "BF",
        brochurePresetId: "neptun-black-friday",
        products: [],
      },
      product,
    ).textColor,
  ).toBe("#000000");
});
