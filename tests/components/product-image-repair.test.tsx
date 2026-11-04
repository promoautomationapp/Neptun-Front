import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProductImageEditor } from "../../src/features/brochure/ProductImageEditor";
import type { Product } from "../../src/domain/models";

const prepare = vi.hoisted(() => vi.fn());
const orientation = vi.hoisted(() => vi.fn(async () => "square"));
vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: prepare }));
vi.mock("../../src/features/ai/image-inspection", () => ({
  imageOrientation: orientation,
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
  Modal: ({
    children,
    onClose,
  }: {
    children: React.ReactNode;
    onClose: () => void;
  }) => (
    <div>
      <button onClick={onClose}>Close editor</button>
      {children}
    </div>
  ),
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

it("makes a found photo usable immediately and previews background removal only when requested", async () => {
  prepare.mockResolvedValue({
    image: "/cutout.png",
    provider: "openai",
    preparationRevision: 3,
    cutoutValidated: true,
    cutoutValidationVersion: 1,
  });
  const save = vi.fn();
  const view = render(
    <ProductImageEditor product={found} onSave={save} onClose={vi.fn()} />,
  );
  expect(
    (view.getByRole("button", { name: "Use this image" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
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
      expect.any(AbortSignal),
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
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: /^Original photo$/ }));
  expect(view.getByRole("img", { name: found.name }).getAttribute("src")).toBe(
    "/found.png",
  );
  fireEvent.click(view.getByRole("button", { name: /^Background removed$/ }));
  expect(view.getByRole("img", { name: found.name }).getAttribute("src")).toBe(
    "/cutout.png",
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

it("discards a rejected saved cutout and requests a fresh one from its original even when preparation fails", async () => {
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
  ).toBe(false);
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
      regenerate: true,
      rejectedImage: "/old-cutout.png",
    }),
    expect.any(AbortSignal),
    { onRetry: expect.any(Function) },
  );
  expect(save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      image: "/original.png",
      aiOriginalImage: "",
      skipAiCutout: false,
    }),
  );
  expect(save.mock.calls[0]![0].aiCutoutValidated).toBeUndefined();
  expect(
    view.getByRole("img", { name: product.name }).getAttribute("src"),
  ).toBe("/original.png");
  expect(view.queryByRole("button", { name: "Background removed" })).toBeNull();
  expect(product.image).toBe("/old-cutout.png");
});

it("announces automatic recovery attempts in the image editor without saving a pending result", async () => {
  let finish!: (value: {
    image: string;
    cutoutValidated: boolean;
    cutoutValidationVersion: number;
  }) => void;
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
  finish({
    image: "/cutout.png",
    cutoutValidated: true,
    cutoutValidationVersion: 1,
  });
  await waitFor(() =>
    expect(view.queryByText("Retrying photo · 2/3")).toBeNull(),
  );
});

it("uses the original immediately while source inspection is pending and never starts AI afterward", async () => {
  let inspected!: (value: string) => void;
  orientation.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        inspected = resolve;
      }),
  );
  const save = vi.fn(),
    close = vi.fn();
  const view = render(
    <ProductImageEditor product={found} onSave={save} onClose={close} />,
  );
  fireEvent.click(view.getByRole("button", { name: "Remove background" }));
  fireEvent.click(view.getByRole("button", { name: "Use original photo" }));
  expect(save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      image: "/found.png",
      skipAiCutout: true,
      aiOriginalImage: "",
    }),
  );
  expect(close).toHaveBeenCalledOnce();
  await act(async () => {
    inspected("square");
  });
  expect(prepare).not.toHaveBeenCalled();
});

