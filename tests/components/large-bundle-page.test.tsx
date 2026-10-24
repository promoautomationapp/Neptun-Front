import { brochurePage } from "../fixtures/brochure-page";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Campaign, Placement, Product } from "../../src/domain/models";
import {
  ProductPage,
  type ProductEditingProps,
} from "../../src/features/brochure/Brochure";
import {
  BROCHURE_FORMATS,
  brochureFormatContentGeometry,
} from "../../src/features/brochure/brochureFormat";

const members: Product[] = [
  {
    code: "oven",
    name: "FURRË BBSE17320BD",
    brand: "BEKO",
    image: "/oven.png",
    warranty: "5 VITE",
    brochureDetails: [
      "72 L",
      "GRILL",
      "VENTILATOR",
      "Funksioni i katërt",
      "Funksioni i pestë",
    ],
  },
  {
    code: "hob",
    name: "PLLAKË BBSE17320BD",
    brand: "BEKO",
    image: "/hob.png",
    warranty: "5 VITE",
    brochureDetails: ["4+1 SIPËRFAQE TË NGROHJES", "INDIKATOR I NXEHTËSISË"],
  },
  {
    code: "dishwasher",
    name: "ENËLARËSE BDIN18441",
    brand: "BEKO",
    image: "/dishwasher.png",
    warranty: "5 VITE",
    brochureDetails: ["14 SETE / 8 PROGRAME", "FAST+"],
  },
];
const offer: Product = {
  code: "set",
  name: "SET BEKO",
  brand: "BEKO",
  image: "/prepared-oven.png",
  regular: 1008,
  sale: 629,
  bundleProducts: members,
};

function campaign(product: Product, changes: Partial<Campaign> = {}): Campaign {
  return {
    id: "large-set",
    name: "Large set",
    products: [product],
    theme: "blue",
    offerStyle: "current",
    priceLogo: "symbol",
    installments: 12,
    productBackgroundColor: "#245b89",
    includeStoresPage: false,
    includeStoresFooter: false,
    ...changes,
  };
}
function page(product: Product) {
  return brochurePage([product]);
}
function staticPage(product: Product = offer, changes: Partial<Campaign> = {}) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    <ProductPage campaign={campaign(product, changes)} page={page(product)} />,
  );
  return container;
}

const captureDescriptor = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "setPointerCapture",
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (captureDescriptor)
    Object.defineProperty(
      Element.prototype,
      "setPointerCapture",
      captureDescriptor,
    );
  else Reflect.deleteProperty(Element.prototype, "setPointerCapture");
});

it("keeps a three-member set in one full-width card with one price and each complete member copy", () => {
  const product = {
    ...offer,
    bundlePanelColor: "#123456",
    brandLogo: "/reserved-brand.png",
  };
  const before = structuredClone(product);
  const view = staticPage(product);
  const card = view.querySelector<HTMLElement>(".large-bundle-product");
  expect(card?.style.gridColumn).toBe("span 3");
  expect(view.querySelectorAll(".brochure-product")).toHaveLength(1);
  expect(view.querySelectorAll(".large-bundle-member-copy")).toHaveLength(3);
  expect(view.querySelectorAll(".large-bundle-plus")).toHaveLength(2);
  expect(view.querySelectorAll(".brochure-price")).toHaveLength(1);
  expect(view.querySelectorAll(".brochure-red-reference-saving")).toHaveLength(
    1,
  );
  expect(
    view.querySelector(".red-reference-price-svg")?.getAttribute("aria-label"),
  ).toContain("629 €");
  expect(
    view.querySelector(".red-reference-price-svg")?.getAttribute("aria-label"),
  ).toContain("1008 €");
  expect(
    view.querySelector(".red-reference-price-svg")?.getAttribute("aria-label"),
  ).toContain("52.4 €");
  expect(
    view
      .querySelector<HTMLElement>(".large-bundle-offer")
      ?.style.getPropertyValue("--large-bundle-panel-color"),
  ).toBe("#123456");
  expect(
    view
      .querySelector<HTMLImageElement>(".large-bundle-brand-slot img")
      ?.getAttribute("src"),
  ).toBe("/reserved-brand.png");
  for (const member of members) {
    const copy = view.querySelector(
      `[data-bundle-member-code="${member.code}"]`,
    );
    expect(copy?.textContent).toContain(member.name);
    expect(copy?.textContent).toContain("5 VITE GARANCION");
    for (const detail of member.brochureDetails || [])
      expect(copy?.textContent).toContain(detail);
  }
  expect(product).toEqual(before);
});

