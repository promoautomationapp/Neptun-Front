import React, { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { SearchableSelect } from "../../src/components/SearchableSelect";
import { Field } from "../../src/features/settings/components";

import { setLanguage } from "../../src/features/brochure/i18n";
beforeEach(() => setLanguage("en"));
afterEach(cleanup);

it("searches custom grouped options accent-insensitively and emits an actual select event", () => {
  const change = vi.fn();
  function Fixture() {
    const [value, setValue] = useState("all");
    return (
      <Field label="Store">
        <SearchableSelect
          value={value}
          onChange={(event) => {
            change(event.target.value, event.target.tagName);
            setValue(event.target.value);
          }}
        >
          <option value="all">All stores</option>
          <optgroup label="Kosovo">
            <option value="peje">Pejë</option>
            <option value="prishtine">Prishtinë</option>
          </optgroup>
        </SearchableSelect>
      </Field>
    );
  }
  const view = render(<Fixture />);
  const trigger = view.getByRole("combobox", { name: "Store" });
  fireEvent.click(trigger);
  fireEvent.change(view.getByRole("searchbox", { name: "Search options" }), {
    target: { value: "peje" },
  });
  expect(view.queryByRole("option", { name: "Prishtinë" })).toBeNull();
  fireEvent.click(view.getByRole("option", { name: "Pejë" }));
  expect(change).toHaveBeenCalledWith("peje", "SELECT");
  expect(trigger.textContent).toContain("Pejë");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

it("supports keyboard navigation, disabled option groups and escape focus return", async () => {
  const change = vi.fn();
  const view = render(
    <SearchableSelect
      aria-label="Format"
      value="a"
      onChange={(event) => change(event.target.value)}
    >
      <option value="a">First</option>
      <optgroup label="Disabled group" disabled>
        <option value="b">Unavailable</option>
      </optgroup>
      <option value="c">Last</option>
    </SearchableSelect>,
  );
  const trigger = view.getByRole("combobox", { name: "Format" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  const input = view.getByRole("searchbox", { name: "Search options" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(document.activeElement).toBe(
    view.getByRole("option", { name: "First" }),
  );
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(
    view.getByRole("option", { name: "Last" }),
  );
  fireEvent.click(view.getByRole("option", { name: "Last" }));
  expect(change).toHaveBeenCalledWith("c");
  fireEvent.click(trigger);
  fireEvent.keyDown(view.getByRole("searchbox"), { key: "Escape" });
  await waitFor(() => expect(document.activeElement).toBe(trigger));
  expect(view.queryByRole("listbox")).toBeNull();
});

it("respects ancestor fieldset disabling including an already open portal", async () => {
  const change = vi.fn();
  function Fixture() {
    const [blocked, setBlocked] = useState(false);
    return (
      <>
        <button onClick={() => setBlocked(true)}>Save</button>
        <fieldset disabled={blocked}>
          <Field label="Price style">
            <SearchableSelect value="current" onChange={change}>
              <option value="current">Current</option>
              <option value="card">Card</option>
            </SearchableSelect>
          </Field>
        </fieldset>
      </>
    );
  }
  const view = render(<Fixture />);
  const trigger = view.getByRole("combobox", { name: "Price style" });
  fireEvent.click(trigger);
  expect(view.getByRole("option", { name: "Card" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(view.queryByRole("listbox")).toBeNull());
  expect(trigger.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(trigger);
  expect(view.queryByRole("listbox")).toBeNull();
  expect(change).not.toHaveBeenCalled();
});

it("keeps a native form value and safely dismisses without selecting", () => {
  const view = render(
    <form>
      <SearchableSelect name="layout" aria-label="Layout" defaultValue="six">
        <option value="six">Six offers</option>
        <option value="four">Four offers</option>
      </SearchableSelect>
      <button type="button">Outside</button>
    </form>,
  );
  fireEvent.click(view.getByRole("combobox", { name: "Layout" }));
  fireEvent.pointerDown(view.getByRole("button", { name: "Outside" }));
  expect(view.queryByRole("listbox")).toBeNull();
  expect(
    new FormData(view.container.querySelector("form")!).get("layout"),
  ).toBe("six");
});

it("chooses the first search result with Enter, keeps modal Escape local and localizes empty results", () => {
  setLanguage("sq");
  const close = vi.fn(),
    change = vi.fn();
  document.addEventListener("keydown", close);
  const view = render(
    <SearchableSelect
      aria-label="Dyqani"
      value="peje"
      onChange={(event) => change(event.target.value)}
    >
      <option value="peje">Pejë</option>
      <option value="prishtine">Prishtinë</option>
    </SearchableSelect>,
  );
  fireEvent.click(view.getByRole("combobox", { name: "Dyqani" }));
  const search = view.getByRole("searchbox", { name: "Kërko në opsione" });
  expect(search.getAttribute("placeholder")).toBe("Kërko në opsione…");
  fireEvent.change(search, { target: { value: "missing" } });
  expect(view.getByText("Nuk u gjet asnjë përputhje")).toBeTruthy();
  fireEvent.change(search, { target: { value: "prishtine" } });
  fireEvent.keyDown(search, { key: "Enter" });
  expect(change).toHaveBeenCalledWith("prishtine");
  fireEvent.click(view.getByRole("combobox", { name: "Dyqani" }));
  close.mockClear();
  fireEvent.keyDown(view.getByRole("searchbox"), { key: "Escape" });
  expect(close).not.toHaveBeenCalled();
  document.removeEventListener("keydown", close);
});
it("restores uncontrolled defaults on form reset and retains an externally controlled value", async () => {
  const view = render(
    <form>
      <SearchableSelect name="one" aria-label="Uncontrolled" defaultValue="a">
        <option value="a">A</option>
        <option value="b">B</option>
      </SearchableSelect>
      <SearchableSelect name="two" aria-label="Controlled" value="b">
        <option value="a">A</option>
        <option value="b">B</option>
      </SearchableSelect>
    </form>,
  );
  fireEvent.click(view.getByRole("combobox", { name: "Uncontrolled" }));
  fireEvent.click(view.getByRole("option", { name: "B" }));
  expect(new FormData(view.container.querySelector("form")!).get("one")).toBe(
    "b",
  );
  fireEvent.reset(view.container.querySelector("form")!);
  await waitFor(() =>
    expect(
      view.getByRole("combobox", { name: "Uncontrolled" }).textContent,
    ).toContain("A"),
  );
  expect(new FormData(view.container.querySelector("form")!).get("one")).toBe(
    "a",
  );
  expect(new FormData(view.container.querySelector("form")!).get("two")).toBe(
    "b",
  );
});
