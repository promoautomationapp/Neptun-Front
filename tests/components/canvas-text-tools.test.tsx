import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { CanvasTools } from "../../src/features/brochure/CanvasTools";
import { PageArtwork } from "../../src/features/brochure/PageArtwork";
import { RESIZE_CORNERS } from "../../src/features/brochure/resizeCorners";
import { setLanguage } from "../../src/features/brochure/i18n";
import { readImage } from "../../src/features/brochure/utils";

vi.mock("../../src/features/brochure/utils", () => ({
  readImage: vi.fn().mockResolvedValue("/uploaded/replacement.svg"),
}));

beforeEach(() => {
  vi.mocked(readImage).mockResolvedValue("/uploaded/replacement.svg");
  setLanguage("en");
  vi.stubGlobal("PointerEvent", MouseEvent);
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: () => undefined,
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const page = this.classList.contains("brochure-page");
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: page ? 1080 : 324,
        bottom: page ? 1350 : 135,
        width: page ? 1080 : 324,
        height: page ? 1350 : 135,
        toJSON: () => ({}),
      };
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const layer = {
  id: "headline",
  type: "text",
  text: "Your message",
  color: "#174d75",
  fontSize: 4,
  x: 10,
  y: 20,
  width: 30,
  height: 10,
};
function fixture(editable = true) {
  const change = vi.fn(),
    remove = vi.fn();
  const view = render(
    <div className="brochure-page">
      <PageArtwork
        campaign={{ pageArtworks: { cover: [layer] } }}
        pageKey="cover"
        onChange={editable ? change : undefined}
        onRemove={remove}
      />
    </div>,
  );
  const text = view.container.querySelector<HTMLElement>(
    '[data-text-layer="headline"]',
  )!;
  const item = view.container.querySelector<HTMLElement>(
    ".brochure-floating-artwork",
  )!;
  return { ...view, text, item, change, remove };
}

it("provides clear pointer, text and comment tools with keyboard shortcuts that respect text inputs", () => {
  const select = vi.fn();
  const view = render(
    <>
      <CanvasTools activeTool="pointer" onSelect={select} />
      <input aria-label="Name" />
    </>,
  );
  expect(
    view.getByRole("button", { name: "Pointer" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(view.getByRole("button", { name: "Add text anywhere" }));
  expect(select).toHaveBeenLastCalledWith("text");
  fireEvent.keyDown(window, { key: "c" });
  expect(select).toHaveBeenLastCalledWith("comment");
  fireEvent.keyDown(window, { key: "v" });
  expect(select).toHaveBeenLastCalledWith("pointer");
  select.mockClear();
  fireEvent.keyDown(view.getByRole("textbox", { name: "Name" }), { key: "t" });
  fireEvent.keyDown(window, { key: "t", metaKey: true });
  expect(select).not.toHaveBeenCalled();
  view.rerender(
    <CanvasTools activeTool="pointer" onSelect={select} disabled />,
  );
  expect(
    view
      .getByRole("button", { name: "Add text anywhere" })
      .hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.keyDown(window, { key: "t" });
  expect(select).not.toHaveBeenCalled();
});

it("edits a page text layer directly and commits once on Enter without opening an image picker", () => {
  const { text, change, container } = fixture();
  text.focus();
  expect(document.activeElement).toBe(text);
  text.textContent = "Autumn offers";
  fireEvent.keyDown(text, { key: "Enter" });
  expect(change).toHaveBeenCalledTimes(1);
  expect(change).toHaveBeenCalledWith("headline", {
    ...layer,
    text: "Autumn offers",
  });
  fireEvent.doubleClick(text);
  expect(container.querySelector('input[type="file"]')).toBeNull();
});

it("restores a cancelled text edit and pastes only plain text", () => {
  const { text, change } = fixture();
  text.focus();
  text.textContent = "Discard this";
  fireEvent.keyDown(text, { key: "Escape" });
  expect(text.textContent).toBe("Your message");
  expect(change).not.toHaveBeenCalled();
  text.focus();
  const range = document.createRange();
  range.selectNodeContents(text);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  fireEvent.paste(text, {
    clipboardData: {
      getData: (type: string) =>
        type === "text/plain" ? "New\noffers" : "<b>New offers</b>",
    },
  });
  expect(text.textContent).toBe("New offers");
  expect(text.querySelector("b")).toBeNull();
  fireEvent.blur(text);
  expect(change).toHaveBeenCalledWith("headline", {
    ...layer,
    text: "New offers",
  });
});

it("shows formatting for the selected text with size, color, removal and a dedicated move handle", () => {
  const { text, item, change, remove, getByRole, queryByRole } = fixture();
  expect(queryByRole("toolbar", { name: "Text formatting" })).toBeNull();
  fireEvent.pointerDown(text, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(item, { clientX: 208, clientY: 145 });
  fireEvent.pointerUp(item);
  expect(change).not.toHaveBeenCalled();
  expect(item.style.left).toBe("10%");
  fireEvent.change(getByRole("spinbutton", { name: "Text size" }), {
    target: { value: "6" },
  });
  expect(change).toHaveBeenLastCalledWith("headline", {
    ...layer,
    fontSize: 6,
  });
  fireEvent.change(document.querySelector('input[type="color"]')!, {
    target: { value: "#cc1122" },
  });
  expect(change).toHaveBeenLastCalledWith("headline", {
    ...layer,
    fontSize: 6,
    color: "#cc1122",
  });
  const move = getByRole("button", { name: "Move text" });
  fireEvent.pointerDown(move, { clientX: 100, clientY: 100, button: 0 });
  fireEvent.pointerMove(move, { clientX: 208, clientY: 100 });
  fireEvent.pointerUp(move);
  expect(change).toHaveBeenLastCalledWith("headline", {
    ...layer,
    fontSize: 6,
    color: "#cc1122",
    x: 20,
  });
  fireEvent.click(getByRole("button", { name: "Delete text" }));
  expect(remove).toHaveBeenCalledWith("headline");
});

for (const corner of RESIZE_CORNERS)
  it(`scales text proportionally from ${corner} while anchoring the opposite corner`, () => {
    const { item, text, change, container } = fixture();
    const handle = container.querySelector<HTMLElement>(
      `[data-resize-corner="${corner}"]`,
    )!;
    const left = corner.endsWith("left"),
      top = corner.startsWith("top");
    fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, button: 0 });
    fireEvent.pointerMove(handle, {
      clientX: 200 + (left ? -108 : 108),
      clientY: 200 + (top ? -45 : 45),
    });
    expect(parseFloat(item.style.width)).toBeCloseTo(40);
    expect(parseFloat(text.style.fontSize)).toBeCloseTo((4 * 4) / 3);
    expect(
      parseFloat(item.style.left) + (left ? parseFloat(item.style.width) : 0),
    ).toBeCloseTo(left ? 40 : 10);
    expect(
      parseFloat(item.style.top) + (top ? parseFloat(item.style.height) : 0),
    ).toBeCloseTo(top ? 30 : 20);
    expect(change).not.toHaveBeenCalled();
    fireEvent.pointerUp(handle);
    expect(change).toHaveBeenCalledTimes(1);
    expect(change.mock.calls[0]?.[1]?.fontSize).toBeCloseTo((4 * 4) / 3);
  });

it("cancels text resizing without saving the temporary font size and renders previews without editing controls", () => {
  const { item, text, change, container, rerender } = fixture();
  const handle = container.querySelector<HTMLElement>(
    '[data-resize-corner="bottom-right"]',
  )!;
  fireEvent.pointerDown(handle, { clientX: 200, clientY: 200, button: 0 });
  fireEvent.pointerMove(handle, { clientX: 308, clientY: 245 });
  expect(text.style.fontSize).not.toBe("4cqw");
  fireEvent.pointerCancel(handle);
  expect(item.style.width).toBe("30%");
  expect(text.style.fontSize).toBe("4cqw");
  expect(change).not.toHaveBeenCalled();
  rerender(
    <div className="brochure-page">
      <PageArtwork
        campaign={{ pageArtworks: { cover: [layer] } }}
        pageKey="cover"
      />
    </div>,
  );
  expect(container.querySelector('[contenteditable="true"]')).toBeNull();
  expect(container.querySelector("button")).toBeNull();
});

it("keeps double-click replacement and file-drop replacement available on image layers", async () => {
  const change = vi.fn();
  const image = { ...layer, id: "photo", type: "image", image: "/old.png" };
  const view = render(
    <div className="brochure-page">
      <PageArtwork
        campaign={{ pageArtworks: { cover: [image] } }}
        pageKey="cover"
        onChange={change}
      />
    </div>,
  );
  const input = view.getByLabelText("Replace page image") as HTMLInputElement;
  const picker = vi.spyOn(input, "click").mockImplementation(() => undefined);
  fireEvent.doubleClick(view.getByAltText("Page artwork"));
  expect(picker).toHaveBeenCalledTimes(1);
  const file = new File(
    ['<svg xmlns="http://www.w3.org/2000/svg" />'],
    "replacement.svg",
    { type: "image/svg+xml" },
  );
  const item = view.container.querySelector(".brochure-floating-artwork")!;
  fireEvent.drop(item, { dataTransfer: { files: [file], types: ["Files"] } });
  await waitFor(() => expect(change).toHaveBeenCalledTimes(1));
  expect(change.mock.calls[0]?.[0]).toBe("photo");
  expect(change.mock.calls[0]?.[1]).toMatchObject({
    x: 10,
    y: 20,
    width: 30,
    height: 10,
  });
  expect(change.mock.calls[0]?.[1]?.image).toBe("/uploaded/replacement.svg");
});
