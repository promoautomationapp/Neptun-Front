import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  CanvasAsset,
  EditableOfferBlock,
  SocialProductVisual,
} from "../../src/features/social/CanvasLayers";
import type { Placement } from "../../src/domain/models";
import { setLanguage } from "../../src/features/brochure/i18n";
beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal("ResizeObserver", undefined);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return DOMRect.fromRect(
        this.classList.contains("social-canvas")
          ? { x: 0, y: 0, width: 1000, height: 1000 }
          : this.classList.contains("social-editable-offer-block")
            ? { x: 100, y: 200, width: 200, height: 150 }
            : { x: 100, y: 100, width: 200, height: 120 },
      );
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("moves and resizes a logo using canvas percentages and stops after release", () => {
  const change = vi.fn();
  const start = vi.fn();
  const end = vi.fn();
  const view = render(
    <div className="social-canvas">
      <CanvasAsset
        name="Campaign logo"
        source="/logo.png"
        position={{ x: 20, y: 15 }}
        width={20}
        editable
        onChange={change}
        onGestureStart={start}
        onGestureEnd={end}
      />
    </div>,
  );
  const asset = view.getByLabelText("Campaign logo");
  fireEvent.pointerDown(asset, { clientX: 200, clientY: 150, button: 0 });
  fireEvent.pointerMove(asset, { clientX: 300, clientY: 250 });
  expect(change).toHaveBeenLastCalledWith({ x: 30, y: 25, width: 20 });
  fireEvent.pointerUp(asset);
  fireEvent.pointerMove(asset, { clientX: 500, clientY: 500 });
  expect(change).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  expect(end).toHaveBeenCalledTimes(1);
  const resize = view.getByRole("button", { name: "Resize Campaign logo" });
  fireEvent.pointerDown(resize, { clientX: 200, clientY: 150 });
  fireEvent.pointerMove(resize, { clientX: 250, clientY: 150 });
  expect(change).toHaveBeenLastCalledWith({ x: 20, y: 15, width: 30 });
});
it("keeps editable offer blocks inside canvas bounds", () => {
  const change = vi.fn();
  const view = render(
    <div className="social-canvas">
      <EditableOfferBlock
        name="price"
        className="price"
        editable
        onChange={change}
      >
        299€
      </EditableOfferBlock>
    </div>,
  );
  const move = view.getByRole("button", { name: "Move price" });
  fireEvent.pointerDown(move, { clientX: 100, clientY: 200 });
  fireEvent.pointerMove(move, { clientX: -400, clientY: 2200 });
  expect(change).toHaveBeenLastCalledWith({ x: -10, y: 65, scale: 1 });
  fireEvent.pointerUp(move);
  const resize = view.getByRole("button", { name: "Resize price" });
  fireEvent.pointerDown(resize, { clientX: 100, clientY: 200 });
  fireEvent.pointerMove(resize, { clientX: 900, clientY: 200 });
  expect(change).toHaveBeenLastCalledWith({ x: 0, y: 0, scale: 1.8 });
});
it("moves a product photo relative to its measured dimensions without a resize observer", () => {
  const change = vi.fn();
  const view = render(
    <div className="social-canvas">
      <article className="social-product">
        <SocialProductVisual
          product={{ code: "photo", name: "Product photo" }}
          image="/photo.png"
          adjustImage
          onPlaceImage={change}
        />
      </article>
    </div>,
  );
  const image = view.getByAltText("Product photo");
  fireEvent.pointerDown(image, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(image, { clientX: 200, clientY: 160 });
  expect(change).toHaveBeenLastCalledWith({ x: 50, y: 50, scale: 1 });
});

it("uses the same gentle TV inch sizing for social photos and retains saved sizes", () => {
  const tv = (inches: number) => ({
    code: String(inches),
    name: `TV LED ${inches}ABC`,
    subcategory: "TV",
    specs: { Përmasat: `${inches} inch` },
  });
  const view = render(
    <>
      {[55, 65, 66].map((inches) => (
        <SocialProductVisual
          key={inches}
          product={tv(inches)}
          image={`/tv-${inches}.png`}
        />
      ))}
    </>,
  );
  expect(
    Array.from(
      view.container.querySelectorAll<HTMLImageElement>(
        ".social-product-main-image",
      ),
      (image) => image.style.transform,
    ),
  ).toEqual([
    "translate(0%, 0%) scale(0.86)",
    "translate(0%, 0%) scale(0.93)",
    "translate(0%, 0%) scale(0.9323)",
  ]);
  view.rerender(
    <SocialProductVisual
      product={{ ...tv(55), postImagePlacement: { x: 4, y: 8, scale: 1.2 } }}
      image="/tv-55.png"
    />,
  );
  expect(
    view.container.querySelector<HTMLImageElement>(
      ".social-product-main-image",
    )!.style.transform,
  ).toBe("translate(4%, 8%) scale(1.2)");
});

it("keeps an unrecognized screen original and honors whole-image or fill choices once a panel is fitted", () => {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    200,
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(
    120,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => null,
  );
  const product = {
    code: "TV",
    name: "TV",
    subcategory: "TV",
    image: "/tv.png",
    screenArtwork: { image: "/wallpaper.png" },
  };
  const canvas = (fit?: "contain" | "cover", fitted = false) => (
    <div className="social-canvas">
      <article className="social-product">
        <SocialProductVisual
          product={{
            ...product,
            screenArtwork: {
              ...product.screenArtwork,
              fit,
              ...(fit === "contain" ? { fitExplicit: true } : {}),
              ...(fitted
                ? { box: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 } }
                : {}),
            },
          }}
          image={product.image}
        />
      </article>
    </div>
  );
  const view = render(canvas());
  fireEvent.load(view.getByAltText("TV"));
  expect(
    view.container.querySelector(".social-product-screen-image"),
  ).toBeNull();
  view.rerender(canvas(undefined, true));
  const overlay = view.container.querySelector<HTMLImageElement>(
    ".social-product-screen-image",
  )!;
  expect(overlay.style.width).toBe("80%");
  expect(overlay.style.height).toBe("60%");
  expect(overlay.style.objectFit).toBe("cover");
  view.rerender(canvas("contain", true));
  expect(overlay.style.objectFit).toBe("contain");
  view.rerender(canvas("cover", true));
  expect(overlay.style.objectFit).toBe("cover");
});

