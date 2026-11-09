import { useState } from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import { Details } from "../../src/features/brochure/Modals";
import { setLanguage } from "../../src/features/brochure/i18n";
import { ProductDetailRows } from "../../src/features/brochure/ProductDetailRows";
import { savedDetailEntries } from "../../src/features/brochure/detailFacts";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);
it("keeps Excel iOS off by default, retains its source row, and lets the user tick it on", () => {
  function Editor() {
    const [product, setProduct] = useState<Product>({
      code: "iphone-ios",
      name: "IPHONE 17 PRO",
      brand: "APPLE",
      source: "import",
      brochureDetails: ["iOS: 26", "Memory: 256 GB"],
      specs: { iOS: "26" },
    });
    return (
      <Details
        product={product}
        canLoadCatalogPhotos={false}
        onClose={() => {}}
        onProductChange={(field, value) =>
          setProduct((previous) => ({
            ...previous,
            ...(typeof field === "object" ? field : { [field]: value }),
          }))
        }
      />
    );
  }
  const view = render(<Editor />);
  const preview = view.getByRole("region", { name: "Product preview" });
  const checkbox = view.getByRole("checkbox", {
    name: "Show iOS version in brochure",
  }) as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
  expect(preview.querySelector('[data-detail-key="0"]')).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Edit text 1" }));
  expect(
    (
      view.getByRole("textbox", {
        name: "Detail value 1",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("iOS: 26");
  fireEvent.click(checkbox);
  expect(preview.querySelector('[data-detail-key="0"]')?.textContent).toBe(
    "iOS 26",
  );
  fireEvent.click(checkbox);
  expect(preview.querySelector('[data-detail-key="0"]')).toBeNull();
  expect(preview.textContent).toContain("256 GB");
});
it("edits multiline details in the real preview and retains each block's identity when reordered", () => {
  function Editor() {
    const [product, setProduct] = useState<Product>({
      code: "P1",
      name: "My product",
      brand: "FUEGO",
      regular: 199,
      sale: 149,
      brochureDetails: [
        { key: "battery", text: "Battery 5000 mAh" },
        { key: "screen", text: "Screen AMOLED" },
      ],
      detailBlockStyles: { battery: "filled", screen: "outline" },
    });
    return (
      <Details
        product={product}
        canLoadCatalogPhotos={false}
        onClose={() => {}}
        onProductChange={(field, value) =>
          setProduct((previous) => ({
            ...previous,
            ...(typeof field === "object" ? field : { [field]: value }),
          }))
        }
      />
    );
  }
  const view = render(<Editor />);
  const preview = view.getByRole("region", { name: "Product preview" });
  fireEvent.click(view.getByRole("button", { name: "Edit text 1" }));
  fireEvent.change(view.getByRole("textbox", { name: "Detail value 1" }), {
    target: { value: "Battery\n6000 mAh" },
  });
  expect(preview.textContent).toContain("6000 mAh");
  fireEvent.click(view.getByRole("button", { name: "Move down 1" }));
  fireEvent.click(view.getByRole("button", { name: "Edit text 1" }));
  expect(
    (
      view.getByRole("textbox", {
        name: "Detail value 1",
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("Screen AMOLED");
  expect(
    preview.querySelector('[data-detail-key="battery"]')?.className,
  ).toContain("detail-style-filled");
  fireEvent.click(view.getByRole("button", { name: "Remove detail screen" }));
  expect(within(preview).queryByText("Screen AMOLED")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Add detail block" }));
  fireEvent.change(view.getByRole("textbox", { name: "Detail value 2" }), {
    target: { value: "New feature" },
  });
  expect(preview.textContent).toContain("New feature");
});

it("keeps hidden rows in place and adds source facts without losing the original catalog or Excel data", () => {
  const original: Product = {
    code: "facts",
    name: "Product",
    brochureDetails: [
      { key: "power", text: "Power: 6W" },
      { key: "battery", text: "Battery: 5000 mAh" },
    ],
    specs: { Bluetooth: "v5.4" },
    excelSource: { row: 8, cells: { Përshkrimi: "Energy class: A++" } },
  };
  let current = original;
  function Editor() {
    const [product, setProduct] = useState(original);
    current = product;
    return (
      <ProductDetailRows
        product={product}
        entries={savedDetailEntries(product) || []}
        onChange={(field, value) =>
          setProduct((old) => ({
            ...old,
            ...(typeof field === "object" ? field : { [field]: value }),
          }))
        }
      />
    );
  }
  const view = render(<Editor />);
  expect(view.queryByRole("textbox")).toBeNull();
  fireEvent.click(
    view.getByRole("checkbox", { name: "Show detail in brochure 1" }),
  );
  expect(current.detailBlockPlacements?.power?.hidden).toBe(true);
  expect(current.brochureDetails).toEqual(original.brochureDetails);
  fireEvent.click(view.getByRole("button", { name: "Move down 1" }));
  expect(savedDetailEntries(current)?.map(([key]) => key)).toEqual([
    "battery",
    "power",
  ]);
  expect(
    (
      view.getByRole("checkbox", {
        name: "Show detail in brochure 2",
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
  const source = view.container.querySelector(".cs-detail-source-options")!;
  fireEvent.click(
    within(source as HTMLElement).getByLabelText("Bluetooth: v5.4"),
  );
  expect(savedDetailEntries(current)?.at(-1)?.[1]).toBe("Bluetooth: v5.4");
  expect(current.specs).toEqual(original.specs);
  expect(current.excelSource).toEqual(original.excelSource);
  expect(current.autoSpecsDisabled).toBe(true);
});
