import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Campaign, Product } from "../../src/domain/models";
import { BlackFridayPage } from "../../src/features/brochure/BlackFridayPage";
import { BrochureFormatFrame } from "../../src/features/brochure/BrochureFormatFrame";
import { PageArtwork } from "../../src/features/brochure/PageArtwork";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("preserves a manually edited product frame through banner edits and hiding/restoring", () => {
  setLanguage("en");
  const frame = { x: 12, y: 42, width: 44, height: 30 };
  const product: Product = {
    code: "one",
    name: "TV",
    brochureContentPlacement: { frame, price: { x: 7, y: 8 } },
  };
  const campaign: Campaign = {
    id: "bf",
    name: "BF",
    products: [product],
    brochurePresetId: "neptun-black-friday",
    brochureFormat: "a3",
  };
  const change = vi.fn();
  const props = {
    campaign,
    products: [product],
    onProductChange: change,
    renderProduct: () => <span>Editable offer</span>,
  };
  const view = render(<BlackFridayPage {...props} />);
  const style = () =>
    view.container.querySelector<HTMLElement>(".bf-product-frame")!.style;
  expect([style().left, style().top, style().width, style().height]).toEqual([
    "12%",
    "42%",
    "44%",
    "30%",
  ]);
  const bannerCampaign: Campaign = {
    ...campaign,
    pageArtworks: {
      cover: [
        {
          id: "banner",
          type: "text",
          layoutRole: "banner",
          x: 0,
          y: 0,
          width: 100,
          height: 50,
          text: "New banner",
        },
      ],
    },
  };
  view.rerender(<BlackFridayPage {...props} campaign={bannerCampaign} />);
  expect([style().left, style().top, style().width, style().height]).toEqual([
    "12%",
    "42%",
    "44%",
    "30%",
  ]);
  fireEvent.click(
    view.getByRole("button", { name: "Hide cover bf-product-one" }),
  );
  expect(change).toHaveBeenLastCalledWith(product, {
    brochureContentPlacement: {
      ...product.brochureContentPlacement,
      frame: { ...frame, hidden: true },
    },
  });
  view.rerender(
    <BlackFridayPage
      {...props}
      products={[
        {
          ...product,
          brochureContentPlacement: {
            ...product.brochureContentPlacement,
            frame: { ...frame, hidden: true },
          },
        },
      ]}
    />,
  );
  expect(view.queryByText("Editable offer")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Restore bf product one" }));
  expect(change.mock.lastCall?.[1]?.brochureContentPlacement.frame).toEqual({
    ...frame,
    hidden: false,
  });
});

it("renders source shapes as independently editable SVG fills and retains A3 frame geometry", () => {
  const campaign: Campaign = {
    id: "bf",
    name: "BF",
    products: [],
    brochurePresetId: "neptun-black-friday",
    brochureFormat: "a3",
    pageArtworks: {
      cover: [
        {
          id: "ribbon",
          type: "shape",
          x: 0,
          y: 0,
          width: 60,
          height: 7,
          fill: "#ef4023",
          shapePath: "M0 0 L100 0 L90 100 L0 100 Z",
          stroke: "#ffffff",
          strokeWidth: 1,
        },
      ],
    },
  };
  const view = render(
    <BrochureFormatFrame campaign={campaign} kind="cover">
      <section className="brochure-page">
        <PageArtwork
          campaign={campaign}
          pageKey="cover"
          onChange={() => {}}
          onRemove={() => {}}
        />
      </section>
    </BrochureFormatFrame>,
  );
  const output = view.container.querySelector<HTMLElement>(
    ".brochure-output-page",
  )!;
  expect(output.style.getPropertyValue("--brochure-page-aspect")).toBe(
    "297 / 420",
  );
  expect(output.style.getPropertyValue("--brochure-format-content-width")).toBe(
    "100%",
  );
  expect(
    view.container
      .querySelector(".page-layer-shape path")
      ?.getAttribute("fill"),
  ).toBe("#ef4023");
  expect(view.container.querySelector(".page-image-manage")).toBeNull();
  expect(view.container.querySelector(".artwork-resize")).toBeTruthy();
});

it("preserves source word spacing and no-wrap text instead of breaking the cover heading", () => {
  const view = render(
    <section className="brochure-page">
      <PageArtwork
        campaign={{
          pageArtworks: {
            cover: [
              {
                id: "headline",
                type: "text",
                x: 2,
                y: 5,
                width: 90,
                text: "BLACK FRIDAY",
                wordSpacing: -0.05,
                whiteSpace: "nowrap",
              },
            ],
          },
        }}
        pageKey="cover"
      />
    </section>,
  );
  const text = view.getByText("BLACK FRIDAY");
  expect(text.style.wordSpacing).toBe("-0.05em");
  expect(text.style.whiteSpace).toBe("nowrap");
});

it("moves nested device annotations in product-frame percentages instead of whole-page percentages", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const change = vi.fn();
  const campaign = {
    pageArtworks: {
      cover: [
        {
          id: "annotation",
          type: "shape",
          x: 5,
          y: 5,
          width: 20,
          height: 20,
          fill: "#ffffff",
        },
      ],
    },
  };
  const view = render(
    <section className="brochure-page">
      <div className="bf-product-frame">
        <PageArtwork campaign={campaign} pageKey="cover" onChange={change} />
      </div>
    </section>,
  );
  const page = view.container.querySelector<HTMLElement>(".brochure-page")!;
  const card = view.container.querySelector<HTMLElement>(".bf-product-frame")!;
  const artwork = view.container.querySelector<HTMLElement>(
    ".brochure-floating-artwork",
  )!;
  artwork.setPointerCapture = vi.fn();
  vi.spyOn(page, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    width: 1000,
    height: 1400,
    top: 0,
    left: 0,
    right: 1000,
    bottom: 1400,
    toJSON() {},
  });
  vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
    x: 100,
    y: 200,
    width: 400,
    height: 500,
    top: 200,
    left: 100,
    right: 500,
    bottom: 700,
    toJSON() {},
  });
  vi.spyOn(artwork, "getBoundingClientRect").mockReturnValue({
    x: 120,
    y: 225,
    width: 80,
    height: 100,
    top: 225,
    left: 120,
    right: 200,
    bottom: 325,
    toJSON() {},
  });
  fireEvent.pointerDown(artwork, { clientX: 150, clientY: 250, bubbles: true });
  fireEvent.pointerMove(artwork, { clientX: 190, clientY: 300, bubbles: true });
  fireEvent.pointerUp(artwork, { clientX: 190, clientY: 300, bubbles: true });
  expect(change).toHaveBeenLastCalledWith(
    "annotation",
    expect.objectContaining({ x: 15, y: 15 }),
  );
});
