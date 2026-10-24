import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { PageArtwork } from "../../src/features/brochure/PageArtwork";
import { CoverElement } from "../../src/features/brochure/CoverElement";
import { StoresElement } from "../../src/features/brochure/StoresElement";
import { ProductArtworkLayer } from "../../src/features/brochure/ProductArtworkLayer";
import { ProductDetailBlock } from "../../src/features/brochure/ProductDetailBlock";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1080,
      bottom: 1350,
      width: 1080,
      height: 1350,
      toJSON: () => ({}),
    }),
  );
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => undefined,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const position = { x: 10, y: 20, width: 30, height: 15 };
function fixture(type: "page" | "cover" | "stores") {
  const change = vi.fn();
  const child =
    type === "page" ? (
      <PageArtwork
        campaign={{
          pageArtworks: {
            cover: [
              { id: "image", type: "image", image: "/photo.png", ...position },
            ],
          },
        }}
        pageKey="cover"
        onChange={change}
        onRemove={vi.fn()}
      />
    ) : type === "cover" ? (
      <CoverElement
        campaign={{ coverElementPlacements: { logo: position } }}
        kind="logo"
        defaultPlacement={position}
        onChange={change}
        onHide={vi.fn()}
        style={undefined}
      >
        Logo
      </CoverElement>
    ) : (
      <StoresElement
        campaign={{}}
        kind="brand"
        scope="footer"
        defaultPlacement={position}
        onChange={change}
        onHide={vi.fn()}
      >
        Brand
      </StoresElement>
    );
  const view = render(<div className="brochure-page">{child}</div>);
  const target = view.container.querySelector<HTMLElement>(
    type === "page"
      ? ".brochure-floating-artwork"
      : type === "cover"
        ? ".cover-editable-element"
        : ".stores-editable-element",
  )!;
  return { ...view, target, change };
}

for (const cancellation of ["pointerCancel", "lostPointerCapture"] as const) {
  it(`restores an additional product image on ${cancellation} without saving a partial move`, () => {
    const change = vi.fn();
    const view = render(
      <div className="brochure-page">
        <article className="brochure-product">
          <ProductArtworkLayer
            product={{
              code: "offer",
              name: "Offer",
              productArtworks: [
                {
                  id: "additional",
                  type: "image",
                  image: "/extra.png",
                  relativeTo: "product",
                  ...position,
                },
              ],
            }}
            onChange={change}
          />
        </article>
      </div>,
    );
    const item = view.container.querySelector<HTMLElement>(
      ".product-artwork-item",
    )!;
    const image = item.querySelector("img")!;
    fireEvent.pointerDown(image, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(item, { clientX: 180, clientY: 140 });
    expect(item.style.left).not.toBe("10%");
    fireEvent[cancellation](image);
    expect(item.style.left).toBe("10%");
    expect(item.style.top).toBe("20%");
    expect(change).not.toHaveBeenCalled();
  });
}

it("restores a resized detail block on lost capture without adding an undo step", () => {
  const change = vi.fn();
  const view = render(
    <div className="brochure-page">
      <article className="brochure-product">
        <div className="brochure-specs">
          <ProductDetailBlock
            product={{
              code: "phone",
              name: "Phone",
              detailBlockPlacements: {
                memory: { x: 0, y: 0, width: 30, height: 2 },
              },
            }}
            detailKey="memory"
            onChange={change}
            onRemove={undefined}
            onEdit={undefined}
            style={undefined}
          >
            128 GB
          </ProductDetailBlock>
        </div>
      </article>
    </div>,
  );
  const item = view.container.querySelector<HTMLElement>(
    ".product-detail-block",
  )!;
  const handle =
    view.container.querySelector<HTMLElement>(
      '[data-resize-corner="bottom-right"]',
    ) || view.getByRole("button", { name: /Resize/ });
  fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, button: 0 });
  fireEvent.pointerMove(handle, { clientX: 180, clientY: 140 });
  expect(item.style.width).not.toBe("30%");
  fireEvent.lostPointerCapture(handle);
  expect(item.style.width).toBe("30%");
  expect(change).not.toHaveBeenCalled();
});

for (const type of ["page", "cover", "stores"] as const) {
  for (const cancellation of ["pointerCancel", "lostPointerCapture"] as const) {
    it(`restores ${type} direct dragging on ${cancellation} without consuming an undo step`, () => {
      const { target, change } = fixture(type);
      fireEvent.pointerDown(target, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.pointerMove(target, { clientX: 180, clientY: 140 });
      expect(target.style.left).not.toBe("10%");
      fireEvent[cancellation](target);
      expect(target.style.left).toBe("10%");
      expect(target.style.top).toBe("20%");
      expect(change).not.toHaveBeenCalled();
      fireEvent.pointerMove(target, { clientX: 300, clientY: 300 });
      expect(target.style.left).toBe("10%");
    });
  }
  it(`restores ${type} resize and commits the next completed gesture once`, () => {
    const { target, change, getByRole } = fixture(type);
    const resize =
      document.querySelector<HTMLElement>(
        '[data-resize-corner="bottom-right"]',
      ) || getByRole("button", { name: /Resize/ });
    fireEvent.pointerDown(resize, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(resize, { clientX: 180, clientY: 140 });
    expect(target.style.width).not.toBe("30%");
    fireEvent.lostPointerCapture(resize);
    expect(target.style.width).toBe("30%");
    expect(change).not.toHaveBeenCalled();
    fireEvent.pointerDown(target, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(target, { clientX: 150, clientY: 100 });
    fireEvent.pointerUp(target);
    fireEvent.lostPointerCapture(target);
    expect(change).toHaveBeenCalledTimes(1);
  });
}
