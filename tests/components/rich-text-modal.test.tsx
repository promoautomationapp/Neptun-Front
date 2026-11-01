import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../src/features/brochure/i18n";
import { RichTextModal } from "../../src/features/social/RichTextModal";

afterEach(() => {
  cleanup();
  setLanguage("en");
});

it("uses Albanian throughout the formatted text flow and saves the author's text unchanged", async () => {
  setLanguage("sq");
  const save = vi.fn();
  const close = vi.fn();
  const view = render(
    <RichTextModal
      html="<h2>Oferta për ju</h2><p>Emri im i produktit</p>"
      onSave={save}
      onClose={close}
    />,
  );
  expect(
    view.getByRole("dialog", {
      name: "Redakto tekstin e formatuar të postimit",
    }),
  ).toBeTruthy();
  expect(
    view.getByRole("heading", { name: "Shkruani mesazhin tuaj" }),
  ).toBeTruthy();
  expect(
    view.getByRole("toolbar", { name: "Formatimi i tekstit" }),
  ).toBeTruthy();
  await waitFor(() =>
    expect(
      view.getByRole("textbox", { name: "Teksti i postimit" }),
    ).toBeTruthy(),
  );
  expect(view.getByRole("button", { name: "Titulli 1" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Nënvizo" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Listë me pika" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Zhbëj" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Ribëj" })).toBeTruthy();
  expect(
    view.getByLabelText("Ngjyra e tekstit", { selector: "input" }),
  ).toBeTruthy();
  expect(view.getByLabelText("Ngarko imazh")).toBeTruthy();

  fireEvent.click(view.getByRole("button", { name: "Lidhje" }));
  const address = view.getByRole("textbox", { name: "Adresa e lidhjes" });
  fireEvent.change(address, {
    target: { value: "https://example.test/oferta" },
  });
  expect(view.getByRole("button", { name: "Shto lidhjen" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Hiq lidhjen" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Lidhje" }));
  fireEvent.click(view.getByRole("button", { name: "Zbato në postim" }));
  expect(save).toHaveBeenCalledWith(
    "<h2>Oferta për ju</h2><p>Emri im i produktit</p>",
  );
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Mbyll" }));
  expect(close).toHaveBeenCalledOnce();
});

it("keeps the English dialog and descriptive formatting labels in English", async () => {
  setLanguage("en");
  const view = render(
    <RichTextModal
      html="<p>My campaign</p>"
      onSave={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  expect(
    view.getByRole("dialog", { name: "Edit formatted post text" }),
  ).toBeTruthy();
  await waitFor(() =>
    expect(view.getByRole("textbox", { name: "Post text" })).toBeTruthy(),
  );
  expect(view.getByRole("button", { name: "Bold" }).textContent).toBe("B");
  expect(view.getByRole("button", { name: "Apply to post" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Cancel" })).toBeTruthy();
});
