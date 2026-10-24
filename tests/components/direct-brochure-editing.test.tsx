import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  InlinePriceEditor,
  useProductQuickEdit,
} from "../../src/features/brochure/InlinePriceEditor";
import { ProductDetailBlock } from "../../src/features/brochure/ProductDetailBlock";
import { CoverPage } from "../../src/features/brochure/Brochure";
import {
  resizeFromCorner,
  RESIZE_CORNERS,
} from "../../src/features/brochure/resizeCorners";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { Campaign, Product } from "../../src/domain/models";
const product: Product = {
  code: "TV",
  name: "TV",
  regular: 600,
  sale: 400,
  savingMode: "amount",
};
beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("edits prices in place with an automatic percentage and preserves the original until saved", () => {
  const save = vi.fn();
  const view = render(
    <InlinePriceEditor product={product} onSave={save} onClose={vi.fn()} />,
  );
  fireEvent.change(
    view.getByRole("spinbutton", { name: "New offer price (€)" }),
    { target: { value: "450" } },
  );
  expect(view.getByRole("status").textContent).toContain("25%");
  expect(product.sale).toBe(400);
  expect(save).not.toHaveBeenCalled();
  fireEvent.submit(view.getByRole("dialog", { name: "Edit price here" }));
  expect(save).toHaveBeenCalledWith({
    regular: 600,
    sale: 450,
    confirmedAboveRegular: false,
  });
});

it("double-clicks an image to replace it and a savings badge to switch units without opening a modal", () => {
  vi.useFakeTimers();
  const change = vi.fn(),
    image = vi.fn();
  function Card() {
    const edit = useProductQuickEdit({
      product,
      campaign: { id: "test", name: "Offers", products: [product] },
      onChange: change,
      onEditImage: image,
    });
    return (
      <article {...edit.events}>
        <span className="red-reference-saving">Kurseni 200€</span>
        <img className="brochure-product-image" alt="TV" />
        {edit.editor}
      </article>
    );
  }
  const view = render(<Card />);
  const badge = view.getByText("Kurseni 200€");
  fireEvent.click(badge, { detail: 1 });
  fireEvent.click(badge, { detail: 2 });
  fireEvent.doubleClick(badge);
  act(() => vi.advanceTimersByTime(500));
  expect(change).toHaveBeenCalledWith({ savingMode: "percentage" });
  expect(view.queryByRole("dialog")).toBeNull();
  fireEvent.doubleClick(view.getByAltText("TV"));
  expect(image).toHaveBeenCalledWith(product);
});

it("clicks a detail to edit inline, and double-clicks to open that detail's editor", () => {
  vi.useFakeTimers();
  const save = vi.fn(),
    edit = vi.fn();
  const view = render(
    <ProductDetailBlock
      product={product}
      detailKey="Memory"
      editText="8 GB"
      onSaveText={save}
      onEdit={edit}
    >
      8 GB
    </ProductDetailBlock>,
  );
  fireEvent.click(view.getByText("8 GB"));
  act(() => vi.advanceTimersByTime(250));
  fireEvent.change(view.getByRole("textbox", { name: "Edit this detail" }), {
    target: { value: "16 GB" },
  });
  fireEvent.keyDown(view.getByRole("textbox"), { key: "Enter" });
  expect(save).toHaveBeenCalledWith("16 GB");
  fireEvent.doubleClick(view.getByText("8 GB"));
  expect(edit).toHaveBeenCalledWith("Memory");
});

it("edits cover text directly and makes preview text read-only", () => {
  const campaign: Campaign = {
    id: "cover",
    name: "Offers",
    type: "Campaign",
    products: [],
    showCoverHeadline: true,
    showCoverMessage: true,
    tagline: "Save this week",
  };
  const change = vi.fn();
  const view = render(
    <CoverPage campaign={campaign} onCoverTextChange={change} />,
  );
  const title = view.getByRole("textbox", { name: "Cover headline" });
  title.textContent = "New offers";
  fireEvent.blur(title);
  expect(change).toHaveBeenCalledWith("coverHeadline", "New offers");
  view.rerender(<CoverPage campaign={campaign} />);
  expect(view.queryByRole("textbox")).toBeNull();
});

for (const corner of RESIZE_CORNERS)
  it(`resizes from ${corner} with the opposite corner anchored`, () => {
    const frame = { x: 20, y: 30, width: 100, height: 60 };
    const left = corner.endsWith("left"),
      top = corner.startsWith("top");
    const next = resizeFromCorner(
      frame,
      left ? -20 : 20,
      top ? -12 : 12,
      corner,
      { lockAspect: true },
    );
    expect(next.width / next.height).toBeCloseTo(frame.width / frame.height);
    expect(left ? next.x + next.width : next.x).toBeCloseTo(left ? 120 : 20);
    expect(top ? next.y + next.height : next.y).toBeCloseTo(top ? 90 : 30);
    expect(next.width).toBeGreaterThan(frame.width);
  });
