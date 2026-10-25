import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { confirmDialog, promptDialog } from "../../src/components/dialogs";
import { Modal } from "../../src/components/Modal";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(async () => {
  // A failed assertion must not leave an imperative dialog in the next test.
  for (let attempt = 0; attempt < 8; attempt++) {
    const dialog = document.querySelector(".np-app-dialog");
    if (!dialog) break;
    await act(async () => {
      fireEvent(dialog, new Event("cancel", { cancelable: true }));
    });
  }
  cleanup();
  vi.restoreAllMocks();
});

it("confirms inside the app, makes the page inert, traps focus and restores its original state", async () => {
  const native = vi.spyOn(window, "confirm").mockReturnValue(false);
  const view = render(
    <>
      <button>Open action</button>
      <button>Outside</button>
    </>,
  );
  const trigger = view.getByRole("button", { name: "Open action" });
  trigger.focus();
  document.body.style.overflow = "auto";
  let result!: Promise<boolean>;
  act(() => {
    result = confirmDialog({
      title: "Delete saved design?",
      message: "Your brochure will keep its design.",
      confirmLabel: "Delete design",
      danger: true,
    });
  });
  const dialog = await screen.findByRole("dialog", {
    name: "Delete saved design?",
  });
  expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
  expect(view.container.hasAttribute("inert")).toBe(true);
  expect(document.body.style.overflow).toBe("hidden");
  const cancel = within(dialog).getByRole("button", { name: "Cancel" });
  expect(document.activeElement).toBe(cancel);
  const confirm = within(dialog).getByRole("button", { name: "Delete design" });
  confirm.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  const close = within(dialog).getByRole("button", { name: "Close" });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(confirm);
  view.getByRole("button", { name: "Outside" }).focus();
  expect(document.activeElement).toBe(cancel);
  await act(async () => {
    fireEvent.click(confirm);
    expect(await result).toBe(true);
  });
  expect(
    screen.queryByRole("dialog", { name: "Delete saved design?" }),
  ).toBeNull();
  expect(view.container.hasAttribute("inert")).toBe(false);
  expect(document.body.style.overflow).toBe("auto");
  expect(document.activeElement).toBe(trigger);
  expect(native).not.toHaveBeenCalled();
  document.body.style.overflow = "";
});

it("cancels only the application dialog on Escape and preserves pre-existing inert content", async () => {
  const outerClose = vi.fn();
  const view = render(
    <Modal title="Underlying form" onClose={outerClose}>
      <button>Continue editing</button>
    </Modal>,
  );
  const alreadyInert = document.createElement("section");
  alreadyInert.setAttribute("inert", "");
  document.body.append(alreadyInert);
  let result!: Promise<boolean>;
  act(() => {
    result = confirmDialog({
      title: "Leave this form?",
      message: "Unsaved edits are kept here.",
    });
  });
  await screen.findByRole("dialog", { name: "Leave this form?" });
  await act(async () => {
    fireEvent.keyDown(document, { key: "Escape" });
    expect(await result).toBe(false);
  });
  expect(outerClose).not.toHaveBeenCalled();
  expect(view.getByRole("dialog", { name: "Underlying form" })).toBeTruthy();
  expect(alreadyInert.hasAttribute("inert")).toBe(true);
  alreadyInert.remove();
});

it("queues overlapping requests and prompts without exposing sensitive values", async () => {
  const native = vi.spyOn(window, "prompt").mockReturnValue("native");
  let first!: Promise<boolean>, second!: Promise<string | null>;
  act(() => {
    first = confirmDialog({
      title: "First request",
      message: "Complete this request first.",
    });
    second = promptDialog({
      title: "Enter access key",
      message: "Used for this request only.",
      label: "Access key",
      initialValue: "initial-key",
      sensitive: true,
      confirmLabel: "Use key",
    });
  });
  const firstDialog = await screen.findByRole("dialog", {
    name: "First request",
  });
  expect(screen.queryByRole("dialog", { name: "Enter access key" })).toBeNull();
  await act(async () => {
    fireEvent.click(
      within(firstDialog).getByRole("button", { name: "Continue" }),
    );
    expect(await first).toBe(true);
  });
  const secondDialog = await screen.findByRole("dialog", {
    name: "Enter access key",
  });
  const input = within(secondDialog).getByLabelText(
    "Access key",
  ) as HTMLInputElement;
  expect(input.type).toBe("password");
  expect(input.value).toBe("initial-key");
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(input.value.length);
  fireEvent.change(input, { target: { value: "new-key" } });
  await act(async () => {
    fireEvent.submit(secondDialog.querySelector("form")!);
    expect(await second).toBe("new-key");
  });
  expect(document.querySelector(".np-dialog-host")).toBeNull();
  expect(document.body.textContent).not.toContain("new-key");
  expect(native).not.toHaveBeenCalled();
});

it("returns null when a prompt is cancelled and resolves translated default labels at display time", async () => {
  setLanguage("sq");
  let result!: Promise<string | null>;
  act(() => {
    result = promptDialog({
      title: "New design",
      message: "Choose a name.",
      initialValue: "Draft",
    });
  });
  const dialog = await screen.findByRole("dialog", { name: "New design" });
  expect(within(dialog).getByRole("button", { name: "Vazhdo" })).toBeTruthy();
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "Anulo" }));
    expect(await result).toBeNull();
  });
  await waitFor(() =>
    expect(document.querySelector(".np-dialog-host")).toBeNull(),
  );
});
