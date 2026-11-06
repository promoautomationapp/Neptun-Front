import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import type { Product } from "../../src/domain/models";
import type * as TvWallpaperFitApi from "../../src/features/brochure/tvWallpaperFit";
import { ScreenImageEditor } from "../../src/features/brochure/ScreenImageEditor";
import { ProductLayoutControls } from "../../src/features/brochure/ProductLayoutControls";
import { resolveScreenAnnotationPlacement } from "../../src/features/brochure/screenAnnotationGeometry";
import { fitTvWallpaperTargets } from "../../src/features/brochure/tvWallpaperFit";
import { requestAi } from "../../src/features/ai/ai.api";

vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: vi.fn() }));

vi.mock("../../src/features/brochure/tvWallpaperFit", async () => ({
  ...(await vi.importActual<typeof TvWallpaperFitApi>(
    "../../src/features/brochure/tvWallpaperFit",
  )),
  fitTvWallpaperTargets: vi.fn(
    async (
      products: Product[],
      options?: {
        selectedFit?: {
          code: string;
          box: { x: number; y: number; width: number; height: number };
          detectedFor: string;
        };
      },
    ) => ({
      fits: products.map((tv) =>
        options?.selectedFit?.code === String(tv.code)
          ? options.selectedFit
          : {
              code: String(tv.code),
              box: { x: 0.04, y: 0.08, width: 0.92, height: 0.75 },
              detectedFor: tv.image || "",
            },
      ),
      unfittedCodes: [],
    }),
  ),
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
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

it("asks whether to use a wallpaper on one TV or all TVs before saving", async () => {
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
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ image: "/wallpaper.jpg", fit: "cover" }),
      "all",
      expect.objectContaining({ fits: expect.any(Array), unfittedCodes: [] }),
    ),
  );
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
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

it("refits a stale saved box when the replacement photo loads, then stamps manual changes for that photo", async () => {
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
  expect(view.container.querySelector(".cs-screen-editor-overlay")).toBeNull();
  fireEvent.change(view.getByRole("slider", { name: "Left" }), {
    target: { value: "10" },
  });
  fireEvent.click(view.getByRole("button", { name: "Apply wallpaper" }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        box: expect.objectContaining({ width: 0.92, height: 0.75 }),
        detectedFor: image.src,
      }),
      "one",
      expect.objectContaining({ fits: expect.any(Array), unfittedCodes: [] }),
    ),
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
  expect(sample).toHaveBeenCalled();
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

it("fits the selected product photo with AI only after the user requests it", async () => {
  vi.mocked(requestAi).mockResolvedValueOnce({
    found: true,
    x: 0.2,
    y: 0.16,
    width: 0.6,
    height: 0.5,
  } as never);
  const save = vi.fn();
  const view = render(
    <ScreenImageEditor product={product} onSave={save} onClose={vi.fn()} />,
  );
  expect(requestAi).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Fit screen with AI" }));
  await waitFor(() =>
    expect(
      view.container.querySelector<HTMLElement>(".cs-screen-editor-overlay")!
        .style.left,
    ).toBe("20%"),
  );
  expect(requestAi).toHaveBeenCalledExactlyOnceWith(
    "ai-detect-screen",
    { image: product.image },
    expect.any(AbortSignal),
  );
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Apply wallpaper" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        box: { x: 0.2, y: 0.16, width: 0.6, height: 0.5 },
        detectedFor: product.image,
      }),
      "one",
      expect.objectContaining({ fits: expect.any(Array) }),
    ),
  );
});

it("leaves invalid AI screen detection unapplied", async () => {
  vi.mocked(requestAi).mockResolvedValueOnce({
    found: true,
    x: 0.8,
    y: 0.1,
    width: 0.6,
    height: 0.5,
  } as never);
  const save = vi.fn();
  const view = render(
    <ScreenImageEditor product={product} onSave={save} onClose={vi.fn()} />,
  );
  fireEvent.click(view.getByRole("button", { name: "Fit screen with AI" }));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toContain(
      "The screen could not be identified",
    ),
  );
  expect(save).not.toHaveBeenCalled();
  expect(view.container.querySelector(".cs-screen-editor-overlay")).toBeNull();
});

