import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProductDetailBlock } from "../../src/features/brochure/ProductDetailBlock";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { Product } from "../../src/domain/models";

const product: Product = {
  code: "phone",
  name: "Phone",
};
beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal("PointerEvent", MouseEvent);
  Object.defineProperty(Element.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return DOMRect.fromRect(
        this.classList.contains("product-detail-block")
          ? { x: 100, y: 100, width: 200, height: 50 }
          : { width: 1000, height: 600 },
      );
    },
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Canvas({ children }: React.PropsWithChildren) {
  return (
    <div className="cs-page-preview edit-view show-guides">
      <section className="brochure-page">
        <article className="brochure-product">
          <div>{children}</div>
        </article>
      </section>
    </div>
  );
}
function select(element: HTMLElement) {
  fireEvent.pointerDown(element, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(element, { clientX: 100, clientY: 100 });
}

it("shows one selected detail's toolbar and four corners, even when page guides are on", () => {
  const change = vi.fn();
  const view = render(
    <Canvas>
      <ProductDetailBlock
        product={product}
        detailKey="memory"
        onChange={change}
      >
        128 GB
      </ProductDetailBlock>
      <ProductDetailBlock
        product={product}
        detailKey="battery"
        onChange={change}
      >
        5000 mAh
      </ProductDetailBlock>
    </Canvas>,
  );
  expect(screen.queryByRole("toolbar")).toBeNull();
  expect(view.container.querySelectorAll(".resize-corner")).toHaveLength(0);
  select(screen.getByText("128 GB"));
  expect(screen.getAllByRole("toolbar")).toHaveLength(1);
  expect(screen.getByRole("toolbar").getAttribute("aria-label")).toContain(
    "memory",
  );
  expect(view.container.querySelectorAll(".resize-corner")).toHaveLength(4);
  expect(
    view.container.querySelector('[data-detail-key="battery"] .resize-corner'),
  ).toBeNull();
  select(screen.getByText("5000 mAh"));
  expect(screen.getAllByRole("toolbar")).toHaveLength(1);
  expect(screen.getByRole("toolbar").getAttribute("aria-label")).toContain(
    "battery",
  );
  expect(
    view.container.querySelector('[data-detail-key="memory"] .resize-corner'),
  ).toBeNull();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("toolbar")).toBeNull();
  expect(view.container.querySelectorAll(".resize-corner")).toHaveLength(0);
  expect(change).not.toHaveBeenCalled();
});

it("removes exactly the selected detail without starting a move or the card's editor", () => {
  const change = vi.fn(),
    remove = vi.fn(),
    parentClick = vi.fn(),
    parentPointer = vi.fn();
  const view = render(
    <Canvas>
      <div onClick={parentClick} onPointerDown={parentPointer}>
        <ProductDetailBlock
          product={product}
          detailKey="memory"
          onChange={change}
          onRemove={remove}
        >
          128 GB
        </ProductDetailBlock>
        <ProductDetailBlock
          product={product}
          detailKey="battery"
          onChange={change}
          onRemove={remove}
        >
          5000 mAh
        </ProductDetailBlock>
      </div>
    </Canvas>,
  );
  select(screen.getByText("5000 mAh"));
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  const removeButton = screen.getByRole("button", {
    name: "Remove detail block: battery",
  });
  fireEvent.pointerDown(removeButton, { button: 0 });
  fireEvent.pointerUp(removeButton);
  fireEvent.click(removeButton);
  expect(remove).toHaveBeenCalledExactlyOnceWith("battery");
  expect(change).not.toHaveBeenCalled();
  expect(parentClick).not.toHaveBeenCalled();
  expect(parentPointer).not.toHaveBeenCalled();
  expect(view.container.querySelector(".moving, .dragging-guides")).toBeNull();
});

