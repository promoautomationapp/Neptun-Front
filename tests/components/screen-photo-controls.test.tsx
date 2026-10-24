import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Product } from "../../src/domain/models";
import { ScreenImageEditor } from "../../src/features/brochure/ScreenImageEditor";
import { ProductLayoutControls } from "../../src/features/brochure/ProductLayoutControls";
import { resolveScreenAnnotationPlacement } from "../../src/features/brochure/screenAnnotationGeometry";

vi.mock("../../src/features/brochure/i18n", () => ({
  t: (text: string) => text,
}));
vi.mock("../../src/features/brochure/Modals", () => ({
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    tone: _tone,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: string }) => (
    <button {...props}>{children}</button>
  ),
}));
const product: Product = {
  code: "TV-55",
  name: "Samsung TV 55 inch",
  brand: "Samsung",
  category: "TV",
  subcategory: "TV",
  regular: 499,
  image: "/new-photo.png",
  specs: { Ekrani: '55"' },
  screenArtwork: {
    image: "/wallpaper.jpg",
    box: { x: 0.2, y: 0.15, width: 0.6, height: 0.5 },
    detectedFor: "/old-photo.png",
  },
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("asks whether to use a wallpaper on one TV or all TVs before saving", () => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <ScreenImageEditor
      product={product}
      tvCount={3}
      televisions={[product, { ...product, code: "TV-2" }]}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Apply wallpaper" }));
  expect(onSave).not.toHaveBeenCalled();
  expect(
    view.getByRole("heading", {
      name: "Add this image to all TVs in the brochure?",
    }),
  ).toBeTruthy();
  expect(view.container.querySelectorAll(".cs-tv-scope-preview")).toHaveLength(
    2,
  );
  fireEvent.click(view.getByRole("button", { name: "All TVs (3)" }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ image: "/wallpaper.jpg", fit: "contain" }),
    "all",
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("lets a user go back from the scope choice or restore only this TV", () => {
  const onSave = vi.fn();
  const view = render(
    <ScreenImageEditor
      product={product}
      tvCount={3}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Apply wallpaper" }));
  fireEvent.click(view.getByRole("button", { name: "Back" }));
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Use original screen" }));
  fireEvent.click(view.getByRole("button", { name: "Only this TV" }));
  expect(onSave).toHaveBeenCalledWith(null, "one");
});

it("refits a stale saved box when the replacement photo loads, then stamps manual changes for that photo", () => {
  const onSave = vi.fn();
  const view = render(
    <ScreenImageEditor product={product} onSave={onSave} onClose={vi.fn()} />,
  );
  const image = view.container.querySelector<HTMLImageElement>(
    ".cs-screen-editor-preview > img",
  )!;
  Object.defineProperties(image, {
    naturalWidth: { value: 100 },
    naturalHeight: { value: 80 },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => null,
  );
  fireEvent.load(image);
  const overlay = view.container.querySelector<HTMLElement>(
    ".cs-screen-editor-overlay",
  )!;
  expect(overlay.style.left).toBe("4%");
  expect(overlay.style.width).toBe("92%");
  fireEvent.change(view.getByRole("slider", { name: "Left" }), {
    target: { value: "10" },
  });
  fireEvent.click(view.getByRole("button", { name: "Apply wallpaper" }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      box: expect.objectContaining({ width: 0.92, height: 0.75 }),
      detectedFor: image.src,
    }),
    "one",
  );
  expect(onSave.mock.calls[0]![0].box.x).toBeCloseTo(0.08);
});

it("keeps an unchanged legacy box on photo load", () => {
  const legacy = {
    ...product,
    screenArtwork: { image: "/wallpaper.jpg", box: product.screenArtwork!.box },
  };
  const view = render(
    <ScreenImageEditor product={legacy} onSave={vi.fn()} onClose={vi.fn()} />,
  );
  const image = view.container.querySelector<HTMLImageElement>(
    ".cs-screen-editor-preview > img",
  )!;
  Object.defineProperties(image, {
    naturalWidth: { value: 100 },
    naturalHeight: { value: 80 },
  });
  const sample = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
  fireEvent.load(image);
  expect(
    view.container.querySelector<HTMLElement>(".cs-screen-editor-overlay")!
      .style.left,
  ).toBe("20%");
  expect(sample).not.toHaveBeenCalled();
});

for (const type of ["television", "phone"] as const) {
  it(`hides the default ${type} inch label without changing its resolved corner placement`, () => {
    const item =
      type === "phone"
        ? {
            ...product,
            name: "Samsung Galaxy A17",
            category: "Mobile",
            subcategory: "SMARTPHONE",
            specs: { Ekrani: '6.7"' },
          }
        : product;
    const onChange = vi.fn();
    const view = render(
      <ProductLayoutControls
        product={item}
        campaign={{}}
        onChange={onChange}
      />,
    );
    fireEvent.click(view.getByRole("checkbox", { name: "Show inch label" }));
    expect(onChange).toHaveBeenCalledWith(
      "screenAnnotationPlacement",
      expect.objectContaining({
        ...resolveScreenAnnotationPlacement(type),
        hidden: true,
      }),
    );
    expect(
      view.queryByRole("spinbutton", { name: "Horizontal line (%)" }),
    ).toBeNull();
  });
}

it("keeps manually saved inch placement when toggling the label", () => {
  const onChange = vi.fn();
  const saved = { x: 2, y: -3, scale: 1.2, hidden: true };
  const view = render(
    <ProductLayoutControls
      product={{ ...product, screenAnnotationPlacement: saved }}
      campaign={{}}
      onChange={onChange}
    />,
  );
  fireEvent.click(view.getByRole("checkbox", { name: "Show inch label" }));
  expect(onChange).toHaveBeenCalledWith(
    "screenAnnotationPlacement",
    expect.objectContaining({
      ...saved,
      hidden: false,
    }),
  );
});