it("retains one style-appropriate savings artwork, respects explicit copy and retains a saved narrow card width", () => {
  const blue = staticPage(offer, { offerStyle: "card" });
  expect(blue.querySelectorAll(".reference-price-svg")).toHaveLength(1);
  expect(blue.querySelectorAll(".reference-saving-tab")).toHaveLength(1);
  expect(blue.querySelector(".brochure-red-reference-saving")).toBeNull();
  const explicit = staticPage(
    {
      ...offer,
      brochureCardSize: { width: 1, height: 1 },
      offerStyle: "current",
      bundleMemberDetails: { hob: "CUSTOM HOB\nCUSTOM FACT\n8 VITE GARANCION" },
    },
    { offerStyle: "card" },
  );
  expect(explicit.querySelectorAll(".red-reference-price-svg")).toHaveLength(1);
  expect(explicit.querySelector(".reference-price-svg")).toBeNull();
  expect(
    explicit.querySelector<HTMLElement>(".large-bundle-product")?.style
      .gridColumn,
  ).toBe("span 1");
  const hob = explicit.querySelector('[data-bundle-member-code="hob"]');
  expect(hob?.textContent).toContain("CUSTOM HOBCUSTOM FACT8 VITE GARANCION");
  expect(hob?.textContent).not.toContain("INDIKATOR");
});

it("keeps exactly two members in the existing composite offer layout", () => {
  const view = staticPage({ ...offer, bundleProducts: members.slice(0, 2) });
  expect(view.querySelector(".large-bundle-offer")).toBeNull();
  expect(view.querySelector(".brochure-product-bottom")).not.toBeNull();
  expect(view.querySelectorAll(".brochure-price")).toHaveLength(1);
  expect(view.querySelector(".large-bundle-plus")).toBeNull();
});

it.each(BROCHURE_FORMATS)(
  "fits the same one-card composition within $id without changing saved member or price data",
  (format) => {
    const before = structuredClone(offer);
    const view = staticPage(offer, { brochureFormat: format.id });
    const frame = view.querySelector<HTMLElement>(".brochure-format-frame");
    const canonicalPage = view.querySelector<HTMLElement>(".brochure-page");
    expect(frame?.style.getPropertyValue("--brochure-page-aspect")).toBe(
      format.aspectRatio,
    );
    expect(
      canonicalPage?.style.getPropertyValue("--brochure-page-aspect"),
    ).toBe("1080 / 1350");
    const fitted = brochureFormatContentGeometry(format, format.width);
    expect(
      Number.parseFloat(
        frame?.style.getPropertyValue("--brochure-format-content-width") || "0",
      ),
    ).toBeCloseTo(fitted.widthFraction * 100, 8);
    expect(fitted.contentWidth).toBeLessThanOrEqual(fitted.width + 0.000001);
    expect(fitted.contentHeight).toBeLessThanOrEqual(fitted.height + 0.000001);
    expect(fitted.contentWidth / fitted.contentHeight).toBeCloseTo(0.8, 10);
    expect(view.querySelectorAll(".large-bundle-offer")).toHaveLength(1);
    expect(view.querySelectorAll(".large-bundle-member-copy")).toHaveLength(3);
    expect(offer).toEqual(before);
  },
);

