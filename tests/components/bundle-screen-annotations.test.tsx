import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Artwork, Box, Product } from "../../src/domain/models";
import {
  bundleScreenAnnotationPlacement,
  bundleScreenArtworkPlacement,
  ProductArtworkLayer,
} from "../../src/features/brochure/ProductArtworkLayer";
import { IMAGE_PREPARATION_REVISION } from "../../src/features/brochure/imageReview";

const screen: Box = { x: 0.1, y: 0.2, width: 0.8, height: 0.6 };
const tv: Product = {
  code: "tv",
  name: "TV LED 55MODEL",
  subcategory: "TV",
  image: "/tv.png",
  specs: { Ekran: '55"' },
  screenArtwork: { image: "/wallpaper.png", box: screen },
};
const secondTv: Product = {
  ...tv,
  code: "tv2",
  name: "TV LED 65MODEL",
  image: "/tv2.png",
  specs: { Ekran: '65"' },
};
const appliance: Product = { code: "oven", name: "FURRË", image: "/oven.png" };
function artwork(member: Product, index: number): Artwork {
  return {
    id: `member-${member.code}`,
    type: "bundle-product",
    memberCode: member.code,
    label: member.name,
    image: member.image,
    relativeTo: "product",
    x: 5 + index * 28,
    y: 10,
    width: 25,
    height: 50,
  };
}
const offer: Product = {
  code: "offer",
  name: "SET",
  regular: 1099,
  sale: 799,
  bundleProducts: [
    appliance,
    tv,
    { code: "nested", name: "Nested set", bundleProducts: [secondTv] },
  ],
  productArtworks: [
    artwork(appliance, 0),
    artwork(tv, 1),
    artwork(secondTv, 2),
  ],
};

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
function rect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  };
}
function measuredPhoto(scale = 1) {
  const container = document.createElement("div");
  const image = document.createElement("img");
  image.src = tv.image!;
  image.style.objectFit = "contain";
  container.append(image);
  Object.defineProperties(container, {
    offsetWidth: { value: 300 },
    getBoundingClientRect: {
      value: () => rect(20 * scale, 30 * scale, 300 * scale, 300 * scale),
    },
  });
  Object.defineProperties(image, {
    naturalWidth: { value: 400 },
    naturalHeight: { value: 200 },
    getBoundingClientRect: {
      value: () => rect(20 * scale, 30 * scale, 300 * scale, 300 * scale),
    },
  });
  return { container, image };
}

it.each([1, 0.5])(
  "attaches a TV corner and wallpaper to its contained source screen at preview scale %s",
  (scale) => {
    const { image, container } = measuredPhoto(scale);
    const label = bundleScreenAnnotationPlacement(tv, image, container)!;
    expect(label.type).toBe("television");
    expect(label.inches).toBe(55);
    expect(label.style.left).toBeCloseTo(190.8);
    expect(label.style.top).toBeCloseTo(105);
    expect(label.style.width).toBeCloseTo(79.2);
    expect(label.style.height).toBeCloseTo(79.2);
    expect(bundleScreenArtworkPlacement(tv, image, container)).toEqual({
      x: 10,
      y: 35,
      width: 80,
      height: 30,
    });
  },
);

it("omits a baked TV label unless a replacement wallpaper covers it, and does not create labels for non-screen members", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const { image, container } = measuredPhoto();
  const embedded: Product = {
    ...tv,
    screenArtwork: undefined,
    aiInchesEmbedded: true,
    aiPreparationRevision: IMAGE_PREPARATION_REVISION,
    aiPreparedScreenInches: 55,
    aiAnnotationStyle: "tv-folded-ribbon",
  };
  expect(
    bundleScreenAnnotationPlacement(embedded, image, container),
  ).toBeNull();
  expect(
    bundleScreenAnnotationPlacement(
      { ...embedded, screenArtwork: tv.screenArtwork },
      image,
      container,
    )?.inches,
  ).toBe(55);
  image.src = "/replacement-tv.png";
  expect(
    bundleScreenAnnotationPlacement(embedded, image, container)?.inches,
  ).toBe(55);
  expect(
    bundleScreenAnnotationPlacement(appliance, image, container),
  ).toBeNull();
});

it("uses the existing phone corner and other screen artwork for non-Apple members", () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const { image, container } = measuredPhoto(0.5);
  const phone: Product = {
    code: "phone",
    name: "SMARTPHONE GALAXY",
    subcategory: "SMARTPHONE",
    specs: { Ekran: '6.3"' },
  };
  const label = bundleScreenAnnotationPlacement(phone, image, container)!;
  expect(label.type).toBe("phone");
  expect(label.inches).toBe(6.3);
  expect(label.style.width).toBe(75);
  const laptop: Product = {
    code: "laptop",
    name: "LAPTOP LENOVO",
    subcategory: "LAPTOP",
    specs: { Ekran: '15.6"' },
  };
  expect(
    bundleScreenAnnotationPlacement(laptop, image, container),
  ).toMatchObject({ inches: 15.6, type: "other" });
  expect(
    bundleScreenAnnotationPlacement(
      { ...laptop, brand: "APPLE", name: "MACBOOK AIR" },
      image,
      container,
    ),
  ).toBeNull();
});

