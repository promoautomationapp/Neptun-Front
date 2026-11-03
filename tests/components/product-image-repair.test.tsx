import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProductImageEditor } from "../../src/features/brochure/ProductImageEditor";
import type { Product } from "../../src/domain/models";

const prepare = vi.hoisted(() => vi.fn());
vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: prepare }));
vi.mock("../../src/features/ai/image-inspection", () => ({
  imageOrientation: async () => "square",
}));
vi.mock("../../src/features/products/useCatalogPhotos", () => ({
  useCatalogPhotos: (product?: Product) => ({
    product,
    loading: false,
    error: "",
    retry: vi.fn(),
  }),
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
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const found: Product = {
  code: "tv",
  name: "Exact television",
  image: "/found.png",
  skipAiCutout: true,
  imageSearch: {
    status: "found",
    requestKey: "tv",
    requestId: "search",
    imageUrl: "https://example.com/tv.png",
  },
};

it("requires preparation of a found photo, sends repair instructions and saves only the prepared result", async () => {
  prepare.mockResolvedValue({
    image: "/cutout.png",
    provider: "openai",
    preparationRevision: 3,
  });
  const save = vi.fn();
  const view = render(
    <ProductImageEditor product={found} onSave={save} onClose={vi.fn()} />,
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
  expect(prepare).not.toHaveBeenCalled();
  fireEvent.change(view.getByLabelText("Describe what needs fixing"), {
    target: { value: "  Remove the white border; keep the stand.  " },
  });
  fireEvent.click(view.getByRole("button", { name: "Remove background" }));
  await waitFor(() =>
    expect(prepare).toHaveBeenCalledWith(
      "ai-remove-background",
      expect.objectContaining({
        image: "/found.png",
        instructions: "Remove the white border; keep the stand.",
      }),
      undefined,
      { onRetry: expect.any(Function) },
    ),
  );
  await waitFor(() =>
    expect(
      (
        view.getByRole("button", {
          name: "Use this image",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(view.getByRole("button", { name: "Use this image" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      image: "/cutout.png",
      aiOriginalImage: "/found.png",
      skipAiCutout: false,
    }),
  );
  expect(found.image).toBe("/found.png");
});

it("re-cuts an existing prepared photo from its original and keeps it unchanged if preparation fails", async () => {
  prepare.mockRejectedValue(
    new Error("Could not remove background completely."),
  );
  const save = vi.fn();
  const product = {
    ...found,
    image: "/old-cutout.png",
    aiOriginalImage: "/original.png",
    skipAiCutout: false,
  };
  const view = render(
    <ProductImageEditor product={product} onSave={save} onClose={vi.fn()} />,
  );
  fireEvent.change(view.getByLabelText("Describe what needs fixing"), {
    target: { value: "Keep both feet of the television." },
  });
  expect(
    (view.getByRole("button", { name: "Use this image" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(
    view.getByRole("button", { name: "Remove background again" }),
  );
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toContain(
      "Could not remove background completely.",
    ),
  );
  expect(prepare).toHaveBeenCalledWith(
    "ai-remove-background",
    expect.objectContaining({
      image: "/original.png",
      instructions: "Keep both feet of the television.",
      retry: true,
    }),
    undefined,
    { onRetry: expect.any(Function) },
  );
  expect(save).not.toHaveBeenCalled();
  expect(product.image).toBe("/old-cutout.png");
});

it("announces automatic recovery attempts in the image editor without saving a pending result", async () => {
  let finish!: (value: { image: string }) => void;
  prepare.mockImplementation((_path, _body, _signal, options) => {
    options.onRetry(2, 3);
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const save = vi.fn();
  const view = render(
    <ProductImageEditor product={found} onSave={save} onClose={vi.fn()} />,
  );
  fireEvent.click(view.getByRole("button", { name: "Remove background" }));
  await waitFor(() =>
    expect(view.getByText("Retrying photo · 2/3")).toBeTruthy(),
  );
  expect(
    (view.getByRole("button", { name: "Use this image" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(save).not.toHaveBeenCalled();
  finish({ image: "/cutout.png" });
  await waitFor(() =>
    expect(view.queryByText("Retrying photo · 2/3")).toBeNull(),
  );
});