it("supports focus, inline text editing, and double-clicking the focused product detail", () => {
  vi.useFakeTimers();
  const save = vi.fn(),
    edit = vi.fn(),
    change = vi.fn();
  render(
    <Canvas>
      <ProductDetailBlock
        product={product}
        detailKey="memory"
        editText="128 GB"
        onChange={change}
        onSaveText={save}
        onEdit={edit}
      >
        128 GB
      </ProductDetailBlock>
    </Canvas>,
  );
  const block = screen.getByRole("group", { name: "Detail block: memory" });
  act(() => block.focus());
  expect(screen.getByRole("toolbar")).toBeTruthy();
  fireEvent.keyDown(block, { key: "Enter" });
  const input = screen.getByRole("textbox", { name: "Edit this detail" });
  expect(document.activeElement).toBe(input);
  expect(screen.getByRole("toolbar")).toBeTruthy();
  fireEvent.change(input, { target: { value: "256 GB" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(save).toHaveBeenCalledExactlyOnceWith("256 GB");
  fireEvent.click(screen.getByText("128 GB"));
  fireEvent.doubleClick(screen.getByText("128 GB"));
  act(() => vi.advanceTimersByTime(250));
  expect(edit).toHaveBeenCalledExactlyOnceWith("memory");
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(change).not.toHaveBeenCalled();
});

it("moves using the contextual toolbar and keeps resizing bounded at every corner", () => {
  const change = vi.fn();
  const view = render(
    <Canvas>
      <ProductDetailBlock
        product={product}
        detailKey="memory"
        onChange={change}
      >
        128 GB
      </ProductDetailBlock>
    </Canvas>,
  );
  select(screen.getByText("128 GB"));
  const move = screen.getByRole("button", {
    name: "Move Detail block: memory",
  });
  fireEvent.pointerDown(move, { button: 0, clientX: 100, clientY: 100 });
  fireEvent.pointerMove(move, { clientX: 80, clientY: 90 });
  expect(change).not.toHaveBeenCalled();
  fireEvent.pointerUp(move, { clientX: 80, clientY: 90 });
  expect(change).toHaveBeenLastCalledWith("detailBlockPlacements", {
    memory: { x: -2, y: -1 },
  });
  for (const corner of [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ]) {
    const resize = view.container.querySelector<HTMLButtonElement>(
      `[data-resize-corner="${corner}"]`,
    )!;
    fireEvent.pointerDown(resize, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(resize, { clientX: 10000, clientY: -10000 });
    fireEvent.pointerUp(resize);
    const value = change.mock.calls.at(-1)![1].memory;
    expect(Number.isFinite(value.x) && Number.isFinite(value.y)).toBe(true);
    expect(value.width).toBeGreaterThanOrEqual(5);
    expect(value.width).toBeLessThanOrEqual(150);
    expect(value.height).toBeGreaterThanOrEqual(0.5);
    expect(value.height).toBeLessThanOrEqual(100);
  }
  expect(view.container.querySelector(".dragging-guides")).toBeNull();
});

it("keeps background and reorder actions available behind More and returns keyboard focus", () => {
  const change = vi.fn(),
    reorder = vi.fn();
  render(
    <Canvas>
      <ProductDetailBlock
        product={product}
        detailKey="memory"
        onChange={change}
        draggable
        onDragStart={reorder}
      >
        128 GB
      </ProductDetailBlock>
    </Canvas>,
  );
  select(screen.getByText("128 GB"));
  const more = screen.getByRole("button", { name: "More actions" });
  expect(
    screen.queryByRole("button", { name: "Change block background" }),
  ).toBeNull();
  fireEvent.click(more);
  fireEvent.click(
    screen.getByRole("button", { name: "Change block background" }),
  );
  expect(change).toHaveBeenCalledExactlyOnceWith("detailBlockStyles", {
    memory: "filled",
  });
  fireEvent.click(more);
  const reorderButton = screen.getByRole("button", {
    name: "Reorder Detail block: memory",
  });
  fireEvent.dragStart(reorderButton);
  expect(reorder).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(reorderButton, { key: "Escape" });
  expect(more.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(more);
  expect(
    within(screen.getByRole("toolbar")).queryByText("Change block background"),
  ).toBeNull();
});

it("keeps More and Delete usable after single-click text editing starts", () => {
  vi.useFakeTimers();
  const remove = vi.fn(),
    save = vi.fn(),
    change = vi.fn();
  render(
    <Canvas>
      <ProductDetailBlock
        product={product}
        detailKey="memory"
        editText="128 GB"
        onSaveText={save}
        onRemove={remove}
        onChange={change}
      >
        128 GB
      </ProductDetailBlock>
    </Canvas>,
  );
  fireEvent.click(screen.getByText("128 GB"));
  act(() => vi.advanceTimersByTime(500));
  expect(
    screen.getByRole("textbox", { name: "Edit this detail" }),
  ).toBeTruthy();
  expect(screen.getByRole("toolbar")).toBeTruthy();
  const more = screen.getByRole("button", { name: "More actions" });
  fireEvent.pointerDown(more);
  fireEvent.click(more);
  const removeButton = screen.getByRole("button", {
    name: "Remove detail block: memory",
  });
  fireEvent.pointerDown(removeButton);
  fireEvent.click(removeButton);
  expect(remove).toHaveBeenCalledExactlyOnceWith("memory");
  expect(save).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
});
