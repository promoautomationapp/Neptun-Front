import { useState } from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Product } from "../../src/domain/models";
import { Details } from "../../src/features/brochure/Modals";
import { setLanguage } from "../../src/features/brochure/i18n";
import { ProductDetailRows } from "../../src/features/brochure/ProductDetailRows";
import { savedDetailEntries } from "../../src/features/brochure/detailFacts";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
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
  fireEvent.keyDown(
    view.getByRole("button", { name: "Drag to reorder detail 1" }),
    { key: "ArrowDown" },
  );
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
  fireEvent.keyDown(
    view.getByRole("button", { name: "Drag to reorder detail 1" }),
    { key: "ArrowDown" },
  );
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

function compactEditor() {
  let current: Product = {
    code: "drag-details",
    name: "Product",
    brochureDetails: [
      { key: "power", text: "Power: 6W" },
      { key: "warranty", text: "2 VITE GARANCION" },
      { key: "battery", text: "Battery: 5000 mAh" },
    ],
    detailBlockStyles: { power: "filled" },
    detailBlockPlacements: { battery: { hidden: true } },
  };
  function Editor() {
    const [product, setProduct] = useState(current);
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
  return {
    view,
    product: () => current,
    keys: () => savedDetailEntries(current)?.map(([key]) => key),
  };
}

it("keeps rows compact until requested and reorders from the desktop drag grip without losing styles or hidden facts", () => {
  const editor = compactEditor(),
    view = editor.view;
  expect(view.queryByRole("textbox")).toBeNull();
  expect(view.container.querySelector(".cs-detail-row-style")).toBeNull();
  expect(view.queryByRole("button", { name: "Move up 1" })).toBeNull();
  const values = new Map<string, string>();
  const transfer = {
    types: [] as string[],
    effectAllowed: "",
    dropEffect: "",
    setData(type: string, data: string) {
      values.set(type, data);
      this.types.push(type);
    },
    getData(type: string) {
      return values.get(type) || "";
    },
  };
  const handle = view.getByRole("button", { name: "Drag to reorder detail 2" });
  fireEvent.dragStart(handle, { dataTransfer: transfer });
  const target = view.container.querySelector(
    '[data-detail-editor-key="power"]',
  )!;
  fireEvent.dragOver(target, { dataTransfer: transfer });
  expect(target.className).toContain("is-drop-target");
  fireEvent.drop(target, { dataTransfer: transfer });
  expect(editor.keys()).toEqual(["warranty", "power", "battery"]);
  expect(editor.product().warranty).toBe("2 VITE GARANCION");
  expect(editor.product().detailBlockStyles?.power).toBe("filled");
  expect(editor.product().detailBlockPlacements?.battery?.hidden).toBe(true);
  expect(view.getByRole("status").textContent).toBe(
    "Detail moved to position 1",
  );
  fireEvent.click(view.getByRole("button", { name: "Edit text 2" }));
  expect(view.getByRole("textbox", { name: "Detail value 2" })).toBeTruthy();
  expect(view.container.querySelector(".cs-detail-row-style")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Edit text 2" }));
  expect(view.queryByRole("textbox")).toBeNull();
});

it.each(["touch", "mouse"])(
  "reorders with a %s pointer grip and cancels a later gesture without saving it",
  (pointerType) => {
    vi.stubGlobal(
      "PointerEvent",
      class extends MouseEvent {
        pointerId: number;
        pointerType: string;
        constructor(type: string, init: PointerEventInit) {
          super(type, init);
          this.pointerId = init.pointerId || 0;
          this.pointerType = init.pointerType || "";
        }
      },
    );
    Object.defineProperty(Element.prototype, "setPointerCapture", {
      configurable: true,
      value: vi.fn(),
    });
    const editor = compactEditor(),
      view = editor.view;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const cards = [
          ...view.container.querySelectorAll("[data-detail-editor-key]"),
        ];
        const index = cards.indexOf(this);
        return DOMRect.fromRect({
          x: 0,
          y: index * 50,
          width: 400,
          height: 44,
        });
      },
    );
    let handle = view.getByRole("button", { name: "Drag to reorder detail 1" });
    fireEvent.pointerDown(handle, {
      pointerId: 7,
      pointerType,
      button: 0,
      clientY: 20,
    });
    fireEvent.pointerMove(handle, {
      pointerId: 7,
      pointerType,
      clientY: 120,
    });
    fireEvent.pointerUp(handle, {
      pointerId: 7,
      pointerType,
      clientY: 120,
    });
    expect(editor.keys()).toEqual(["warranty", "battery", "power"]);
    handle = view.getByRole("button", { name: "Drag to reorder detail 1" });
    fireEvent.pointerDown(handle, {
      pointerId: 8,
      pointerType,
      button: 0,
      clientY: 20,
    });
    fireEvent.pointerMove(handle, {
      pointerId: 8,
      pointerType,
      clientY: 120,
    });
    fireEvent.pointerCancel(handle, { pointerId: 8, pointerType });
    expect(editor.keys()).toEqual(["warranty", "battery", "power"]);
    expect(
      view.container.querySelector(".is-dragging, .is-drop-target"),
    ).toBeNull();
  },
);

