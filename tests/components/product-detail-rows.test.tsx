import { useState } from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { Product } from "../../src/domain/models";
import { Details } from "../../src/features/brochure/Modals";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);
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
  fireEvent.change(view.getByRole("textbox", { name: "Detail value 1" }), {
    target: { value: "Battery\n6000 mAh" },
  });
  expect(preview.textContent).toContain("6000 mAh");
  fireEvent.click(view.getByRole("button", { name: "Move down 1" }));
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
