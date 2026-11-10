import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Details } from "../../src/features/brochure/Modals";
import { catalogByCodes } from "../../src/features/products/products.api";
import { setLanguage } from "../../src/features/brochure/i18n";
vi.mock("../../src/features/products/products.api", () => ({
  catalogByCodes: vi.fn(),
}));
beforeEach(() => {
  setLanguage("en");
  vi.mocked(catalogByCodes).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("loads the known catalog gallery and details with a prominent source action", async () => {
  const product = {
    code: "P1",
    name: "Saved TV",
    image: "https://img.example/front.jpg",
    regular: 599,
    brand: "Samsung",
    category: "TV",
  };
  vi.mocked(catalogByCodes).mockResolvedValue([
    {
      ...product,
      description: "Detailed catalog description",
      url: "https://www.neptun-ks.com/tv/saved",
      images: [product.image, "https://img.example/back.jpg"],
      specs: { Resolution: "4K UHD", WiFi: "Yes" },
    },
  ]);
  const view = render(<Details product={product} onClose={vi.fn()} />);
  await waitFor(() =>
    expect(view.getByRole("button", { name: "Show photo 2" })).toBeTruthy(),
  );
  expect(catalogByCodes).toHaveBeenCalledOnce();
  const website = view.getByRole("link", { name: "View on neptun-ks.com ↗" });
  expect(website.className).toBe("np-product-website");
  expect(website.getAttribute("target")).toBe("_blank");
  expect(website.getAttribute("rel")).toContain("noopener");
  expect(view.getByText("Detailed catalog description")).toBeTruthy();
  fireEvent.click(view.getByRole("tab", { name: "Specifications 2" }));
  expect(view.getByText("4K UHD")).toBeTruthy();
});
it("retains brochure edits and does not replace an edited name with fetched catalog values", async () => {
  const product = {
    code: "P1",
    name: "My brochure name",
    image: "https://img.example/front.jpg",
    regular: 599,
    images: [],
  };
  vi.mocked(catalogByCodes).mockResolvedValue([
    {
      ...product,
      name: "Catalog title",
      images: [product.image, "https://img.example/back.jpg"],
    },
  ]);
  const change = vi.fn();
  const imageEdit = vi.fn();
  const view = render(
    <Details
      product={product}
      campaign={{ id: "campaign", name: "Campaign", products: [product] }}
      onProductChange={change}
      onImageEdit={imageEdit}
      onClose={vi.fn()}
    />,
  );
  await waitFor(() =>
    expect(view.getByRole("button", { name: "Show photo 2" })).toBeTruthy(),
  );
  expect(
    (view.getByLabelText("Product name shown in brochure") as HTMLInputElement)
      .value,
  ).toBe("My brochure name");
  fireEvent.change(view.getByLabelText("Product name shown in brochure"), {
    target: { value: "New brochure name" },
  });
  expect(change).toHaveBeenCalledWith("name", "New brochure name");
  const productLink = view.getByLabelText("Neptun product link");
  fireEvent.change(productLink, {
    target: { value: "https://foreign.example/product" },
  });
  fireEvent.blur(productLink);
  expect(productLink.getAttribute("aria-invalid")).toBe("true");
  expect(change).not.toHaveBeenCalledWith("url", expect.anything());
  fireEvent.change(productLink, {
    target: { value: "/products/exact-product" },
  });
  fireEvent.blur(productLink);
  expect(change).toHaveBeenCalledWith(
    "url",
    "https://www.neptun-ks.com/products/exact-product",
  );
  fireEvent.click(view.getByRole("button", { name: "Change image" }));
  expect(imageEdit).toHaveBeenCalledOnce();
  expect(view.getByText("Details shown in brochure")).toBeTruthy();
});

it("opens and focuses the product artwork controls from Add image layer", async () => {
  const product = {
    code: "P1",
    name: "Saved photo",
    image: "/main-photo.png",
    productArtworks: [],
  };
  const change = vi.fn();
  const view = render(
    <Details
      product={product}
      onProductChange={change}
      onClose={vi.fn()}
      canLoadCatalogPhotos={false}
      focusDetailKey="__artwork"
    />,
  );
  const section = view.container.querySelector<HTMLDetailsElement>(
    "[data-product-artwork-editor]",
  )!;
  await waitFor(() => expect(section.open).toBe(true));
  const upload = section.querySelector(".np-upload-button")!;
  expect(document.activeElement).toBe(upload);
  expect(catalogByCodes).not.toHaveBeenCalled();
  expect(change).not.toHaveBeenCalled();
  expect(product.image).toBe("/main-photo.png");
});