function mockMeasurements(scale = 0.5) {
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
  Object.defineProperty(Element.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    400,
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(
    200,
  );
  const nativeBox = (element: Element): DOMRect => {
    if (element.classList.contains("brochure-page"))
      return rect(0, 0, 1080, 1350);
    const item = element.closest<HTMLElement>(".product-artwork-item");
    if (item)
      return rect(
        60 + parseFloat(item.style.left) * 6,
        80 + parseFloat(item.style.top) * 5,
        parseFloat(item.style.width) * 6,
        parseFloat(item.style.height) * 5,
      );
    return rect(60, 80, 600, 500);
  };
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const value = nativeBox(this);
      return rect(
        value.x * scale,
        value.y * scale,
        value.width * scale,
        value.height * scale,
      );
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return nativeBox(this).width;
    },
  );
}

it("renders secondary and nested TV labels in export and makes each label independently movable, resizable and deletable in edit view", async () => {
  mockMeasurements();
  const onChange = vi.fn<(field: keyof Product, value: unknown) => void>();
  function EditableOffer() {
    const [product, setProduct] = React.useState(offer);
    return (
      <div className="brochure-page">
        <article className="brochure-product">
          <ProductArtworkLayer
            product={product}
            onChange={(field, value) => {
              onChange(field, value);
              if (field === "bundleProducts")
                setProduct((current) => ({
                  ...current,
                  bundleProducts: value as Product[],
                }));
            }}
          />
        </article>
      </div>
    );
  }
  const view = render(
    <div className="brochure-page">
      <article className="brochure-product">
        <ProductArtworkLayer product={offer} editable={false} />
      </article>
    </div>,
  );
  await waitFor(() =>
    expect(view.container.querySelectorAll(".bundle-inch-label")).toHaveLength(
      2,
    ),
  );
  expect(view.container.querySelectorAll(".cs-inch-handles")).toHaveLength(0);
  expect(
    view.container.querySelectorAll(".bundle-screen-artwork"),
  ).toHaveLength(2);
  view.rerender(<EditableOffer />);
  const label = await view.findByLabelText("55 inch screen");
  const sibling = view.getByLabelText("65 inch screen");
  const siblingTransform = sibling.style.transform;
  const drag = (element: Element, dx: number, dy: number, cancel = false) => {
    fireEvent.pointerDown(element, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerMove(element, {
      clientX: 100 + dx,
      clientY: 100 + dy,
      pointerId: 1,
    });
    if (cancel) fireEvent.pointerCancel(element, { pointerId: 1 });
    else fireEvent.pointerUp(element, { pointerId: 1 });
  };
  const initial = label.style.transform;
  drag(label, 5.4, 10.8, true);
  expect(label.style.transform).toBe(initial);
  expect(onChange).not.toHaveBeenCalled();
  drag(label, 5.4, 10.8);
  expect(onChange).toHaveBeenLastCalledWith(
    "bundleProducts",
    expect.any(Array),
  );
  const moved = onChange.mock.calls.at(-1)![1] as Product[];
  expect(moved[1]?.screenAnnotationPlacement?.x).toBeCloseTo(
    1 - (2 / 1080) * 100,
  );
  expect(moved[1]?.screenAnnotationPlacement?.y).toBeCloseTo(
    2 + (2 / 1080) * 100,
  );
  expect(moved[2]).toBe(offer.bundleProducts?.[2]);
  expect(sibling.style.transform).toBe(siblingTransform);
  drag(label.querySelector('[aria-label="Resize inch label"]')!, 5.4, 5.4);
  expect(
    (onChange.mock.calls.at(-1)![1] as Product[])[1]?.screenAnnotationPlacement
      ?.scale,
  ).toBeCloseTo(1.1);
  fireEvent.click(label.querySelector('[aria-label="Delete inch label"]')!);
  await waitFor(() =>
    expect(view.queryByLabelText("55 inch screen")).toBeNull(),
  );
  expect(view.getByLabelText("65 inch screen")).toBeTruthy();
  expect(
    (onChange.mock.calls.at(-1)![1] as Product[])[1]?.screenAnnotationPlacement
      ?.hidden,
  ).toBe(true);
  expect(
    onChange.mock.calls.every(([field]) => field === "bundleProducts"),
  ).toBe(true);
  expect([offer.regular, offer.sale]).toEqual([1099, 799]);
});

it("remeasures the member corner after a live photo resize and a clearance event, then settles without changing saved label settings", async () => {
  mockMeasurements();
  const onChange = vi.fn();
  const saved = { x: -1, y: 2, scale: 0.8 };
  const product = {
    ...offer,
    bundleProducts: [appliance, { ...tv, screenAnnotationPlacement: saved }],
    productArtworks: [artwork(tv, 1)],
  };
  const view = render(
    <div className="brochure-page">
      <article className="brochure-product">
        <ProductArtworkLayer product={product} onChange={onChange} />
      </article>
    </div>,
  );
  const label = await view.findByLabelText("55 inch screen");
  const firstWidth = parseFloat(label.style.width);
  const item = label.closest<HTMLElement>(".product-artwork-item")!;
  await act(async () => {
    item.style.width = "35%";
    item
      .closest(".brochure-product")!
      .dispatchEvent(new Event("brochure-photo-clearance", { bubbles: true }));
  });
  await waitFor(() =>
    expect(parseFloat(label.style.width)).toBeGreaterThan(firstWidth),
  );
  expect(label.style.transform).toBe("translate(-1cqw,2cqw) scale(0.8)");
  const currentStyle = label.getAttribute("style");
  await act(async () => {
    item
      .closest(".brochure-product")!
      .dispatchEvent(new Event("brochure-photo-clearance", { bubbles: true }));
  });
  expect(label.getAttribute("style")).toBe(currentStyle);
  expect(onChange).not.toHaveBeenCalled();
});