it("aborts the pending client wait when the original is accepted and ignores a late prepared result", async () => {
  let finish!: (value: { image: string }) => void;
  prepare.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const save = vi.fn(),
    close = vi.fn();
  const view = render(
    <ProductImageEditor product={found} onSave={save} onClose={close} />,
  );
  fireEvent.click(view.getByRole("button", { name: "Remove background" }));
  await waitFor(() => expect(prepare).toHaveBeenCalledOnce());
  const signal = prepare.mock.calls[0]?.[2] as AbortSignal;
  fireEvent.click(view.getByRole("button", { name: "Use original photo" }));
  expect(signal.aborted).toBe(true);
  expect(save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ image: "/found.png", skipAiCutout: true }),
  );
  await act(async () => {
    finish({ image: "/late-cutout.png" });
  });
  expect(save).toHaveBeenCalledOnce();
  expect(view.getByRole("img", { name: found.name }).getAttribute("src")).toBe(
    "/found.png",
  );
  expect(close).toHaveBeenCalledOnce();
});

it("closes during source inspection without starting a later AI request", async () => {
  let inspected!: (value: string) => void;
  orientation.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        inspected = resolve;
      }),
  );
  const save = vi.fn(),
    close = vi.fn();
  const view = render(
    <ProductImageEditor product={found} onSave={save} onClose={close} />,
  );
  fireEvent.click(view.getByRole("button", { name: "Remove background" }));
  fireEvent.click(view.getByRole("button", { name: "Close editor" }));
  expect(close).toHaveBeenCalledOnce();
  await act(async () => {
    inspected("square");
  });
  expect(prepare).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
});

it("ignores an earlier preparation finishing while a new photo is being prepared", async () => {
  let first!: (value: { image: string }) => void;
  let second!: (value: {
    image: string;
    cutoutValidated: boolean;
    cutoutValidationVersion: number;
  }) => void;
  prepare
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          first = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          second = resolve;
        }),
    );
  const save = vi.fn();
  const view = render(
    <ProductImageEditor
      product={found}
      catalogProduct={{ ...found, images: ["/other.png"] }}
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Remove background" }));
  await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
  const firstSignal = prepare.mock.calls[0]?.[2] as AbortSignal;
  fireEvent.click(view.getByRole("button", { name: "Product photo 2" }));
  expect(firstSignal.aborted).toBe(true);
  expect(
    (view.getByRole("button", { name: "Use this image" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  fireEvent.click(view.getByRole("button", { name: "Remove background" }));
  await waitFor(() => expect(prepare).toHaveBeenCalledTimes(2));
  await act(async () => {
    first({ image: "/old-result.png" });
  });
  expect(
    (
      view.getByRole("button", {
        name: "Preparing image…",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(view.getByRole("img", { name: found.name }).getAttribute("src")).toBe(
    "/other.png",
  );
  await act(async () => {
    second({
      image: "/new-result.png",
      cutoutValidated: true,
      cutoutValidationVersion: 1,
    });
  });
  fireEvent.click(view.getByRole("button", { name: "Use this image" }));
  expect(save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      image: "/new-result.png",
      aiOriginalImage: "/other.png",
    }),
  );
});

it("never offers or saves an unvalidated generated photo and makes its retry a fresh AI request", async () => {
  prepare
    .mockResolvedValueOnce({ image: "/opaque-output.png" })
    .mockResolvedValueOnce({
      image: "/verified.png",
      cutoutValidated: true,
      cutoutValidationVersion: 1,
    });
  const save = vi.fn();
  const view = render(
    <ProductImageEditor product={found} onSave={save} onClose={vi.fn()} />,
  );
  fireEvent.click(view.getByRole("button", { name: "Remove background" }));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toContain(
      "could not be verified",
    ),
  );
  expect(view.getByRole("img", { name: found.name }).getAttribute("src")).toBe(
    "/found.png",
  );
  expect(view.queryByRole("button", { name: "Background removed" })).toBeNull();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(
    view.getByRole("button", { name: "Retry background removal" }),
  );
  await waitFor(() => expect(prepare).toHaveBeenCalledTimes(2));
  expect(prepare.mock.calls[1]![1]).toMatchObject({
    image: "/found.png",
    retry: true,
    regenerate: true,
    rejectedImage: "/opaque-output.png",
  });
  await waitFor(() =>
    expect(
      view.getByRole("img", { name: found.name }).getAttribute("src"),
    ).toBe("/verified.png"),
  );
});
