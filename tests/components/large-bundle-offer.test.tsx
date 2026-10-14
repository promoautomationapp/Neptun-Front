import React, { createRef } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Product } from "../../src/domain/models";
import { LargeBundleOffer } from "../../src/features/brochure/LargeBundleOffer";

afterEach(cleanup);

const members: Product[] = [
  {
    code: "oven",
    name: "FURRË BBSE17320BD",
    specs: { Kapaciteti: "72 L / GRILL, VENTILATOR" },
    warranty: "5 VITE GARANCION",
  },
  {
    code: "hob",
    name: "PLLAKË BBSE17320BD",
    specs: { Sipërfaqe: "4+1 SIPËRFAQE TË NGROHJES" },
    warranty: "5 VITE GARANCION",
  },
  {
    code: "dishwasher",
    name: "ENËLARËSE BDIN18441",
    specs: { Programe: "14 SETE / 8 PROGRAME / FAST+" },
    warranty: "5 VITE GARANCION",
  },
];
const product: Product = {
  code: "set",
  name: "SET BEKO",
  brand: "BEKO",
  regular: 1008,
  sale: 629,
  bundleProducts: members,
};

it("renders one panel and shared price with each member's own name, details and warranty beneath the photo guide", () => {
  const photoAreaRef = createRef<HTMLDivElement>();
  const view = render(
    <LargeBundleOffer
      product={product}
      pageColor="#245b89"
      photoAreaRef={photoAreaRef}
      artwork={<div data-testid="artwork-layer" />}
      brand={<strong className="brochure-brand-mark">beko</strong>}
      savings={<span className="brochure-saving">KURSENI 379€</span>}
      price={<div className="brochure-price">1008€ 629€ 12×52.4€</div>}
      renderMember={(member) => (
        <>
          <strong className="large-bundle-member-name">{member.name}</strong>
          <div className="large-bundle-member-details">
            {Object.values(member.specs || {}).map((value) => (
              <span key={value} className="large-bundle-member-line">
                {value}
              </span>
            ))}
          </div>
          <small className="large-bundle-member-warranty">
            {member.warranty}
          </small>
        </>
      )}
    />,
  );
  expect(view.container.querySelectorAll(".large-bundle-offer")).toHaveLength(
    1,
  );
  expect(view.container.querySelectorAll(".brochure-price")).toHaveLength(1);
  expect(
    view.container.querySelectorAll(".large-bundle-member-copy"),
  ).toHaveLength(3);
  expect(view.container.querySelectorAll(".large-bundle-plus")).toHaveLength(2);
  expect(
    view.container.querySelectorAll(".large-bundle-member-warranty"),
  ).toHaveLength(3);
  expect(photoAreaRef.current?.style.width).toBe("100%");
  expect(photoAreaRef.current?.style.height).toBe("68%");
  expect(
    view.container
      .querySelector<HTMLElement>(".large-bundle-offer")
      ?.style.getPropertyValue("--large-bundle-panel-color"),
  ).toBe("#205079");
  for (const member of members) {
    const copy = view.container.querySelector(
      `[data-bundle-member-code="${member.code}"]`,
    );
    expect(copy?.textContent).toContain(member.name);
    expect(copy?.textContent).toContain(member.warranty);
    for (const value of Object.values(member.specs || {}))
      expect(copy?.textContent).toContain(value);
  }
});

it("preserves the supplied edit callbacks and model values and excludes exactly two-member bundles", () => {
  const edit = vi.fn();
  const before = structuredClone(product);
  const props = {
    product,
    artwork: <button onClick={edit}>Replace member image</button>,
    price: <button onClick={edit}>Edit shared price</button>,
    brand: <button onClick={edit}>Move brand</button>,
    savings: <button onClick={edit}>Move savings</button>,
    renderMember: (member: Product) => (
      <button onClick={edit}>Edit {member.code}</button>
    ),
  };
  const view = render(<LargeBundleOffer {...props} />);
  for (const button of view.container.querySelectorAll("button"))
    fireEvent.click(button);
  expect(edit).toHaveBeenCalledTimes(7);
  expect(product).toEqual(before);
  view.rerender(
    <LargeBundleOffer
      {...props}
      product={{ ...product, bundleProducts: members.slice(0, 2) }}
    />,
  );
  expect(view.container.innerHTML).toBe("");
});
