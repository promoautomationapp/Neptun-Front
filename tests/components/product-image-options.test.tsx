import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Product } from "../../src/domain/models";
import { ProductImageEditor } from "../../src/features/brochure/ProductImageEditor";
import { ScreenImageEditor } from "../../src/features/brochure/ScreenImageEditor";
import { resolveSettings } from "../../src/features/settings/settings.schema";

const api = vi.hoisted(() => ({
  prepare: vi.fn(),
  generate: vi.fn(),
  quota: vi.fn(),
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

it("uses a saved workspace image as the product photo without automatically preparing it with AI", async () => {
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
  ).toBe(false);
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
