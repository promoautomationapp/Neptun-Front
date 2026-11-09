import React, { useRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  BackgroundCanvasControls,
  isBackgroundCanvasTarget,
} from "../../src/features/brochure/BackgroundCanvasControls";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => {
  setLanguage("en");
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return DOMRect.fromRect({
        x: 0,
        y: 0,
        width: this.classList.contains("cs-background-canvas-controls")
          ? 340
          : 620,
        height: this.classList.contains("cs-background-canvas-controls")
          ? 250
          : 775,
      });
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setLanguage("sq");
});
function fixture(options: { enabled?: boolean; pageKey?: string } = {}) {
  const background = vi.fn(),
    appearance = vi.fn(),
    design = vi.fn();
  function Editor({
    enabled = true,
    pageKey = "cover",
  }: {
    enabled?: boolean;
    pageKey?: string;
  }) {
    const ref = useRef<HTMLDivElement>(null);
    return (
      <>
        <div ref={ref} data-testid="container" tabIndex={0}>
          <section className="brochure-page" data-testid="paper">
            <div className="cover-content" data-testid="empty" />
            <article className="brochure-product">
              <div data-testid="product" />
              <img alt="Phone" src="/photo.png" />
            </article>
            <div className="brochure-floating-artwork" data-testid="artwork" />
            <div
              className="cover-editable-element cover-element-headline"
              data-testid="headline"
            />
            <button type="button">Existing action</button>
            <p>Existing text</p>
          </section>
        </div>
        <BackgroundCanvasControls
          containerRef={ref}
          pageKey={pageKey}
          enabled={enabled}
          color="#1c4075"
          appearance={{
            textColor: "#ffffff",
            brandColor: "#ffffff",
            screenLabelColor: "#ffffff",
            priceStyle: "current",
          }}
          onBackgroundChange={background}
          onAppearanceChange={appearance}
          onChangeDesign={design}
        />
      </>
    );
  }
  const view = render(<Editor {...options} />);
  return { ...view, background, appearance, design, Editor };
}

it("opens only over empty paper and leaves products, artwork, text and controls alone", () => {
  const view = fixture();
  for (const name of ["product", "artwork", "headline"]) {
    fireEvent.click(view.getByTestId(name));
    expect(view.queryByRole("toolbar")).toBeNull();
  }
  fireEvent.click(view.getByRole("button", { name: "Existing action" }));
  fireEvent.click(view.getByText("Existing text"));
  expect(view.queryByRole("toolbar")).toBeNull();
  fireEvent.click(view.getByTestId("empty"), { clientX: 100, clientY: 160 });
  expect(
    view
      .getByRole("toolbar", { name: "Page background" })
      .closest("[data-background-canvas-controls]")?.parentElement,
  ).toBe(document.body);
  expect(
    isBackgroundCanvasTarget(
      view.getByTestId("container"),
      view.getByTestId("container"),
    ),
  ).toBe(false);
  fireEvent.pointerDown(view.getByTestId("product"));
  expect(view.queryByRole("toolbar")).toBeNull();
});

it("offers current-page, all-page and design actions in the right-click menu", () => {
  const view = fixture();
  expect(
    fireEvent.contextMenu(view.getByTestId("paper"), {
      clientX: 250,
      clientY: 260,
    }),
  ).toBe(false);
  fireEvent.click(
    view.getByRole("menuitem", { name: "Change background of all pages" }),
  );
  expect(
    view
      .getByRole("button", { name: "Apply to all pages" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  const preset = view
    .getByRole("group", { name: "Page background presets" })
    .querySelector("button")!;
  fireEvent.click(preset);
  expect(view.background).toHaveBeenLastCalledWith(
    expect.objectContaining({ backgroundGradient: null, backgroundImage: "" }),
    "all",
  );
  fireEvent.contextMenu(view.getByTestId("paper"));
  fireEvent.click(
    view.getByRole("menuitem", { name: "Change brochure design" }),
  );
  expect(view.design).toHaveBeenCalledOnce();
  expect(view.queryByRole("menu")).toBeNull();
});

it("uses the resolved appearance, offers both prices and keeps the nested color picker usable", () => {
  const view = fixture();
  fireEvent.click(view.getByTestId("empty"));
  fireEvent.click(view.getByRole("button", { name: "Text & logos" }));
  expect(
    view
      .getByRole("button", { name: "Red haPPy offer" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(view.getByRole("button", { name: "Blue price card" }));
  expect(view.appearance).toHaveBeenLastCalledWith(
    { priceStyle: "card" },
    "page",
  );
  fireEvent.click(view.getByRole("button", { name: "Advanced colors" }));
  fireEvent.click(view.getByRole("button", { name: "Text color: #ffffff" }));
  const picker = view.getByLabelText("Pick text color");
  fireEvent.pointerDown(picker);
  fireEvent.change(picker, { target: { value: "#243a6a" } });
  expect(view.appearance).toHaveBeenLastCalledWith(
    { textColor: "#243a6a" },
    "page",
  );
  expect(view.getByRole("toolbar", { name: "Page background" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Use automatic colors" }));
  expect(view.appearance).toHaveBeenLastCalledWith(
    {
      textColor: undefined,
      brandColor: undefined,
      screenLabelColor: undefined,
      priceStyle: "auto",
    },
    "page",
  );
});

it("applies a gradient deterministically and closes for Escape, page changes or disabled modes", () => {
  const view = fixture();
  fireEvent.click(view.getByTestId("empty"));
  fireEvent.click(view.getByRole("button", { name: "Gradient" }));
  fireEvent.click(view.getByRole("button", { name: "Apply gradient" }));
  expect(view.background).toHaveBeenLastCalledWith(
    {
      backgroundColor: "",
      backgroundGradient: { from: "#1c4075", to: "#86b3de", angle: 135 },
      backgroundImage: "",
    },
    "page",
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(view.queryByRole("toolbar")).toBeNull();
  fireEvent.click(view.getByTestId("empty"));
  view.rerender(<view.Editor pageKey="product-0" />);
  expect(view.queryByRole("toolbar")).toBeNull();
  view.rerender(<view.Editor enabled={false} />);
  fireEvent.click(view.getByTestId("empty"));
  fireEvent.contextMenu(view.getByTestId("paper"));
  expect(view.queryByRole("toolbar")).toBeNull();
  expect(view.queryByRole("menu")).toBeNull();
});

it("clamps controls inside a narrow viewport and exposes a keyboard context menu", () => {
  const view = fixture();
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(390);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(844);
  fireEvent.click(view.getByTestId("empty"), { clientX: 389, clientY: 840 });
  const host = document.querySelector<HTMLElement>(
    "[data-background-canvas-controls]",
  )!;
  expect(Number.parseFloat(host.style.left)).toBe(42);
  expect(Number.parseFloat(host.style.top)).toBe(586);
  fireEvent.keyDown(view.getByTestId("container"), { key: "ContextMenu" });
  const first = view.getByRole("menuitem", {
    name: "Change background of this page",
  });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "ArrowDown" });
  expect(document.activeElement).toBe(
    view.getByRole("menuitem", { name: "Change background of all pages" }),
  );
});
