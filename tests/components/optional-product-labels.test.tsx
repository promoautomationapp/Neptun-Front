import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useState } from "react";
import type { Product } from "../../src/domain/models";
import { ProductArtworkControls } from "../../src/features/brochure/ProductArtworkControls";
import { ProductArtworkLayer } from "../../src/features/brochure/ProductArtworkLayer";
import {
  inferredCapacityKg,
  optionalProductLabelChoices,
} from "../../src/features/brochure/optionalProductLabels";
vi.mock("../../src/features/brochure/i18n", () => ({
  t: (value: string) => value,
}));
afterEach(cleanup);
function Editor({ initial }: { initial: Product }) {
  const [product, setProduct] = useState(initial);
  return (
    <>
      <ProductArtworkControls
        product={product}
        onChange={(field, value) =>
          setProduct((previous) =>
            typeof field === "string"
              ? { ...previous, [field]: value }
              : { ...previous, ...field },
          )
        }
      />
      <ProductArtworkLayer product={product} />
    </>
  );
}
test("TV New model is off initially and creates independent editable/removable text and shape layers", () => {
  const view = render(
    <Editor
      initial={{ code: "tv", name: "TV LED Samsung 55", subcategory: "TV" }}
    />,
  );
  const checkbox = view.getByRole("checkbox", {
    name: "New model",
  }) as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
  expect(view.queryByText("MODEL I RI")).toBeNull();
  fireEvent.click(checkbox);
  expect(
    (view.getByRole("checkbox", { name: "New model" }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    view.container.querySelectorAll(".product-artwork-item svg"),
  ).toHaveLength(2);
  const text = view.getByLabelText("Label text");
  fireEvent.change(text, { target: { value: "MODEL I RI 2027" } });
  expect(view.getByText("MODEL I RI 2027")).toBeTruthy();
  expect(view.getAllByLabelText(/Width:/)).toHaveLength(2);
  fireEvent.click(
    view.getByRole("button", { name: "Remove artwork: MODEL I RI" }),
  );
  expect(view.queryByText("MODEL I RI 2027")).toBeNull();
  fireEvent.click(view.getByRole("checkbox", { name: "New model" }));
  expect(
    view.container.querySelectorAll(".product-artwork-item svg"),
  ).toHaveLength(0);
});
test("capacity is inferred only for laundry appliances, remains opt-in and can be corrected", () => {
  const view = render(
    <Editor
      initial={{
        code: "washer",
        name: "RROBAlARESE BEKO",
        specs: { Kapaciteti: "8 kg" },
      }}
    />,
  );
  expect(
    (view.getByRole("checkbox", { name: "Capacity (kg)" }) as HTMLInputElement)
      .checked,
  ).toBe(false);
  fireEvent.click(view.getByRole("checkbox", { name: "Capacity (kg)" }));
  expect(view.getByText("8 kg")).toBeTruthy();
  fireEvent.change(view.getByLabelText("Capacity value (kg)"), {
    target: { value: "9" },
  });
  expect(view.getByText("9 kg")).toBeTruthy();
});
test("unknown capacities need an explicit value and unrelated products expose no label toggles", () => {
  const view = render(
    <Editor
      initial={{
        code: "dryer",
        name: "THARESE BEKO",
        specs: { Pesha: "12 kg" },
      }}
    />,
  );
  expect(
    (view.getByRole("checkbox", { name: "Capacity (kg)" }) as HTMLInputElement)
      .disabled,
  ).toBe(true);
  expect(
    inferredCapacityKg({ name: "THARESE BEKO", specs: { Pesha: "12 kg" } }),
  ).toBe("");
  fireEvent.change(view.getByLabelText("Capacity value (kg)"), {
    target: { value: "7" },
  });
  expect(
    (view.getByRole("checkbox", { name: "Capacity (kg)" }) as HTMLInputElement)
      .disabled,
  ).toBe(false);
  expect(
    optionalProductLabelChoices({ name: "THARESE FLOKESH PHILIPS 8 KG" }),
  ).toEqual([]);
  expect(optionalProductLabelChoices({ name: "Laptop 16 GB" })).toEqual([]);
});
