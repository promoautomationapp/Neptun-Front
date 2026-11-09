import React, { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Campaign, Placement, Product } from "../../src/domain/models";
import { ProductPage } from "../../src/features/brochure/Brochure";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../src/features/brochure/brochurePresets";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";
import { brochurePage } from "../fixtures/brochure-page";

const selector = ".red-reference-saving,.reference-saving-tab,.brochure-saving";
const capture = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "setPointerCapture",
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setLanguage("sq");
  if (capture)
    Object.defineProperty(Element.prototype, "setPointerCapture", capture);
  else Reflect.deleteProperty(Element.prototype, "setPointerCapture");
});

function measurements() {
  vi.stubGlobal("PointerEvent", MouseEvent);
  Object.defineProperty(Element.prototype, "setPointerCapture", {
    configurable: true,
    value: () => {},
  });
  const rect = (element: Element): DOMRect => {
    const el = element as HTMLElement;
    if (el.classList.contains("brochure-page"))
      return DOMRect.fromRect({ width: 1000, height: 1300 });
    if (el.matches(selector)) {
      const blue = el.classList.contains("reference-saving-tab");
      const width = el.style.width
        ? (Number.parseFloat(el.style.width) / 100) * (blue ? 160 : 400)
        : 80;
      const movement = el.style.transform.match(
        /translate\(([-\d.]+)cqw,\s*([-\d.]+)cqw\)/,
      );
      return DOMRect.fromRect({
        x: 330 + Number(movement?.[1] || 0) * 10,
        y: 180 + Number(movement?.[2] || 0) * 10,
        width,
        height: width * (blue ? 0.6 : 1),
      });
    }
    if (el.classList.contains("brochure-price"))
      return DOMRect.fromRect({ x: 300, y: 400, width: 160, height: 100 });
    return DOMRect.fromRect({ x: 100, y: 100, width: 400, height: 450 });
  };
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return rect(this);
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return rect(this).width;
    },
  );
}

it.each([0, 1, 2, 3, 4])(
  "moves, resizes and removes savings independently of the price in design %s",
  (presetIndex) => {
    measurements();
    setLanguage("en");
    const changed = vi.fn();
    function Editor() {
      const [product, setProduct] = useState<Product>({
        code: "one",
        name: "Speaker",
        regular: 99,
        sale: 49,
        savingMode: presetIndex % 2 ? "percentage" : "amount",
        savingsBadge: { backgroundColor: "#bb4477", textColor: "#223344" },
      });
      const campaign: Campaign = {
        id: "badges",
        name: "Badges",
        products: [product],
      };
      applyBrochurePreset(
        campaign,
        availableBrochurePresets(resolveSettings(null))[presetIndex]!,
      );
      return (
        <div className="cs-page-preview edit-view">
          <ProductPage
            campaign={campaign}
            page={brochurePage(campaign.products)}
            onEditSavings={() => {}}
            onLayoutRegion={(_product, kind, placement) => {
              changed(kind, placement);
              setProduct((item) => ({
                ...item,
                brochureContentPlacement: {
                  ...item.brochureContentPlacement,
                  [kind]: placement,
                },
              }));
            }}
          />
        </div>
      );
    }
    const view = render(<Editor />);
    const badge = () => view.container.querySelector<HTMLElement>(selector)!;
    expect(badge().querySelector("path[fill]")?.getAttribute("fill")).toBe(
      "#bb4477",
    );
    const colorText = badge().querySelector("g[fill],text[fill]");
    expect(colorText?.getAttribute("fill")).toBe("#223344");
    const move = badge().querySelector(".cs-region-handle.move")!;
    fireEvent.pointerDown(move, { button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(move, { clientX: 70, clientY: 80 });
    fireEvent.pointerUp(move, { clientX: 70, clientY: 80 });
    expect(changed.mock.calls.at(-1)?.[0]).toBe("saving");
    const moved = changed.mock.calls.at(-1)?.[1] as Placement;
    expect(moved.x).toBeCloseTo(2);
    expect(moved.y).toBeCloseTo(3);
    expect(badge().style.transform).toBe("translate(2cqw, 3cqw)");
    const initialWidth = Number(moved.width);
    const resize = badge().querySelector(".resize-bottom-right")!;
    fireEvent.pointerDown(resize, { button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(resize, { clientX: 60, clientY: 50 });
    fireEvent.pointerUp(resize, { clientX: 60, clientY: 50 });
    const resized = changed.mock.calls.at(-1)?.[1] as Placement;
    expect(resized.width).toBeGreaterThan(initialWidth);
    expect(badge().style.width).toBe(`${resized.width}%`);
    expect(badge().dataset.savingManual).toBe("true");
    fireEvent.click(
      view.getByRole("button", { name: "Remove savings badge: Speaker" }),
    );
    expect(view.container.querySelector(selector)).toBeNull();
    expect(view.container.querySelector(".brochure-price")).toBeTruthy();
    expect(changed.mock.calls.at(-1)?.[1]).toMatchObject({
      ...resized,
      hidden: true,
    });
  },
);