it("keeps the wallpaper and inch corner attached when the social TV photo is resized", () => {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    400,
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(
    240,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const scale = this.classList.contains("social-product-main-image")
        ? Number(
            (this as HTMLElement).style.transform.match(
              /scale\(([^)]+)/,
            )?.[1] || 1,
          )
        : 1;
      return DOMRect.fromRect(
        this.classList.contains("social-canvas")
          ? { x: 0, y: 0, width: 1000, height: 1000 }
          : { x: 100, y: 100, width: 200 * scale, height: 120 * scale },
      );
    },
  );
  const visual = (scale: number) => (
    <div className="social-canvas">
      <article className="social-product">
        <SocialProductVisual
          product={{
            code: "resizable-tv",
            name: "TV LED 55MODEL",
            subcategory: "TV",
            image: "/resize-tv.png",
            specs: { Ekrani: '55"' },
            postImagePlacement: { x: 0, y: 0, scale },
            screenArtwork: {
              image: "/wallpaper.jpg",
              box: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 },
            },
          }}
          image="/resize-tv.png"
          showInches
        />
      </article>
    </div>
  );
  const view = render(visual(1));
  const wallpaper = view.container.querySelector<HTMLElement>(
    ".social-product-screen-image",
  )!;
  const inches = view.container.querySelector<HTMLElement>(
    ".social-screen-size-label",
  )!;
  const width = parseFloat(wallpaper.style.width),
    inchWidth = parseFloat(inches.style.width);
  view.rerender(visual(0.5));
  expect(parseFloat(wallpaper.style.width)).toBeCloseTo(width / 2);
  expect(parseFloat(inches.style.width)).toBeCloseTo(inchWidth / 2);
  expect(wallpaper.style.objectFit).toBe("cover");
  expect(view.getByAltText("TV LED 55MODEL").getAttribute("src")).toBe(
    "/resize-tv.png",
  );
});

it("saves the measured name alignment into the first manual move without a jump", () => {
  const change = vi.fn();
  function ControlledCopy({ initial }: { initial?: Placement }) {
    const [placement, setPlacement] = React.useState(initial);
    return (
      <div className="social-canvas">
        <EditableOfferBlock
          name="product name"
          className="social-product-copy"
          placement={placement}
          editable
          onChange={(next) => {
            setPlacement(next);
            change(next);
          }}
        >
          Product name
        </EditableOfferBlock>
      </div>
    );
  }
  const view = render(<ControlledCopy />);
  const copy = view.container.querySelector<HTMLElement>(
    ".social-product-copy",
  )!;
  // ProductNameDivider positions the name using a measured pixel correction.
  copy.style.translate = "0 25px";
  const move = view.getByRole("button", { name: "Move product name" });
  fireEvent.pointerDown(move, { clientX: 100, clientY: 200 });
  expect(change).toHaveBeenLastCalledWith({ x: 0, y: 2.5, scale: 1 });
  expect(copy.style.translate).toBe("");
  expect(copy.style.transform).toBe("translate(0cqw, 2.5cqw) scale(1)");
  expect(copy.dataset.nameDividerManual).toBe("true");
  fireEvent.pointerMove(move, { clientX: 200, clientY: 300 });
  expect(change).toHaveBeenLastCalledWith({ x: 10, y: 12.5, scale: 1 });
  fireEvent.pointerUp(move);
  const saved = change.mock.lastCall![0] as Placement;
  view.unmount();
  const reloaded = render(<ControlledCopy initial={saved} />);
  expect(
    reloaded.container.querySelector<HTMLElement>(".social-product-copy")?.style
      .transform,
  ).toBe("translate(10cqw, 12.5cqw) scale(1)");
});

it("uses double-click to edit and lets move/resize clicks stay local", () => {
  const edit = vi.fn();
  const parent = vi.fn();
  const view = render(
    <div className="social-canvas" onDoubleClick={parent}>
      <EditableOfferBlock name="price" className="price" editable onEdit={edit}>
        299€
      </EditableOfferBlock>
    </div>,
  );
  fireEvent.click(view.getByText("299€"));
  fireEvent.click(view.getByRole("button", { name: "Move price" }));
  fireEvent.click(view.getByRole("button", { name: "Resize price" }));
  expect(edit).not.toHaveBeenCalled();
  fireEvent.doubleClick(view.getByText("299€"));
  expect(edit).toHaveBeenCalledTimes(1);
  expect(parent).not.toHaveBeenCalled();
});
