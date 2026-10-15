import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  ProductGallery,
  productGalleryImages,
  productWebsiteLink,
} from "../../src/features/products/ProductGallery";
import { ProductInformation } from "../../src/features/products/ProductInformation";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(() => cleanup());
const product = {
  code: "P1",
  name: "Samsung TV",
  image: "https://img.example/front.jpg",
  images: [
    "https://img.example/front.jpg",
    "https://img.example/back.jpg",
    "https://img.example/side.jpg",
  ],
};
it("includes all known photos and collapses resized duplicates without losing the best source", () => {
  expect(
    productGalleryImages({
      ...product,
      image: "https://img.example/front.jpg?width=80",
      imageUrl: "https://img.example/front.jpg?width=1200",
      localImage: "",
      images: [
        "https://img.example/front.jpg?width=200",
        "https://img.example/back.jpg",
      ],
      imageChoices: ["https://img.example/back.jpg"],
      aiOriginalImage: "https://img.example/original.jpg",
      thumbnail: "https://img.example/front.jpg?width=100",
    }),
  ).toEqual([
    "https://img.example/front.jpg?width=1200",
    "https://img.example/back.jpg",
    "https://img.example/original.jpg",
  ]);
});
it("supports previous/next wrapping, accessible thumbnails and keyboard selection", () => {
  const view = render(<ProductGallery product={product} />);
  expect(
    (
      view.getByRole("img", {
        name: "Samsung TV · Photo 1",
      }) as HTMLImageElement
    ).src,
  ).toBe(product.image);
  expect(
    view
      .getByRole("button", { name: "Show photo 1" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(view.getByRole("button", { name: "Previous photo" }));
  expect(view.getByRole("img", { name: "Samsung TV · Photo 3" })).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Next photo" }));
  fireEvent.click(view.getByRole("button", { name: "Show photo 2" }));
  expect(
    view
      .getByRole("button", { name: "Show photo 2" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.keyDown(view.getByRole("region", { name: "Product photos" }), {
    key: "End",
  });
  expect(view.getByRole("img", { name: "Samsung TV · Photo 3" })).toBeTruthy();
  fireEvent.keyDown(view.getByRole("region", { name: "Product photos" }), {
    key: "Home",
  });
  expect(view.getByRole("img", { name: "Samsung TV · Photo 1" })).toBeTruthy();
});
it("resets to the first photo when switching products and keeps selection when more photos arrive", () => {
  const view = render(<ProductGallery product={product} />);
  fireEvent.click(view.getByRole("button", { name: "Show photo 2" }));
  view.rerender(
    <ProductGallery
      product={product}
      catalogProduct={{
        ...product,
        images: [...product.images, "https://img.example/extra.jpg"],
      }}
    />,
  );
  expect(view.getByRole("img", { name: "Samsung TV · Photo 2" })).toBeTruthy();
  view.rerender(
    <ProductGallery
      product={{
        ...product,
        code: "P2",
        name: "New product",
        image: "https://img.example/other.jpg",
        images: [],
      }}
    />,
  );
  expect(
    (
      view.getByRole("img", {
        name: "New product · Photo 1",
      }) as HTMLImageElement
    ).src,
  ).toBe("https://img.example/other.jpg");
  expect(view.queryByRole("button", { name: "Next photo" })).toBeNull();
});
it("skips a broken source and shows a meaningful empty state if no photos can load", () => {
  const view = render(
    <ProductGallery
      product={{
        ...product,
        images: [product.images[0]!],
        imageChoices: ["https://img.example/alternate.jpg"],
      }}
    />,
  );
  fireEvent.error(view.getByRole("img", { name: "Samsung TV · Photo 1" }));
  expect(
    (
      view.getByRole("img", {
        name: "Samsung TV · Photo 1",
      }) as HTMLImageElement
    ).src,
  ).toBe("https://img.example/alternate.jpg");
  fireEvent.error(view.getByRole("img", { name: "Samsung TV · Photo 1" }));
  expect(view.getByText("No product photos available")).toBeTruthy();
  expect(view.queryByRole("link", { name: "Open full-size photo" })).toBeNull();
});
it("uses safe external website links", () => {
  expect(
    productWebsiteLink("https://www.neptun-ks.com/product/example"),
  ).toEqual({
    href: "https://www.neptun-ks.com/product/example",
    host: "neptun-ks.com",
  });
  expect(productWebsiteLink("javascript:alert(1)")).toBeNull();
  expect(productWebsiteLink("data:text/html,test")).toBeNull();
  expect(productWebsiteLink("https://user:password@example.test/")).toBeNull();
});
it("separates readable overview and complete specs with accessible keyboard tabs", () => {
  const view = render(
    <ProductInformation
      description="All product details"
      specs={[
        ["Screen", "65 inches"],
        ["Resolution", "4K UHD"],
      ]}
    />,
  );
  expect(
    view.getByRole("tabpanel", { name: "Overview" }).textContent,
  ).toContain("All product details");
  fireEvent.keyDown(view.getByRole("tab", { name: "Overview" }), {
    key: "ArrowRight",
  });
  expect(
    view
      .getByRole("tab", { name: "Specifications 2" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(
    view.getByRole("tabpanel", { name: "Specifications 2" }).textContent,
  ).toContain("65 inches");
  expect(
    view.getByRole("tabpanel", { name: "Specifications 2" }).textContent,
  ).toContain("4K UHD");
  expect(document.activeElement).toBe(
    view.getByRole("tab", { name: "Specifications 2" }),
  );
});
