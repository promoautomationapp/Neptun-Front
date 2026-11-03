import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Product } from "../../src/domain/models";
import type * as ApiClient from "../../src/api/client";
import { ProductImageEditor } from "../../src/features/brochure/ProductImageEditor";
import { ScreenImageEditor } from "../../src/features/brochure/ScreenImageEditor";
import { resolveSettings } from "../../src/features/settings/settings.schema";

const api = vi.hoisted(() => ({
  prepare: vi.fn(),
  generate: vi.fn(),
  quota: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("../../src/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  uploadImage: api.upload,
}));
vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: api.prepare }));
vi.mock("../../src/features/products/useCatalogPhotos", () => ({
  useCatalogPhotos: (product?: Product) => ({
    product,
    loading: false,
    error: "",
    retry: vi.fn(),
  }),
}));
vi.mock("../../src/features/brochure/lifestyleImageApi", () => ({
  lifestyleQuota: api.quota,
  generateLifestyle: api.generate,
  acceptLifestyle: vi.fn(),
}));
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
const savedPhoto = "/api/assets/00000000-0000-4000-8000-000000000111";
const settings = resolveSettings({
  logoLibrary: [{ id: "photo", name: "Product photograph", url: savedPhoto }],
});
const tv: Product = {
  code: "TV-1",
  name: "Samsung TV 55 inch",
  brand: "Samsung",
  category: "TV",
  subcategory: "TV",
  image: "/tv.png",
  screenArtwork: { image: "/first-wallpaper.jpg", fit: "contain" },
};
beforeEach(() => {
  api.quota.mockResolvedValue({
    month: "2026-10",
    used: 0,
    limit: 20,
    attempts: 0,
    attemptLimit: 30,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("requires background removal for a saved product photo unless the user explicitly keeps its background", async () => {
  const save = vi.fn();
  const close = vi.fn();
  const view = render(
    <ProductImageEditor
      product={tv}
      catalogProduct={tv}
      settings={settings}
      onSave={save}
      onClose={close}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Saved images" }));
  fireEvent.click(
    view.getByRole("button", { name: "Use saved image: Product photograph" }),
  );
  expect(
    (
      view.getByRole("checkbox", {
        name: /Remove background with AI/,
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  expect(
    (view.getByRole("button", { name: "Use this image" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(
    view.getByRole("checkbox", { name: /Remove background with AI/ }),
  );
  fireEvent.click(view.getByRole("button", { name: "Use this image" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ image: savedPhoto, skipAiCutout: true }),
    ),
  );
  expect(close).toHaveBeenCalledOnce();
  expect(api.prepare).not.toHaveBeenCalled();
  expect(api.generate).not.toHaveBeenCalled();
});

it("reuses another TV's wallpaper with black letterboxing and keeps the explicit scope choice", () => {
  const save = vi.fn();
  const view = render(
    <ScreenImageEditor
      product={tv}
      settings={settings}
      televisions={[
        tv,
        {
          ...tv,
          code: "TV-2",
          screenArtwork: { image: "/portrait-wallpaper.jpg" },
        },
      ]}
      tvCount={2}
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Existing images" }));
  fireEvent.click(
    view.getByRole("button", { name: "Use wallpaper: Samsung TV-2" }),
  );
  const preview = view.getByAltText(
    "Replacement screen image",
  ) as HTMLImageElement;
  expect(preview.getAttribute("src")).toBe("/portrait-wallpaper.jpg");
  expect(preview.style.objectFit).toBe("contain");
  expect(preview.style.background).toBe("rgb(0, 0, 0)");
  fireEvent.click(view.getByRole("button", { name: "Apply wallpaper" }));
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "All TVs (2)" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      image: "/portrait-wallpaper.jpg",
      fit: "contain",
    }),
    "all",
  );
  expect(api.generate).not.toHaveBeenCalled();
});

it("opens the AI wallpaper tools directly without starting a generation", async () => {
  const view = render(
    <ScreenImageEditor
      product={tv}
      settings={settings}
      onSave={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(
    view.getByRole("button", { name: "Create / refine wallpaper with AI" }),
  );
  expect(
    view
      .getByRole("button", { name: "Create / refine with AI" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(view.getByLabelText("AI image direction")).toBeTruthy();
  await waitFor(() => expect(api.quota).toHaveBeenCalledOnce());
  expect(api.generate).not.toHaveBeenCalled();
  expect(api.prepare).not.toHaveBeenCalled();
});

it("fills the display with a newly uploaded wallpaper after an earlier whole-image choice", async () => {
  const save = vi.fn();
  api.upload.mockResolvedValue("/uploaded-wallpaper.jpg");
  const view = render(
    <ScreenImageEditor product={tv} onSave={save} onClose={vi.fn()} />,
  );
  expect(
    (view.getByAltText("Replacement screen image") as HTMLImageElement).style
      .objectFit,
  ).toBe("contain");
  fireEvent.change(view.getByLabelText("Upload screen picture"), {
    target: {
      files: [new File(["image"], "wallpaper.jpg", { type: "image/jpeg" })],
    },
  });
  await waitFor(() =>
    expect(
      (view.getByAltText("Replacement screen image") as HTMLImageElement).style
        .objectFit,
    ).toBe("cover"),
  );
  fireEvent.click(view.getByRole("button", { name: "Apply wallpaper" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ image: "/uploaded-wallpaper.jpg", fit: "cover" }),
    "one",
  );
  expect(api.prepare).not.toHaveBeenCalled();
  expect(api.generate).not.toHaveBeenCalled();
});

it("fills the display when a generated wallpaper is selected", async () => {
  const save = vi.fn();
  api.generate.mockResolvedValue({
    image: "/generated-wallpaper.png",
    resultId: "generated",
  });
  const view = render(
    <ScreenImageEditor product={tv} onSave={save} onClose={vi.fn()} />,
  );
  fireEvent.click(
    view.getByRole("button", { name: "Create / refine wallpaper with AI" }),
  );
  await waitFor(() => expect(api.quota).toHaveBeenCalledOnce());
  fireEvent.change(view.getByLabelText("AI image direction"), {
    target: { value: "A mountain landscape" },
  });
  fireEvent.click(view.getByRole("button", { name: "Refine this image" }));
  await waitFor(() =>
    expect(view.getByAltText("Full image preview").getAttribute("src")).toBe(
      "/generated-wallpaper.png",
    ),
  );
  fireEvent.click(view.getByRole("button", { name: "Use this image" }));
  await waitFor(() =>
    expect(view.queryByAltText("Full image preview")).toBeNull(),
  );
  expect(
    (view.getByAltText("Replacement screen image") as HTMLImageElement).style
      .objectFit,
  ).toBe("cover");
  fireEvent.click(view.getByRole("button", { name: "Apply wallpaper" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      image: "/generated-wallpaper.png",
      fit: "cover",
    }),
    "one",
  );
  expect(api.generate).toHaveBeenCalledOnce();
  expect(api.prepare).not.toHaveBeenCalled();
});

it("opens additive image layers without replacing the product photo or requesting AI", () => {
  const save = vi.fn(),
    close = vi.fn(),
    artwork = vi.fn();
  const original = structuredClone(tv);
  const view = render(
    <ProductImageEditor
      product={tv}
      onSave={save}
      onClose={close}
      onEditArtwork={artwork}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Add image layer" }));
  expect(artwork).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect(api.prepare).not.toHaveBeenCalled();
  expect(api.generate).not.toHaveBeenCalled();
  expect(tv).toEqual(original);
});
