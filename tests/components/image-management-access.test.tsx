import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CoverElement } from "../../src/features/brochure/CoverElement";
import { PageArtwork } from "../../src/features/brochure/PageArtwork";
import {
  ImagePickerProvider,
  useImagePicker,
} from "../../src/features/brochure/ImagePickerProvider";
import { setLanguage, t } from "../../src/features/brochure/i18n";
import { resolveSettings } from "../../src/features/settings/settings.schema";

const placement = { x: 8, y: 12, width: 35, height: 20 };
const pageImage = {
  id: "extra",
  type: "image",
  name: "Extra photo",
  image: "/extra.png",
  ...placement,
  zIndex: 6,
};
const settings = resolveSettings(null);
settings.logoLibrary = [
  { id: "saved", name: "Saved photo", url: "/saved.png" },
];

function Cover({
  onSelect = vi.fn(),
  onChange = vi.fn(),
  onReplaceFile = vi.fn(),
}) {
  const chooseImage = useImagePicker();
  return (
    <CoverElement
      campaign={{}}
      kind="campaign-photo"
      defaultPlacement={placement}
      onChange={onChange}
      onReplaceFile={onReplaceFile}
      onChooseImage={() =>
        chooseImage?.({
          source: "/cover.png",
          title: t("Manage image"),
          kind: "image",
          onSelect,
        })
      }
    >
      <img src="/cover.png" alt="Cover photograph" />
    </CoverElement>
  );
}

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

it("keeps the cover image selected after one click and opens the shared manager only from Manage image", () => {
  const select = vi.fn(),
    replaceFile = vi.fn();
  const nativePicker = vi.spyOn(HTMLInputElement.prototype, "click");
  const view = render(
    <ImagePickerProvider settings={settings}>
      <div className="brochure-page">
        <Cover onSelect={select} onReplaceFile={replaceFile} />
      </div>
    </ImagePickerProvider>,
  );
  fireEvent.click(view.getByAltText("Cover photograph"));
  expect(
    view.container
      .querySelector(".cover-editable-element")
      ?.classList.contains("is-selected"),
  ).toBe(true);
  expect(view.queryByRole("dialog")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Manage image" }));
  expect(view.getByRole("dialog", { name: "Manage image" })).toBeTruthy();
  expect(nativePicker).not.toHaveBeenCalled();
  fireEvent.click(
    view.getByRole("button", { name: "Select image: Saved photo" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Use this image" }));
  expect(select).toHaveBeenCalledExactlyOnceWith("/saved.png");
  expect(replaceFile).not.toHaveBeenCalled();
});

it("lets a selected page image add a separate layer through the same manager without replacing itself", () => {
  const change = vi.fn(),
    add = vi.fn();
  const view = render(
    <ImagePickerProvider settings={settings} onAddLayer={add}>
      <div className="brochure-page">
        <PageArtwork
          campaign={{ pageArtworks: { cover: [pageImage] } }}
          pageKey="cover"
          onChange={change}
        />
      </div>
    </ImagePickerProvider>,
  );
  fireEvent.click(view.getByAltText("Extra photo"));
  expect(
    view.container
      .querySelector(".brochure-floating-artwork")
      ?.classList.contains("is-selected"),
  ).toBe(true);
  expect(view.queryByRole("dialog")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Manage image" }));
  fireEvent.click(
    view.getByRole("button", { name: "Select image: Saved photo" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Add as new layer" }));
  expect(add).toHaveBeenCalledExactlyOnceWith("/saved.png");
  expect(change).not.toHaveBeenCalled();
  expect(view.getByAltText("Extra photo").getAttribute("src")).toBe(
    "/extra.png",
  );
});

it("allows keyboard focus to reveal image management and clears cover selection when another area is chosen", () => {
  const view = render(
    <ImagePickerProvider settings={settings}>
      <div className="brochure-page">
        <Cover />
        <button>Other area</button>
      </div>
    </ImagePickerProvider>,
  );
  const cover = view.container.querySelector<HTMLElement>(
    ".cover-editable-element",
  )!;
  expect(cover.tabIndex).toBe(0);
  fireEvent.focus(cover);
  expect(cover.classList.contains("is-selected")).toBe(true);
  fireEvent.pointerDown(view.getByRole("button", { name: "Other area" }));
  expect(cover.classList.contains("is-selected")).toBe(false);
});

for (const kind of ["cover", "page"] as const) {
  it(`preserves ${kind} image dragging without opening a manager or native file picker`, () => {
    const change = vi.fn();
    const nativePicker = vi.spyOn(HTMLInputElement.prototype, "click");
    const view = render(
      <ImagePickerProvider settings={settings}>
        <div className="brochure-page">
          {kind === "cover" ? (
            <Cover onChange={change} />
          ) : (
            <PageArtwork
              campaign={{ pageArtworks: { cover: [pageImage] } }}
              pageKey="cover"
              onChange={change}
            />
          )}
        </div>
      </ImagePickerProvider>,
    );
    const element = view.container.querySelector<HTMLElement>(
      kind === "cover"
        ? ".cover-editable-element"
        : ".brochure-floating-artwork",
    )!;
    fireEvent.pointerDown(element, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 154,
      clientY: 154,
    });
    fireEvent.pointerUp(element, { pointerId: 1, clientX: 154, clientY: 154 });
    fireEvent.click(element);
    expect(change).toHaveBeenCalledOnce();
    expect(view.queryByRole("dialog")).toBeNull();
    expect(nativePicker).not.toHaveBeenCalled();
  });
}

it("uses the Albanian management label and keeps preview images free of editing controls", () => {
  setLanguage("sq");
  const view = render(
    <ImagePickerProvider settings={settings}>
      <div className="brochure-page">
        <Cover />
      </div>
    </ImagePickerProvider>,
  );
  fireEvent.click(view.getByAltText("Cover photograph"));
  fireEvent.click(view.getByRole("button", { name: "Menaxho imazhin" }));
  expect(view.getByRole("dialog", { name: "Menaxho imazhin" })).toBeTruthy();
  view.unmount();
  const preview = render(
    <div className="brochure-page">
      <CoverElement campaign={{}} kind="campaign-photo">
        <img src="/cover.png" alt="Preview" />
      </CoverElement>
      <PageArtwork
        campaign={{ pageArtworks: { cover: [pageImage] } }}
        pageKey="cover"
      />
    </div>,
  );
  expect(preview.queryByRole("button", { name: "Menaxho imazhin" })).toBeNull();
  expect(preview.container.querySelectorAll('[tabindex="0"]')).toHaveLength(0);
});