it("keeps the editor open and reports TVs that could not be fitted after applying successful fits", async () => {
  const plan = {
    fits: [
      {
        code: product.code,
        detectedFor: product.image!,
        box: { x: 0.1, y: 0.15, width: 0.8, height: 0.5 },
      },
    ],
    unfittedCodes: ["TV-2"],
  };
  vi.mocked(fitTvWallpaperTargets).mockResolvedValueOnce(plan);
  const save = vi.fn(),
    close = vi.fn();
  const view = render(
    <ScreenImageEditor
      product={product}
      tvCount={2}
      televisions={[product, { ...product, code: "TV-2" }]}
      onSave={save}
      onClose={close}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Apply wallpaper" }));
  fireEvent.click(view.getByRole("button", { name: "All TVs (2)" }));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toContain("TV-2"),
  );
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ image: "/wallpaper.jpg" }),
    "all",
    plan,
  );
  expect(close).not.toHaveBeenCalled();
});

it("cancels stale AI detection when the product photo changes without applying the old result", async () => {
  let finish!: (result: never) => void;
  vi.mocked(requestAi).mockImplementationOnce(
    () =>
      new Promise<never>((resolve) => {
        finish = resolve;
      }),
  );
  const save = vi.fn();
  const props = { product, onSave: save, onClose: vi.fn() };
  const view = render(<ScreenImageEditor {...props} />);
  fireEvent.click(view.getByRole("button", { name: "Fit screen with AI" }));
  await waitFor(() => expect(requestAi).toHaveBeenCalledOnce());
  const signal = vi.mocked(requestAi).mock.calls[0]![2]!;
  view.rerender(
    <ScreenImageEditor
      {...props}
      product={{ ...product, image: "/changed-photo.png" }}
    />,
  );
  expect(signal.aborted).toBe(true);
  await act(async () => {
    finish({ found: true, x: 0.25, y: 0.2, width: 0.5, height: 0.4 } as never);
  });
  expect(view.container.querySelector(".cs-screen-editor-overlay")).toBeNull();
  expect(view.queryByText("Finding the screen…")).toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it("keeps a deliberate manual fit when the photo finishes loading later", () => {
  const view = render(
    <ScreenImageEditor product={product} onSave={vi.fn()} onClose={vi.fn()} />,
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
  fireEvent.change(view.getByRole("slider", { name: "Left" }), {
    target: { value: "7" },
  });
  fireEvent.load(image);
  expect(
    parseFloat(
      view.container.querySelector<HTMLElement>(".cs-screen-editor-overlay")!
        .style.left,
    ),
  ).toBeCloseTo(7);
});

it("does not cancel an explicit AI fit when the preview photo finishes loading", async () => {
  let finish!: (result: never) => void;
  vi.mocked(requestAi).mockImplementationOnce(
    () =>
      new Promise<never>((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(
    <ScreenImageEditor product={product} onSave={vi.fn()} onClose={vi.fn()} />,
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
  fireEvent.click(view.getByRole("button", { name: "Fit screen with AI" }));
  await waitFor(() => expect(requestAi).toHaveBeenCalledOnce());
  fireEvent.load(image);
  expect(vi.mocked(requestAi).mock.calls[0]![2]!.aborted).toBe(false);
  await act(async () => {
    finish({ found: true, x: 0.2, y: 0.15, width: 0.6, height: 0.5 } as never);
  });
  expect(
    view.container.querySelector<HTMLElement>(".cs-screen-editor-overlay")!
      .style.left,
  ).toBe("20%");
});

it("previews duplicate TV codes with the fit belonging to each photo", () => {
  const selected = {
    ...product,
    image: "/same-one.png",
    screenArtwork: {
      image: "/wallpaper.jpg",
      detectedFor: "/same-one.png",
      box: { x: 0.1, y: 0.1, width: 0.8, height: 0.5 },
    },
  };
  const other = {
    ...product,
    image: "/same-two.png",
    screenArtwork: {
      image: "/old-wallpaper.jpg",
      detectedFor: "/same-two.png",
      box: { x: 0.25, y: 0.2, width: 0.5, height: 0.4 },
    },
  };
  const view = render(
    <ScreenImageEditor
      product={selected}
      tvCount={2}
      televisions={[selected, other]}
      onSave={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Apply wallpaper" }));
  const previews = view.container.querySelectorAll<HTMLElement>(
    ".cs-tv-scope-preview > div > span",
  );
  expect(previews[0]?.style.width).toBe("80%");
  expect(previews[1]?.style.width).toBe("50%");
});

it("switches the selected TV's photo, wallpaper, fit and scope together", () => {
  const first = {
    ...product,
    image: "/first-tv.png",
    screenArtwork: {
      image: "/first-wallpaper.jpg",
      fit: "cover" as const,
      box: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 },
    },
  };
  const second = {
    ...product,
    code: "TV-75",
    name: "Beko TV 75 inch",
    image: "/second-tv.png",
    screenArtwork: {
      image: "/second-wallpaper.jpg",
      fit: "contain" as const,
      fitExplicit: true,
      box: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 },
    },
  };
  const select = vi.fn();
  const props = {
    televisions: [first, second],
    tvCount: 2,
    onSelectTelevision: select,
    onSave: vi.fn(),
    onClose: vi.fn(),
  };
  const view = render(<ScreenImageEditor {...props} product={first} />);
  fireEvent.click(view.getByRole("combobox", { name: "Selected TV" }));
  fireEvent.click(
    view.getByRole("option", { name: "Beko TV 75 inch · TV-75" }),
  );
  expect(select).toHaveBeenCalledExactlyOnceWith(second);
  fireEvent.click(view.getByRole("button", { name: "Apply wallpaper" }));
  expect(
    view.getByRole("heading", {
      name: "Add this image to all TVs in the brochure?",
    }),
  ).toBeTruthy();
  view.rerender(<ScreenImageEditor {...props} product={second} />);
  expect(
    view.container
      .querySelector<HTMLImageElement>(".cs-screen-editor-preview > img")!
      .getAttribute("src"),
  ).toBe(second.image);
  expect(
    view.getByAltText("Replacement screen image").getAttribute("src"),
  ).toBe(second.screenArtwork.image);
  expect(
    (view.getByAltText("Replacement screen image") as HTMLImageElement).style
      .objectFit,
  ).toBe("contain");
  expect(
    view.queryByRole("heading", {
      name: "Add this image to all TVs in the brochure?",
    }),
  ).toBeNull();
  expect(requestAi).not.toHaveBeenCalled();
});

it("corrects an oversized legacy screen rectangle when the actual TV image loads", () => {
  const pixels = new Uint8ClampedArray(100 * 80 * 4).fill(255);
  for (let y = 15; y < 50; y++)
    for (let x = 20; x < 80; x++) {
      const offset = (y * 100 + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 30;
    }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage() {},
    getImageData: () => ({ data: pixels }),
  } as unknown as CanvasRenderingContext2D);
  const legacy = {
    ...product,
    screenArtwork: {
      image: "/wallpaper.jpg",
      box: { x: 0.01, y: 0.01, width: 0.98, height: 0.98 },
    },
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
  fireEvent.load(image);
  const overlay = view.container.querySelector<HTMLElement>(
    ".cs-screen-editor-overlay",
  )!;
  expect(overlay.style.left).toBe("21%");
  expect(overlay.style.top).toBe("20%");
  expect(overlay.style.width).toBe("57.99999999999999%");
  expect(overlay.style.height).toBe("41.25%");
  expect(requestAi).not.toHaveBeenCalled();
});
