import React from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Button, Modal } from "../../src/features/brochure/Modals";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(cleanup);

it("keeps the dialog title and final actions outside its scrolling content", () => {
  setLanguage("en");
  const save = vi.fn();
  const view = render(
    <Modal title="A long form" onClose={() => {}}>
      <label>
        Campaign name
        <input defaultValue="October" />
      </label>
      <p>Form content</p>
      <div className="cs-modal-actions">
        <Button onClick={save}>Save campaign</Button>
      </div>
    </Modal>,
  );
  const dialog = view.getByRole("dialog", { name: "A long form" });
  const body = dialog.querySelector(".cs-modal-body")!;
  expect(
    within(body as HTMLElement).getByLabelText("Campaign name"),
  ).toBeTruthy();
  expect(within(body as HTMLElement).queryByRole("heading")).toBeNull();
  expect(
    within(body as HTMLElement).queryByRole("button", {
      name: "Save campaign",
    }),
  ).toBeNull();
  expect(
    dialog
      .querySelector(".cs-modal-footer")
      ?.contains(view.getByRole("button", { name: "Save campaign" })),
  ).toBe(true);
  fireEvent.click(view.getByRole("button", { name: "Save campaign" }));
  expect(save).toHaveBeenCalledOnce();
});

it("only dismisses the topmost dialog and honors a consumed Escape key", () => {
  const outer = vi.fn(),
    inner = vi.fn();
  const view = render(
    <>
      <Modal title="Outer" onClose={outer}>
        <p>First</p>
      </Modal>
      <Modal title="Inner" onClose={inner}>
        <p>Second</p>
      </Modal>
    </>,
  );
  const consumed = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  consumed.preventDefault();
  document.dispatchEvent(consumed);
  expect(inner).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(inner).toHaveBeenCalledOnce();
  expect(outer).not.toHaveBeenCalled();
  fireEvent.mouseDown(view.getByRole("dialog", { name: "Inner" }));
  expect(inner).toHaveBeenCalledOnce();
});

it("supports a dialog without a footer and an optional hidden action row", () => {
  const view = render(
    <Modal title="Information" onClose={() => {}}>
      <p>Product information</p>
      {null}
    </Modal>,
  );
  expect(view.getByText("Product information")).toBeTruthy();
  expect(view.container.querySelector(".cs-modal-footer")).toBeNull();
});
