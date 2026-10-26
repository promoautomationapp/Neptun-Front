import { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StoreLocationsList } from "../../src/features/settings/StoreLocationsList";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import type { WorkspaceSettings } from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";

let current: WorkspaceSettings;
beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal(
    "PointerEvent",
    class extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId || 1;
      }
    },
  );
  vi.stubGlobal("scrollBy", vi.fn());
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      const index = this.matches(".ns-location")
        ? [...this.parentElement!.children].indexOf(this)
        : 0;
      const height = this.matches(".ns-location-list")
        ? this.children.length * 100
        : 100;
      return {
        left: 0,
        right: 600,
        top: index * 100,
        bottom: index * 100 + height,
        width: 600,
        height,
        x: 0,
        y: index * 100,
        toJSON: () => ({}),
      };
    },
  );
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function fixture() {
  const initial = resolveSettings(null);
  initial.stores = [
    {
      id: "one",
      name: "Central Park",
      city: "Prishtinë",
      address: "Address one",
      phone: "111",
      visible: false,
      extra: "preserved",
    },
    {
      id: "two",
      name: "Royal Mall",
      city: "Prishtinë",
      address: "Address two",
      phone: "222",
      visible: true,
    },
    {
      id: "three",
      name: "Peja",
      city: "Pejë",
      address: "Address three",
      phone: "333",
      visible: true,
    },
  ];
  function Harness() {
    const [draft, setDraft] = useState(initial);
    current = draft;
    return (
      <StoreLocationsList
        draft={draft}
        update={(change) =>
          setDraft((old) => {
            const next = structuredClone(old);
            change(next);
            return next;
          })
        }
      />
    );
  }
  return render(<Harness />);
}
it("keeps addresses, handles, Edit/Delete and boundary-aware arrows visible without opening a section", () => {
  const view = fixture();
  expect(view.container.querySelector("details")).toBeNull();
  expect(view.getByText("Prishtinë · Address one")).toBeTruthy();
  expect(
    view
      .getByRole("button", { name: "Move Central Park up" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    view
      .getByRole("button", { name: "Move Peja down" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    view.getByRole("button", { name: "Edit location: Royal Mall" }),
  ).toBeTruthy();
  expect(
    view.getByRole("button", { name: "Delete location: Royal Mall" }),
  ).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Move Royal Mall up" }));
  expect(current.stores.map((store) => store.id)).toEqual([
    "two",
    "one",
    "three",
  ]);
  expect(current.stores[1]).toMatchObject({
    extra: "preserved",
    phone: "111",
    visible: false,
  });
  fireEvent.keyDown(
    view.getByRole("button", { name: "Drag to reorder: Royal Mall" }),
    { key: "End" },
  );
  expect(current.stores.map((store) => store.id)).toEqual([
    "one",
    "three",
    "two",
  ]);
});
it("moves whole rows by a mouse or touch handle and cancels gestures outside the list or on Escape", () => {
  const view = fixture();
  const handle = view.getByRole("button", {
    name: "Drag to reorder: Central Park",
  });
  const drag = (x: number, cancel = false) => {
    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 1,
      clientX: 20,
      clientY: 40,
      pointerType: "touch",
    });
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: x,
      clientY: 290,
      pointerType: "touch",
    });
    if (cancel) fireEvent.keyDown(handle, { key: "Escape" });
    fireEvent.pointerUp(handle, {
      pointerId: 1,
      clientX: x,
      clientY: 290,
      pointerType: "touch",
    });
  };
  drag(700);
  expect(current.stores.map((store) => store.id)).toEqual([
    "one",
    "two",
    "three",
  ]);
  drag(20, true);
  expect(current.stores.map((store) => store.id)).toEqual([
    "one",
    "two",
    "three",
  ]);
  drag(20);
  expect(current.stores.map((store) => store.id)).toEqual([
    "two",
    "three",
    "one",
  ]);
  expect(current.stores[2]).toMatchObject({
    extra: "preserved",
    visible: false,
    address: "Address one",
  });
});
it("edits and deletes the intended location after reordering, and restores the full row with Undo", () => {
  const view = fixture();
  fireEvent.click(view.getByRole("button", { name: "Move Royal Mall up" }));
  fireEvent.click(
    view.getByRole("button", { name: "Edit location: Royal Mall" }),
  );
  const name = view.getByRole("textbox", { name: "Store name" });
  expect(document.activeElement).toBe(name);
  fireEvent.change(name, { target: { value: "Royal Mall updated" } });
  fireEvent.change(view.getByRole("textbox", { name: "Phone" }), {
    target: { value: "444" },
  });
  fireEvent.click(
    view.getByRole("button", {
      name: "Close location editor: Royal Mall updated",
    }),
  );
  expect(view.queryByRole("textbox")).toBeNull();
  fireEvent.click(
    view.getByRole("button", { name: "Delete location: Central Park" }),
  );
  expect(current.stores.map((store) => store.id)).toEqual(["two", "three"]);
  fireEvent.click(view.getByRole("button", { name: "Undo" }));
  expect(current.stores.map((store) => store.id)).toEqual([
    "two",
    "one",
    "three",
  ]);
  expect(current.stores[0]).toMatchObject({
    name: "Royal Mall updated",
    phone: "444",
  });
  expect(current.stores[1]).toMatchObject({
    extra: "preserved",
    visible: false,
  });
});
it("adds an editable location with a stable identity and supports the Albanian controls", () => {
  setLanguage("sq");
  const view = fixture();
  fireEvent.click(view.getByRole("button", { name: "Shto lokacion" }));
  expect(current.stores).toHaveLength(4);
  expect(current.stores[3]).toMatchObject({
    name: "Lokacion i ri",
    visible: true,
  });
  expect(current.stores[3]!.id).toMatch(/^[\da-f-]{36}$/);
  fireEvent.change(view.getByRole("textbox", { name: "Emri i dyqanit" }), {
    target: { value: "New shop" },
  });
  expect(
    view
      .getByRole("button", { name: "Lëviz New shop poshtë" })
      .hasAttribute("disabled"),
  ).toBe(true);
});
