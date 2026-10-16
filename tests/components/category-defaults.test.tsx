import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsEditor } from "../../src/features/settings/SettingsEditor";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { openSettingsTab, selectSetting } from "../helpers/settings-sections";

const facets = [
  {
    category: "IT",
    subcategory: "AKSESORË",
    categoryPath: "IT > KOMPJUTERË > AKSESORË",
  },
  {
    category: "IT",
    subcategory: "LAPTOP",
    categoryPath: "IT > KOMPJUTERË > LAPTOP",
  },
  {
    category: "TELEFONIA",
    subcategory: "KABLLO",
    categoryPath: "TELEFONIA > KABLLO",
  },
];
afterEach(cleanup);
function setup() {
  const initial = resolveSettings(null);
  initial.categoryPathSavingModes.IT = "percentage";
  const save = vi.fn(async (value) => value);
  const view = render(
    <SettingsEditor initial={initial} onSave={save} facets={facets} />,
  );
  openSettingsTab(view, "Category defaults");
  return { view, save };
}
it("starts with main categories and opens only the selected branch at each level", () => {
  const { view } = setup();
  expect(view.getAllByRole("treeitem")).toHaveLength(2);
  fireEvent.click(view.getByRole("treeitem", { name: /^IT$/ }));
  expect(
    view
      .getByRole("treeitem", { name: /KOMPJUTERË/ })
      .getAttribute("aria-expanded"),
  ).toBe("false");
  expect(view.queryByRole("treeitem", { name: /AKSESORË/ })).toBeNull();
  fireEvent.click(view.getByRole("treeitem", { name: /KOMPJUTERË/ }));
  expect(
    view.getByRole("treeitem", { name: /AKSESORË/ }).getAttribute("aria-level"),
  ).toBe("3");
  fireEvent.click(view.getByRole("treeitem", { name: /^IT$/ }));
  expect(view.getAllByRole("treeitem")).toHaveLength(2);
  expect(view.getByRole("region").textContent).toContain("IT savings default");
});
it("finds deep categories with accent-insensitive search and supports branch keyboard navigation", () => {
  const { view } = setup();
  fireEvent.change(view.getByLabelText("Find category or subcategory"), {
    target: { value: "aksesore" },
  });
  expect(view.getAllByRole("treeitem")).toHaveLength(3);
  expect(view.getByRole("treeitem", { name: /AKSESORË/ })).toBeTruthy();
  fireEvent.change(view.getByLabelText("Find category or subcategory"), {
    target: { value: "" },
  });
  const root = view.getByRole("treeitem", { name: /^IT$/ });
  fireEvent.keyDown(root, { key: "ArrowRight" });
  expect(root.getAttribute("aria-expanded")).toBe("true");
  fireEvent.keyDown(root, { key: "ArrowRight" });
  const child = view.getByRole("treeitem", { name: /KOMPJUTERË/ });
  expect(document.activeElement).toBe(child);
  fireEvent.keyDown(child, { key: "ArrowLeft" });
  expect(document.activeElement).toBe(root);
  fireEvent.click(view.getByRole("button", { name: "Collapse all" }));
  expect(view.getAllByRole("treeitem")).toHaveLength(2);
});
it("keeps automatic percentage savings enabled and saves overrides at the exact category depth", async () => {
  const { view, save } = setup();
  fireEvent.click(view.getByRole("treeitem", { name: /^IT$/ }));
  fireEvent.click(view.getByRole("treeitem", { name: /KOMPJUTERË/ }));
  fireEvent.click(view.getByRole("treeitem", { name: /AKSESORË/ }));
  selectSetting(view, "IT / KOMPJUTERË / AKSESORË savings default", "amount");
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  expect(save.mock.calls[0]?.[0].automaticSavings).toEqual({
    enabled: true,
    amountThreshold: 50,
  });
  expect(save.mock.calls[0]?.[0].categoryPathSavingModes).toEqual({
    IT: "percentage",
    "IT > KOMPJUTERË > AKSESORË": "amount",
  });
});
