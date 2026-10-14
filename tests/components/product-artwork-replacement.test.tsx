import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Product } from "../../src/domain/models";
import { ProductArtworkControls } from "../../src/features/brochure/ProductArtworkControls";

vi.mock("../../src/features/brochure/i18n", () => ({
  t: (text: string) => text,
}));
vi.mock("../../src/features/brochure/utils", async () => ({
  ...(await vi.importActual<Record<string, unknown>>(
    "../../src/features/brochure/utils",
  )),
  readImage: vi.fn().mockResolvedValue("data:image/png;base64,replacement"),
}));
afterEach(() => cleanup());

it("replacing a secondary bundle artwork sends one combined change with invalidated member fitting", async () => {
  const box = { x: 0.1, y: 0.2, width: 0.8, height: 0.6 };
  const product: Product = {
    code: "set",
    name: "TV and oven",
    image: "/oven.png",
    sale: 599,
    bundleProducts: [
      { code: "oven", name: "Oven", image: "/oven.png" },
      {
        code: "tv",
        name: "TV LED",
        subcategory: "TV",
        image: "/tv.png",
        screenArtwork: { image: "/wallpaper.jpg", box },
      },
    ],
    productArtworks: [
      {
        id: "secondary",
        type: "bundle-product",
        memberCode: "tv",
        image: "/custom-tv.png",
        usesPrimaryImage: false,
        x: 35,
        y: 10,
        width: 60,
      },
    ],
  };
  const onChange = vi.fn();
  const view = render(
    <ProductArtworkControls product={product} onChange={onChange} />,
  );
  const input = view.getByLabelText(
    "Replace product image or badge",
  ) as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(["picture"], "tv.png", { type: "image/png" })] },
  });
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  const changes = onChange.mock.calls[0]?.[0];
  expect(changes.productArtworks[0]).toMatchObject({
    image: "data:image/png;base64,replacement",
    usesPrimaryImage: false,
  });
  expect(changes.bundleProducts[1]).toMatchObject({
    image: "data:image/png;base64,replacement",
    screenArtwork: { image: "/wallpaper.jpg" },
  });
  expect(changes.bundleProducts[1].screenArtwork.box).toBeUndefined();
  expect(changes.bundleProducts[0]).toBe(product.bundleProducts?.[0]);
  expect(product.bundleProducts?.[1]?.screenArtwork?.box).toBe(box);
  expect(product.sale).toBe(599);
});
