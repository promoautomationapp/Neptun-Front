import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Product } from "../../src/domain/models";
import { SocialProductDetails } from "../../src/features/social/SocialProductDetails";

const product: Product = {
  code: "social-details",
  name: "Example product",
  brochureDetails: [
    { key: "capacity", text: "8 KG" },
    { key: "motor", text: "Inverter" },
  ],
  warranty: "5 vite",
};

beforeEach(() => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal("ResizeObserver", undefined);
  Object.defineProperty(Element.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return DOMRect.fromRect(
        this.classList.contains("social-canvas")
          ? { x: 0, y: 0, width: 1000, height: 1000 }
          : this.classList.contains("social-product")
            ? { x: 100, y: 100, width: 800, height: 800 }
            : this.classList.contains("social-detail-strip")
              ? { x: 150, y: 500, width: 600, height: 100 }
              : { x: 150, y: 500, width: 85, height: 85 },
      );
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function ControlledDetails({
  initial = product,
  change = vi.fn(),
  start,
  end,
}: {
  initial?: Product;
  change?: (changes: Partial<Product>) => void;
  start?: () => void;
  end?: () => void;
}) {
  const [current, setCurrent] = React.useState(initial);
  return (
    <div className="social-canvas">
      <article className="social-product">
        <SocialProductDetails
          product={current}
          reference="red"
          onChange={(changes) => {
            change(changes);
            setCurrent((previous) => ({ ...previous, ...changes }));
          }}
          onGestureStart={start}
          onGestureEnd={end}
        />
      </article>
    </div>
  );
}

it("saves inline text without losing stable row keys, placements or fill choices", () => {
  const change = vi.fn();
  const view = render(
    <ControlledDetails
      initial={{
        ...product,
        detailBlockPlacements: {
          capacity: { x: 2, y: 1 },
          motor: { width: 20 },
        },
        detailBlockStyles: { capacity: "outline", motor: "filled" },
      }}
      change={change}
    />,
  );
  fireEvent.click(
    view.container.querySelector(
      '[data-detail-key="capacity"] .detail-block-edit',
    )!,
  );
  const input = view.getByRole("textbox");
  expect((input as HTMLInputElement).value).toBe("8 KG");
  fireEvent.change(input, { target: { value: "9 KG" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(change).toHaveBeenLastCalledWith({
    brochureDetails: [
      { key: "capacity", text: "9 KG" },
      { key: "motor", text: "Inverter" },
    ],
    detailBlockPlacements: { capacity: { x: 2, y: 1 }, motor: { width: 20 } },
    detailBlockStyles: { capacity: "outline", motor: "filled" },
  });
  expect(
    view.container.querySelector('[data-detail-key="capacity"] b')?.textContent,
  ).toBe("9 KG");
  expect(view.queryByRole("textbox")).toBeNull();
});

it("toggles the brochure default fill on double click and persists the explicit choice", () => {
  const change = vi.fn();
  const view = render(<ControlledDetails change={change} />);
  const tile = view.container.querySelector('[data-detail-key="capacity"]')!;
  expect(tile.classList.contains("detail-filled")).toBe(true);
  fireEvent.doubleClick(tile);
  expect(change).toHaveBeenLastCalledWith({
    detailBlockStyles: { capacity: "outline" },
  });
  expect(tile.classList.contains("detail-filled")).toBe(false);
  fireEvent.doubleClick(tile);
  expect(change).toHaveBeenLastCalledWith({
    detailBlockStyles: { capacity: "filled" },
  });
  expect(tile.classList.contains("detail-style-filled")).toBe(true);
});

it("commits a tile drag only on release and keeps the saved placement through resizing", () => {
  const change = vi.fn();
  const start = vi.fn();
  const end = vi.fn();
  const view = render(
    <ControlledDetails change={change} start={start} end={end} />,
  );
  const tile = view.container.querySelector('[data-detail-key="capacity"]')!;
  fireEvent.pointerDown(tile, { clientX: 150, clientY: 500, button: 0 });
  fireEvent.pointerMove(tile, { clientX: 250, clientY: 510 });
  expect(change).not.toHaveBeenCalled();
  fireEvent.pointerUp(tile, { clientX: 250, clientY: 510 });
  expect(change).toHaveBeenLastCalledWith({
    detailBlockPlacements: { capacity: { x: 10, y: 1 } },
  });
  expect((tile as HTMLElement).style.transform).toBe("translate(10cqw, 1cqw)");
  expect(start).toHaveBeenCalledTimes(1);
  expect(end).toHaveBeenCalledTimes(1);
  const resize = tile.querySelector(".detail-block-resize")!;
  fireEvent.pointerDown(resize, { clientX: 235, clientY: 585, button: 0 });
  fireEvent.pointerMove(resize, { clientX: 265, clientY: 605 });
  expect(change).toHaveBeenCalledTimes(1);
  fireEvent.pointerUp(resize, { clientX: 265, clientY: 605 });
  const placement = change.mock.lastCall?.[0].detailBlockPlacements.capacity;
  expect(placement.x).toBe(10);
  expect(placement.y).toBe(1);
  expect(placement.width).toBeCloseTo(19.16667);
  expect(placement.height).toBeCloseTo(10.5);
  expect(start).toHaveBeenCalledTimes(2);
  expect(end).toHaveBeenCalledTimes(2);
  fireEvent.pointerMove(resize, { clientX: 300, clientY: 650 });
  expect(change).toHaveBeenCalledTimes(2);
});

it("reorders rows through the drag handle while the saved edits follow each stable key", () => {
  const change = vi.fn();
  const view = render(
    <ControlledDetails
      initial={{
        ...product,
        detailBlockPlacements: { capacity: { x: 2 }, motor: { y: 1 } },
        detailBlockStyles: { capacity: "outline", motor: "filled" },
      }}
      change={change}
    />,
  );
  const transfer = new Map<string, string>();
  const dataTransfer = {
    setData: (type: string, value: string) => transfer.set(type, value),
    getData: (type: string) => transfer.get(type) || "",
    types: ["application/x-social-detail"],
  };
  fireEvent.dragStart(
    view.container.querySelector(
      '[data-detail-key="capacity"] .detail-block-reorder',
    )!,
    { dataTransfer },
  );
  fireEvent.drop(view.container.querySelector('[data-detail-key="motor"]')!, {
    dataTransfer,
  });
  expect(change).toHaveBeenLastCalledWith({
    brochureDetails: [
      { key: "motor", text: "Inverter" },
      { key: "capacity", text: "8 KG" },
    ],
    detailBlockPlacements: { motor: { y: 1 }, capacity: { x: 2 } },
    detailBlockStyles: { motor: "filled", capacity: "outline" },
  });
  expect(
    [
      ...view.container.querySelectorAll(
        ".social-detail-strip > .product-detail-block",
      ),
    ].map((tile) => tile.getAttribute("data-detail-key")),
  ).toEqual(["motor", "capacity", "__warranty"]);
});

it("uses complete source indexes for a reorder callback even when brochure priorities change display order", () => {
  const reorder = vi.fn();
  const view = render(
    <SocialProductDetails
      product={{
        code: "dishwasher",
        name: "Dishwasher",
        specs: {
          Noise: "70 dB",
          Capacity: "14 sets",
          Programs: "15",
          Motor: "Inverter",
        },
      }}
      reference="red"
      onReorder={reorder}
    />,
  );
  const first = view.container.querySelector(
    ".social-detail-strip > .product-detail-block",
  )!;
  expect(first.getAttribute("data-detail-key")).toBe("Capacity");
  const foreignTransfer = {
    getData: () => "other-product:0",
    types: ["application/x-social-detail"],
  };
  fireEvent.drop(first, { dataTransfer: foreignTransfer });
  expect(reorder).not.toHaveBeenCalled();
  const dataTransfer = {
    getData: () => "dishwasher:0",
    types: ["application/x-social-detail"],
  };
  fireEvent.drop(first, { dataTransfer });
  expect(reorder).toHaveBeenCalledWith(0, 1);
});

it("keeps the red warranty as a removable square and leaves the blue warranty to the product copy", () => {
  const change = vi.fn();
  const view = render(
    <SocialProductDetails
      product={product}
      reference="red"
      onChange={change}
    />,
  );
  expect(
    view.container.querySelector(".social-warranty-box .detail-warranty-count")
      ?.textContent,
  ).toBe("5");
  expect(
    view.container.querySelector(".social-warranty-label")?.textContent,
  ).toBe("GARANCION");
  fireEvent.click(
    view.container.querySelector(
      '[data-detail-key="__warranty"] .detail-block-remove',
    )!,
  );
  expect(change).toHaveBeenLastCalledWith({ hideWarranty: true });
  view.rerender(<SocialProductDetails product={product} reference="blue" />);
  expect(
    view.container.querySelector('[data-detail-key="__warranty"]'),
  ).toBeNull();
  expect(view.queryAllByRole("button")).toHaveLength(0);
  view.rerender(
    <SocialProductDetails
      product={{ ...product, hideWarranty: true }}
      reference="red"
    />,
  );
  expect(
    view.container.querySelector('[data-detail-key="__warranty"]'),
  ).toBeNull();
});