it("edits available source wording inline, preserves it across reopening, and selects that exact edited text", () => {
  const original: Product = {
    code: "source-edit",
    name: "Conditioner",
    brochureDetails: [],
    specs: { Teknologjia: "Inverter" },
    excelSource: { row: 5, cells: { Përshkrimi: "Teknologjia: Inverter" } },
  };
  let current = original;
  function Editor() {
    const [product, setProduct] = useState(current);
    current = product;
    return (
      <ProductDetailRows
        product={product}
        entries={[]}
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
  fireEvent.click(view.getByRole("button", { name: "Edit source detail 1" }));
  let input = view.getByRole("textbox", { name: "Edit source detail 1" });
  expect((input as HTMLInputElement).value).toBe("Teknologjia: Inverter");
  fireEvent.change(input, {
    target: { value: "Teknologjia: Soft Wind Inverter" },
  });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(view.queryByRole("textbox")).toBeNull();
  expect(Object.values(current.brochureSourceDetailEdits || {})).toEqual([
    "Teknologjia: Soft Wind Inverter",
  ]);
  expect(current.specs).toEqual(original.specs);
  expect(current.excelSource).toEqual(original.excelSource);
  view.rerender(<Editor key="reopened" />);
  expect(
    view.getByRole("checkbox", { name: "Teknologjia: Soft Wind Inverter" }),
  ).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Edit source detail 1" }));
  input = view.getByRole("textbox", { name: "Edit source detail 1" });
  fireEvent.change(input, { target: { value: "Do not keep this" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(
    view.getByRole("checkbox", { name: "Teknologjia: Soft Wind Inverter" }),
  ).toBeTruthy();
  fireEvent.click(
    view.getByRole("checkbox", { name: "Teknologjia: Soft Wind Inverter" }),
  );
  expect(savedDetailEntries(current)?.[0]?.[1]).toBe(
    "Teknologjia: Soft Wind Inverter",
  );
  expect(view.container.querySelector(".cs-detail-source-options")).toBeNull();
});

it("selects the latest source input value even when the checkbox click blurs the editor", () => {
  let current: Product = {
    code: "source-draft",
    name: "Conditioner",
    brochureDetails: [],
    specs: { Technology: "Inverter" },
  };
  function Editor() {
    const [product, setProduct] = useState(current);
    current = product;
    return (
      <ProductDetailRows
        product={product}
        entries={[]}
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
  fireEvent.click(view.getByRole("button", { name: "Edit source detail 1" }));
  const input = view.getByRole("textbox", { name: "Edit source detail 1" });
  fireEvent.change(input, { target: { value: "Soft Wind" } });
  const checkbox = view.getByRole("checkbox", { name: "Technology: Inverter" });
  fireEvent.pointerDown(checkbox);
  fireEvent.blur(input);
  fireEvent.click(checkbox);
  expect(savedDetailEntries(current)?.[0]?.[1]).toBe("Soft Wind");
  expect(Object.values(current.brochureSourceDetailEdits || {})).toEqual([
    "Soft Wind",
  ]);
  expect(current.specs).toEqual({ Technology: "Inverter" });
});
