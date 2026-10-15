import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CategoryTreeSelect } from "../../src/features/brochure/CategoryTreeSelect";
import { ManualPicker } from "../../src/features/brochure/Modals";
import { setLanguage } from "../../src/features/brochure/i18n";
const catalog = [
  {
    code: "one",
    name: "Computer cable",
    category: "Computers",
    subcategory: "USB C",
    categoryPath: "Home > Computers > Accessories > Cables > USB C",
    brand: "CableBrand",
    regular: 20,
  },
  {
    code: "two",
    name: "Audio cable",
    category: "Audio",
    subcategory: "USB C",
    categoryPath: "Audio > Accessories > Cables > USB C",
    brand: "AudioBrand",
    regular: 25,
  },
  {
    code: "three",
    name: "Computer adapter",
    category: "Computers",
    subcategory: "USB C",
    categoryPath: "Computers > Accessories > Adapters > USB C",
    brand: "AdapterBrand",
    regular: 30,
  },
  {
    code: "four",
    name: "Computer HDMI cable",
    category: "Computers",
    subcategory: "HDMI",
    categoryPath: "Computers > Accessories > Cables > HDMI",
    brand: "CableBrand",
    regular: 15,
  },
];
beforeEach(() => setLanguage("en"));
afterEach(() => cleanup());
it("lists all four levels with descendant counts and returns a complete unambiguous path", () => {
  const change = vi.fn(),
    path = vi.fn();
  const view = render(
    <CategoryTreeSelect
      catalog={catalog}
      category=""
      subcategory=""
      onChange={change}
      onPathChange={path}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Category & subcategory" }));
  expect(view.queryByRole("button", { name: /^Home/ })).toBeNull();
  expect(
    view.getByRole("button", { name: "Computers · 3 products" }),
  ).toBeTruthy();
  expect(
    view.queryByRole("button", {
      name: "Computers > Accessories · 3 products",
    }),
  ).toBeNull();
  fireEvent.click(
    view.getByRole("button", { name: "Show subcategories: Computers" }),
  );
  expect(change).not.toHaveBeenCalled();
  expect(path).not.toHaveBeenCalled();
  expect(
    view.getByRole("button", { name: "Computers > Accessories · 3 products" }),
  ).toBeTruthy();
  fireEvent.click(
    view.getByRole("button", {
      name: "Show subcategories: Computers > Accessories",
    }),
  );
  expect(
    view.getByRole("button", {
      name: "Computers > Accessories > Cables · 2 products",
    }),
  ).toBeTruthy();
  fireEvent.click(
    view.getByRole("button", {
      name: "Show subcategories: Computers > Accessories > Cables",
    }),
  );
  fireEvent.click(
    view.getByRole("button", {
      name: "Computers > Accessories > Cables > USB C · 1 products",
    }),
  );
  expect(change).toHaveBeenCalledWith("Computers", "USB C");
  expect(path).toHaveBeenCalledWith("Computers > Accessories > Cables > USB C");
  expect(view.queryByRole("dialog")).toBeNull();
});
it("searches case, accents and spacing while retaining each matching child's ancestors", () => {
  const view = render(
    <CategoryTreeSelect
      catalog={catalog}
      category=""
      subcategory=""
      onChange={vi.fn()}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Category & subcategory" }));
  fireEvent.change(view.getByRole("searchbox"), {
    target: { value: "  uSbC  " },
  });
  expect(
    view.getByRole("button", { name: "Computers · 3 products" }),
  ).toBeTruthy();
  expect(view.getByRole("button", { name: "Audio · 1 products" })).toBeTruthy();
  expect(
    view.getByRole("button", {
      name: "Computers > Accessories > Cables > USB C · 1 products",
    }),
  ).toBeTruthy();
  expect(
    view.getByRole("button", {
      name: "Audio > Accessories > Cables > USB C · 1 products",
    }),
  ).toBeTruthy();
  expect(view.queryByRole("button", { name: / > HDMI/ })).toBeNull();
});
it("preserves legacy two-level selection and keyboard dismissal", () => {
  const change = vi.fn();
  const view = render(
    <CategoryTreeSelect
      catalog={[
        {
          code: "phone",
          name: "Phone",
          category: "Mobile",
          subcategory: "Smartphones",
        },
      ]}
      category="Mobile"
      subcategory="Smartphones"
      onChange={change}
    />,
  );
  const trigger = view.getByRole("button", { name: "Category & subcategory" });
  fireEvent.click(trigger);
  const leaf = view.getByRole("button", {
    name: "Mobile > Smartphones · 1 products",
  });
  expect(leaf.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(leaf);
  expect(change).toHaveBeenCalledWith("Mobile", "Smartphones");
  fireEvent.click(trigger);
  fireEvent.keyDown(view.getByRole("searchbox"), { key: "Escape" });
  expect(view.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it("filters manual product and brand choices by full branch, including descendants without mixing identical leaves", () => {
  const view = render(
    <ManualPicker
      catalog={catalog}
      existing={[]}
      onApply={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Category & subcategory" }));
  fireEvent.change(
    view.getByRole("searchbox", {
      name: "Search categories or subcategories…",
    }),
    { target: { value: "USB C" } },
  );
  fireEvent.click(
    view.getByRole("button", {
      name: "Computers > Accessories > Cables > USB C · 1 products",
    }),
  );
  expect(view.getByText("Computer cable")).toBeTruthy();
  expect(view.queryByText("Audio cable")).toBeNull();
  expect(view.queryByText("Computer adapter")).toBeNull();
  expect(view.queryByText("Computer HDMI cable")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Brand" }));
  expect(view.getByRole("option", { name: "CableBrand" })).toBeTruthy();
  expect(view.queryByRole("option", { name: "AdapterBrand" })).toBeNull();
  fireEvent.keyDown(view.getByRole("searchbox", { name: "Search Brand" }), {
    key: "Escape",
  });
  fireEvent.click(view.container.querySelector(".cs-category-trigger")!);
  fireEvent.click(
    view.getByRole("button", {
      name: "Computers > Accessories > Cables · 2 products",
    }),
  );
  expect(view.getByText("Computer cable")).toBeTruthy();
  expect(view.getByText("Computer HDMI cable")).toBeTruthy();
  expect(view.queryByText("Computer adapter")).toBeNull();
});