function mockPageMeasurement(previewScale = 0.5) {
  vi.stubGlobal("PointerEvent", MouseEvent);
  Object.defineProperty(Element.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  const card = { x: 24.3, y: 33.75, width: 1031.4, height: 409.5 };
  const native = (element: Element): DOMRect => {
    if (element.classList.contains("brochure-page"))
      return DOMRect.fromRect({ width: 1080, height: 1350 });
    if (element.classList.contains("brochure-product"))
      return DOMRect.fromRect(card);
    const photo = element.closest<HTMLElement>(".product-artwork-item");
    if (photo)
      return DOMRect.fromRect({
        x: card.x + (Number.parseFloat(photo.style.left) * card.width) / 100,
        y: card.y + (Number.parseFloat(photo.style.top) * card.height) / 100,
        width: (Number.parseFloat(photo.style.width) * card.width) / 100,
        height: (Number.parseFloat(photo.style.height) * card.height) / 100,
      });
    if (element.classList.contains("large-bundle-photo-area"))
      return DOMRect.fromRect({ ...card, height: card.height * 0.68 });
    const copy = element.closest<HTMLElement>(".large-bundle-member-copy");
    if (copy) {
      const width = (Number.parseFloat(copy.style.width) * card.width) / 100;
      const details = element.closest<HTMLElement>(
        ".large-bundle-member-details",
      );
      const movement = details?.style.transform.match(
        /translate\(([-\d.]+)cqw,\s*([-\d.]+)cqw\)/,
      );
      return DOMRect.fromRect({
        x:
          card.x +
          (Number.parseFloat(copy.style.left) * card.width) / 100 +
          Number(movement?.[1] || 0) * 10.8,
        y: card.y + card.height * 0.74 + Number(movement?.[2] || 0) * 10.8,
        width: width * (Number.parseFloat(details?.style.width || "100") / 100),
        height: 75,
      });
    }
    const region = element.closest<HTMLElement>(
      ".brochure-price,.brochure-red-reference-saving,.large-bundle-brand-artwork",
    );
    if (region) {
      const price = region.classList.contains("brochure-price");
      const brand = region.classList.contains("large-bundle-brand-artwork");
      const width =
        ((Number.parseFloat(region.style.width) ||
          (price ? 20.5 : brand ? 11 : 8.7)) *
          card.width) /
        100;
      const height = price ? width * 0.51 : brand ? card.height * 0.15 : width;
      const movement = region.style.transform.match(
        /translate\(([-\d.]+)cqw,\s*([-\d.]+)cqw\)/,
      );
      return DOMRect.fromRect({
        x:
          card.x +
          card.width * (price || brand ? 0.97 : 0.95) -
          width +
          Number(movement?.[1] || 0) * 10.8,
        y:
          card.y +
          (price
            ? card.height * 0.965 - height
            : brand
              ? card.height * 0.045
              : card.height * 0.31) +
          Number(movement?.[2] || 0) * 10.8,
        width,
        height,
      });
    }
    return DOMRect.fromRect(card);
  };
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return native(this).width;
    },
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const rect = native(this);
      return DOMRect.fromRect({
        x: rect.x * previewScale,
        y: rect.y * previewScale,
        width: rect.width * previewScale,
        height: rect.height * previewScale,
      });
    },
  );
}

