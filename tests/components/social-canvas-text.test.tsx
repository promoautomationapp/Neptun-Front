import React, { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Artwork } from "../../src/domain/models";
import { SocialCanvasText } from "../../src/features/social/SocialCanvasText";
import { setLanguage } from "../../src/features/brochure/i18n";

const initial: Artwork = {
  id: "text-1",
  type: "text",
  text: "Original",
  x: 10,
  y: 20,
  width: 25,
  fontSize: 4,
  color: "#ffffff",
};
beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return DOMRect.fromRect(
        this.classList.contains("social-canvas")
          ? { x: 0, y: 0, width: 1000, height: 1000 }
          : { x: 100, y: 200, width: 250, height: 50 },
      );
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("commits direct text edits and restores Escape without saving draft text", () => {
  const changed = vi.fn();
  const view = render(
    <div className="social-canvas">
      <SocialCanvasText artwork={initial} onChange={changed} />
    </div>,
  );
  const text = view.getByRole("textbox", { name: "Text layer" });
  fireEvent.focus(text);
  text.textContent = "Changed";
  fireEvent.keyDown(text, { key: "Enter" });
  fireEvent.blur(text);
  expect(changed).toHaveBeenCalledWith({ text: "Changed" });
  changed.mockClear();
  fireEvent.focus(text);
  text.textContent = "Discard";
  fireEvent.keyDown(text, { key: "Escape" });
  fireEvent.blur(text);
  expect(text.textContent).toBe("Original");
  expect(changed).not.toHaveBeenCalled();
});
it("resizes from all corners with proportional font size and rolls back cancelled gestures", () => {
  function Fixture() {
    const [artwork, setArtwork] = useState(initial);
    return (
      <div className="social-canvas">
        <SocialCanvasText
          artwork={artwork}
          onChange={(patch) => setArtwork({ ...artwork, ...patch })}
        />
        <output>{JSON.stringify(artwork)}</output>
      </div>
    );
  }
  const view = render(<Fixture />);
  fireEvent.click(view.getByRole("button", { name: "Move text" }));
  const resize = view.getByRole("button", { name: "Resize Text · top-left" });
  fireEvent.pointerDown(resize, { clientX: 100, clientY: 200 });
  fireEvent.pointerMove(resize, { clientX: 0, clientY: 200 });
  fireEvent.pointerUp(resize);
  expect(
    JSON.parse(view.container.querySelector("output")!.textContent!),
  ).toMatchObject({ x: 0, y: 18, width: 35, fontSize: 5.6 });
  expect(view.getAllByRole("button", { name: /Resize Text/ })).toHaveLength(4);
  fireEvent.pointerDown(resize, { clientX: 0, clientY: 200 });
  fireEvent.pointerMove(resize, { clientX: -100, clientY: 200 });
  fireEvent.pointerCancel(resize);
  expect(
    JSON.parse(view.container.querySelector("output")!.textContent!),
  ).toMatchObject({ width: 35, fontSize: 5.6 });
});
it("renders export text without move, formatting or resize controls", () => {
  const view = render(<SocialCanvasText artwork={initial} />);
  expect(view.getByText("Original")).toBeTruthy();
  expect(view.queryByRole("textbox")).toBeNull();
  expect(view.queryByRole("button")).toBeNull();
});
it("keeps the chosen font and angle in the exported text and exposes an editable rotation", () => {
  const changed = vi.fn();
  const view = render(
    <SocialCanvasText
      artwork={{
        ...initial,
        fontFamily: "Cera Pro",
        fontWeight: 900,
        rotation: -6,
        lineHeight: 0.9,
      }}
      onChange={changed}
    />,
  );
  const layer = view.container.querySelector<HTMLElement>(".social-free-text")!;
  expect(layer.style.transform).toBe("rotate(-6deg)");
  expect(layer.style.fontFamily).toBe('"Cera Pro"');
  expect(layer.style.fontWeight).toBe("900");
  fireEvent.click(view.getByRole("button", { name: "Move text" }));
  fireEvent.change(view.getByRole("spinbutton", { name: "Text rotation" }), {
    target: { value: "-15" },
  });
  expect(changed).toHaveBeenCalledWith({ rotation: -15 });
});
