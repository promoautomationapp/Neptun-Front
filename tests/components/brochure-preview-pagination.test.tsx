import React, { useState } from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { BrochurePreview } from "../../src/features/brochure/BrochurePreview";
import { setLanguage } from "../../src/features/brochure/i18n";

vi.mock("../../src/features/brochure/Brochure", () => ({
  splitPages: () => [
    { index: 0, products: [] },
    { index: 1, products: [] },
  ],
  CoverPage: () => <article data-testid="preview-cover">Cover artwork</article>,
  ProductPage: ({ page }: { page: { index: number } }) => (
    <article data-testid={`preview-product-${page.index}`}>
      Product artwork {page.index}
    </article>
  ),
  StoresPage: () => (
    <article data-testid="preview-stores">Stores artwork</article>
  ),
}));

beforeEach(() => {
  setLanguage("en");
  if (Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close"))
    vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fixture(includeStoresPage = false, initialPage = -1) {
  const onExport = vi.fn();
  const campaign: Campaign = {
    id: "preview-navigation",
    name: "Offers",
    products: [],
    includeStoresPage,
  };
  function Preview() {
    const [selected, setSelected] = useState(initialPage);
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open preview
        </button>
        {open && (
          <BrochurePreview
            campaign={campaign}
            settings={{ stores: [], contact: {} }}
            selected={selected}
            onSelect={setSelected}
            onClose={() => setOpen(false)}
            onExport={onExport}
          />
        )}
      </>
    );
  }
  const view = render(<Preview />);
  const trigger = view.getByRole("button", { name: "Open preview" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = view.getByRole("dialog", { name: "Brochure preview" });
  const stage = () =>
    dialog.querySelector<HTMLElement>(".cs-preview-dialog-paper")!;
  return { ...view, dialog, stage, trigger, onExport };
}

it("uses the shared header pager without a bottom footer to browse included pages and export the selected page", () => {
  const view = fixture();
  const preview = within(view.dialog);
  const header = view.dialog.querySelector<HTMLElement>(
    ".cs-preview-dialog-header",
  )!;
  const navigation = within(header).getByRole("navigation", {
    name: "Page navigation",
  });
  const picker = within(navigation).getByRole("combobox", {
    name: "Go to page",
  });
  expect(view.dialog.querySelector(".cs-preview-dialog-footer")).toBeNull();
  expect(view.stage().querySelector(".cs-brochure-pagination")).toBeNull();
  expect(within(picker).getAllByRole("option")).toHaveLength(3);
  expect(preview.queryByRole("option", { name: /Stores/ })).toBeNull();
  expect(preview.getByRole("button", { name: "Previous page" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(within(view.stage()).getByTestId("preview-cover")).toBeTruthy();
  fireEvent.click(preview.getByRole("button", { name: "Next page" }));
  expect(within(view.stage()).getByTestId("preview-product-0")).toBeTruthy();
  fireEvent.change(picker, { target: { value: "1" } });
  expect(within(view.stage()).getByTestId("preview-product-1")).toBeTruthy();
  expect(preview.getByRole("button", { name: "Next page" })).toHaveProperty(
    "disabled",
    true,
  );
  fireEvent.click(preview.getByRole("button", { name: /Download brochure/ }));
  expect(view.onExport).toHaveBeenCalledWith(2);
  expect(view.queryByRole("dialog", { name: "Brochure preview" })).toBeNull();
  expect(document.activeElement).toBe(view.trigger);
});

it("includes stores when enabled and keeps keyboard shortcuts out of editable controls", () => {
  const view = fixture(true);
  const preview = within(view.dialog);
  const picker = preview.getByRole("combobox", { name: "Go to page" });
  expect(within(picker).getAllByRole("option")).toHaveLength(4);
  fireEvent.keyDown(view.dialog, { key: "End" });
  expect(within(view.stage()).getByTestId("preview-stores")).toBeTruthy();
  fireEvent.keyDown(picker, { key: "ArrowLeft" });
  expect(within(view.stage()).getByTestId("preview-stores")).toBeTruthy();

  const text = document.createElement("span");
  text.setAttribute("contenteditable", "true");
  view.dialog.append(text);
  fireEvent.keyDown(text, { key: "Home" });
  expect(within(view.stage()).getByTestId("preview-stores")).toBeTruthy();
  text.remove();
  fireEvent.keyDown(view.dialog, { key: "ArrowLeft" });
  expect(within(view.stage()).getByTestId("preview-product-1")).toBeTruthy();
  fireEvent.keyDown(view.dialog, { key: "Home" });
  expect(within(view.stage()).getByTestId("preview-cover")).toBeTruthy();
  fireEvent.click(preview.getByRole("button", { name: "Back to editing" }));
  expect(document.activeElement).toBe(view.trigger);
});

it("clamps an excluded stores selection to the last actual brochure page", () => {
  const view = fixture(false, 2);
  expect(within(view.stage()).getByTestId("preview-product-1")).toBeTruthy();
  expect(
    within(view.dialog).getByRole("button", { name: "Next page" }),
  ).toHaveProperty("disabled", true);
});