it("keeps all member images editable and moves/resizes shared regions and member copy without first-gesture jumps", async () => {
  mockPageMeasurement();
  const edit = vi.fn();
  const editPrice = vi.fn();
  const editSaving = vi.fn();
  const layout = vi.fn(
    (_product: Product, _kind: string, _placement: Placement) => {},
  );
  const change = vi.fn<NonNullable<ProductEditingProps["onProductChange"]>>();
  const view = render(
    <div className="cs-page-preview edit-view">
      <ProductPage
        campaign={campaign(offer)}
        page={page(offer)}
        onEditDetails={edit}
        onEditImage={edit}
        onEditPrice={editPrice}
        onEditSavings={editSaving}
        onLayoutRegion={layout}
        onProductChange={change}
      />
    </div>,
  );
  await waitFor(() =>
    expect(
      view.container.querySelectorAll(".product-artwork-item > img"),
    ).toHaveLength(3),
  );
  expect(
    [...view.container.querySelectorAll(".product-artwork-item > img")].map(
      (image) => image.getAttribute("src"),
    ),
  ).toEqual(["/prepared-oven.png", "/hob.png", "/dishwasher.png"]);
  fireEvent.click(view.getByText("Replace images"));
  expect(edit).toHaveBeenLastCalledWith(offer);
  fireEvent.click(
    view.getByLabelText(`Edit set member details: ${members[0]!.name}`),
  );
  expect(edit).toHaveBeenLastCalledWith(offer);
  fireEvent.click(view.container.querySelector(".brochure-price")!);
  expect(view.container.querySelector(".cs-inline-price-editor")).toBeTruthy();
  fireEvent.keyDown(view.container.querySelector(".brochure-price")!, {
    key: "Enter",
  });
  expect(editPrice).toHaveBeenLastCalledWith(offer);
  fireEvent.keyDown(
    view.container.querySelector(".brochure-red-reference-saving")!,
    { key: "Enter" },
  );
  expect(editSaving).toHaveBeenLastCalledWith(offer);

  const resize = (selector: string, dx: number) => {
    const handle = view.container.querySelector(
      `${selector} .cs-region-handle.resize`,
    );
    if (!handle) throw new Error(`Missing handle ${selector}`);
    fireEvent.pointerDown(handle, { button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(handle, { clientX: 50 + dx, clientY: 50 });
    fireEvent.pointerUp(handle, { clientX: 50 + dx, clientY: 50 });
    return layout.mock.calls.at(-1);
  };
  const brand = resize(".large-bundle-brand-artwork", 2);
  expect(brand?.[1]).toBe("brand");
  expect(brand?.[2].width).toBeGreaterThan(11);
  expect(brand?.[2].width).toBeLessThan(12);
  const saving = resize(".brochure-red-reference-saving", -2);
  expect(saving?.[1]).toBe("saving");
  expect(saving?.[2].width).toBeGreaterThan(8);
  expect(saving?.[2].width).toBeLessThan(8.7);
  const copy = resize(
    '[data-bundle-member-code="oven"] .large-bundle-member-details',
    -10,
  );
  expect(copy?.[1]).toBe("bundle-detail-oven");
  expect(copy?.[2].width).toBeGreaterThan(85);
  expect(copy?.[2].width).toBeLessThan(100);
  const price = view.container.querySelector(
    ".brochure-price .cs-region-handle.move",
  )!;
  fireEvent.pointerDown(price, { button: 0, clientX: 50, clientY: 50 });
  fireEvent.pointerMove(price, { clientX: 56, clientY: 60 });
  fireEvent.pointerUp(price, { clientX: 56, clientY: 60 });
  expect(layout.mock.calls.at(-1)?.[1]).toBe("price");
  expect(layout.mock.calls.at(-1)?.[2].x).toBeCloseTo((6 / 540) * 100);
  const photo = view.container.querySelector(".product-artwork-item > img")!;
  fireEvent.pointerDown(photo, { button: 0, clientX: 50, clientY: 50 });
  fireEvent.pointerMove(photo, { clientX: 65, clientY: 60 });
  fireEvent.pointerUp(photo, { clientX: 65, clientY: 60 });
  expect(change).toHaveBeenLastCalledWith(
    offer,
    "productArtworks",
    expect.arrayContaining([
      expect.objectContaining({ memberCode: "oven", relativeTo: "product" }),
    ]),
  );
  expect(offer.regular).toBe(1008);
  expect(offer.sale).toBe(629);
});
