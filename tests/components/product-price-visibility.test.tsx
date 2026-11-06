import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { ProductPriceEditor } from "../../src/features/brochure/ProductPriceEditor";
import { setLanguage } from "../../src/features/brochure/i18n";

const product: Product = {
  code: "TV-1",
  name: "Beko television",
  brand: "Beko",
  regular: 399,
  sale: 299,
};
const campaign: Campaign = { id: "prices", name: "Offers", products: [product] };

afterEach(() => {
  cleanup();
  setLanguage("sq");
});

function openEditor(item: Product) {
  const save = vi.fn();
  const close = vi.fn();
  const view = render(
    <ProductPriceEditor
      product={item}
      campaign={campaign}
      onSave={save}
      onClose={close}
    />,
  );
  return { view, save, close };
}

it("hides and restores a badge without losing its position, size, other regions or price settings", () => {
  setLanguage("en");
  const positioned: Product = {
    ...product,
    savingMode: "percentage",
    brochureContentPlacement: {
      saving: { x: 3, y: -2, width: 18, scale: 1.2 },
      price: { x: -1, y: 2, width: 40 },
    },
  };
  const original = structuredClone(positioned);
  const hidden = openEditor(positioned);
  const checkbox = hidden.view.getByRole("checkbox", {
    name: "Show savings badge",
  }) as HTMLInputElement;
  expect(checkbox.checked).toBe(true);
  fireEvent.click(checkbox);
  fireEvent.click(hidden.view.getByRole("button", { name: "Save price" }));
  expect(hidden.close).toHaveBeenCalledOnce();
  const changes = hidden.save.mock.calls[0]![0] as Partial<Product>;
  expect(changes).toMatchObject({
    regular: 399,
    sale: 299,
    savingMode: "percentage",
    brochureContentPlacement: {
      saving: { x: 3, y: -2, width: 18, scale: 1.2, hidden: true },
      price: { x: -1, y: 2, width: 40 },
    },
  });
  expect(positioned).toEqual(original);
  hidden.view.unmount();

  const restored = openEditor({ ...positioned, ...changes });
  const restoreCheckbox = restored.view.getByRole("checkbox", {
    name: "Show savings badge",
  }) as HTMLInputElement;
  expect(restoreCheckbox.checked).toBe(false);
  fireEvent.click(restoreCheckbox);
  fireEvent.click(restored.view.getByRole("button", { name: "Save price" }));
  expect(restored.save.mock.calls[0]![0].brochureContentPlacement).toEqual(
    original.brochureContentPlacement,
  );
});

it("restores the automatic badge layout from a hidden-only placement in Albanian", () => {
  setLanguage("sq");
  const hidden = openEditor({
    ...product,
    brochureContentPlacement: { saving: { hidden: true } },
  });
  const checkbox = hidden.view.getByRole("checkbox", {
    name: "Shfaq shenjën e kursimit",
  }) as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
  fireEvent.click(checkbox);
  fireEvent.click(hidden.view.getByRole("button", { name: "Ruaj çmimin" }));
  expect(hidden.save.mock.calls[0]![0].brochureContentPlacement).toBeUndefined();
});
