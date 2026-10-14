import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Product, ProductImageSearch } from "../../src/domain/models";
import {
  MissingCatalogNotice,
  missingCatalogCodes,
} from "../../src/features/brochure/MissingCatalogNotice";
import { ProductImageEditor } from "../../src/features/brochure/ProductImageEditor";
import { LargeBundleOffer } from "../../src/features/brochure/LargeBundleOffer";
import { requestAi } from "../../src/features/ai/ai.api";

vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: vi.fn() }));
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
vi.mock("../../src/features/brochure/utils", async () => ({
  ...(await vi.importActual<Record<string, unknown>>(
    "../../src/features/brochure/utils",
  )),
  readImage: vi.fn().mockResolvedValue("data:image/png;base64,own-photo"),
}));
const missing: Product = {
  code: "EXCEL-555",
  name: "Product from spreadsheet",
  sale: 399,
  catalogMissing: true,
};
const search = (status: ProductImageSearch["status"]): ProductImageSearch => ({
  status,
  requestKey: "product-key",
  requestId: "request-id",
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("lists actual missing item codes without synthetic bundle or Set codes", () => {
  const bundle: Product = {
    code: "SET-555",
    name: "Set",
    catalogMissing: true,
    bundleProducts: [
      { ...missing, code: "LEAF-1" },
      {
        code: "NESTED-SET",
        name: "Nested set",
        catalogMissing: true,
        bundleProducts: [{ ...missing, code: "LEAF-2" }],
      },
    ],
  };
  expect(missingCatalogCodes(bundle)).toEqual(["LEAF-1", "LEAF-2"]);
  expect(
    missingCatalogCodes({
      ...bundle,
      missingCatalogCodes: ["EXPLICIT", "EXPLICIT"],
    }),
  ).toEqual(["EXPLICIT"]);
  expect(missingCatalogCodes({ ...missing, missingCatalogCodes: [] })).toEqual(
    [],
  );
  const view = render(
    <MissingCatalogNotice product={bundle} variant="badge" />,
  );
  expect(view.container.textContent).toContain("LEAF-1, LEAF-2");
  expect(view.container.textContent).not.toContain("SET-555");
  expect(view.container.textContent).not.toContain("NESTED-SET");
});

it("shows a clear missing-catalog status and lets the user choose image search or their own upload", () => {
  const find = vi.fn();
  const upload = vi.fn();
  const view = render(
    <MissingCatalogNotice
      product={missing}
      onFindImage={find}
      onUploadImage={upload}
    />,
  );
  expect(view.getByText(/Not in catalog/)).toBeDefined();
  expect(view.getByText(/EXCEL-555/)).toBeDefined();
  fireEvent.click(view.getByRole("button", { name: "Find exact photo" }));
  fireEvent.click(view.getByRole("button", { name: "Upload own image" }));
  expect(find).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledTimes(1);
  expect(
    view.container.firstElementChild?.getAttribute("data-export-hide"),
  ).toBe("true");
  expect(requestAi).not.toHaveBeenCalled();
});

it("keeps upload available while search is running and presents not-found/failure states without disabling editing", () => {
  const props = {
    product: { ...missing, imageSearch: search("searching") },
    onFindImage: vi.fn(),
    onUploadImage: vi.fn(),
  };
  const view = render(<MissingCatalogNotice {...props} />);
  expect(
    (view.getByRole("button", { name: "Searching…" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (
      view.getByRole("button", {
        name: "Upload own image",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  view.rerender(
    <MissingCatalogNotice
      {...props}
      product={{ ...missing, imageSearch: search("not_found") }}
    />,
  );
  expect(view.getByText("No exact product photo found")).toBeDefined();
  fireEvent.click(view.getByRole("button", { name: "Upload own image" }));
  view.rerender(
    <MissingCatalogNotice
      {...props}
      product={{ ...missing, imageSearch: search("failed") }}
    />,
  );
  expect(view.getByText("Image search could not be completed")).toBeDefined();
  expect(props.onUploadImage).toHaveBeenCalledTimes(1);
});

it("allows a persisted interrupted search to resume while keeping an active request disabled", () => {
  const find = vi.fn();
  const props = {
    product: { ...missing, imageSearch: search("searching") },
    onFindImage: find,
    onSave: vi.fn(),
    onClose: vi.fn(),
  };
  const view = render(<ProductImageEditor {...props} />);
  expect(
    (view.getByRole("button", { name: "Searching…" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  view.rerender(<ProductImageEditor {...props} canResumeSearch />);
  const resume = view.getByRole("button", {
    name: "Resume search",
  }) as HTMLButtonElement;
  expect(resume.disabled).toBe(false);
  expect(
    (
      view.getByRole("button", {
        name: "Upload own image",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  fireEvent.click(resume);
  expect(find).toHaveBeenCalledTimes(1);
  view.rerender(<ProductImageEditor {...props} canResumeSearch={false} />);
  expect(
    (view.getByRole("button", { name: "Searching…" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(requestAi).not.toHaveBeenCalled();
});

it("allows direct upload and apply with no catalog photo and keeps AI cutout off", async () => {
  const save = vi.fn();
  const close = vi.fn();
  const view = render(
    <ProductImageEditor
      product={missing}
      onSave={save}
      onClose={close}
      onFindImage={vi.fn()}
    />,
  );
  const cutout = view.getByRole("checkbox", {
    name: /Remove background with AI/,
  }) as HTMLInputElement;
  expect(cutout.checked).toBe(false);
  expect(
    (view.getByRole("button", { name: "Use this image" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(view.getByLabelText("Upload another image"), {
    target: { files: [new File(["photo"], "own.png", { type: "image/png" })] },
  });
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
  expect(save).toHaveBeenCalledWith({
    image: "data:image/png;base64,own-photo",
    aiOriginalImage: "",
    skipAiCutout: true,
  });
  expect(close).toHaveBeenCalledTimes(1);
  expect(requestAi).not.toHaveBeenCalled();
  expect(missing.sale).toBe(399);
});

it("uses the fetched exact photo directly while displaying its source and keeping normal controls available", () => {
  const product: Product = {
    ...missing,
    image: "/api/assets/exact-photo.png",
    imageSearch: {
      ...search("found"),
      imageUrl: "https://example.com/model.jpg",
      sourceUrl: "https://example.com/model",
      matchedName: "Exact model 555",
    },
  };
  const save = vi.fn();
  const view = render(
    <ProductImageEditor
      product={product}
      onSave={save}
      onClose={vi.fn()}
      onFindImage={vi.fn()}
    />,
  );
  expect(view.getByText("Exact product photo found")).toBeDefined();
  expect(view.getByText("Exact model 555")).toBeDefined();
  expect(
    view.getByRole("link", { name: "Photo source" }).getAttribute("href"),
  ).toBe(product.imageSearch?.sourceUrl);
  expect(
    (
      view.getByRole("checkbox", {
        name: /Remove background with AI/,
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
  fireEvent.click(view.getByRole("button", { name: "Use this image" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ image: product.image, skipAiCutout: true }),
  );
  expect(view.getByLabelText("Upload another image")).toBeDefined();
  expect(requestAi).not.toHaveBeenCalled();
});

it("updates an open empty editor when the exact-image result arrives without starting AI preparation", async () => {
  const save = vi.fn();
  const props = {
    product: { ...missing, imageSearch: search("searching") },
    onSave: save,
    onClose: vi.fn(),
    onFindImage: vi.fn(),
  };
  const view = render(<ProductImageEditor {...props} />);
  view.rerender(
    <ProductImageEditor
      {...props}
      product={{
        ...missing,
        image: "/api/assets/found.png",
        imageSearch: {
          ...search("found"),
          imageUrl: "https://example.com/found.png",
        },
      }}
    />,
  );
  await waitFor(() =>
    expect(
      view.getByRole("img", { name: missing.name }).getAttribute("src"),
    ).toBe("/api/assets/found.png"),
  );
  fireEvent.click(view.getByRole("button", { name: "Use this image" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      image: "/api/assets/found.png",
      skipAiCutout: true,
    }),
  );
  expect(requestAi).not.toHaveBeenCalled();
});

it("does not replace the user's uploaded selection when an older search finishes", async () => {
  const save = vi.fn();
  const props = {
    product: { ...missing, imageSearch: search("searching") },
    onSave: save,
    onClose: vi.fn(),
  };
  const view = render(<ProductImageEditor {...props} />);
  fireEvent.change(view.getByLabelText("Upload another image"), {
    target: { files: [new File(["photo"], "own.png", { type: "image/png" })] },
  });
  await waitFor(() =>
    expect(
      view.getByRole("img", { name: missing.name }).getAttribute("src"),
    ).toBe("data:image/png;base64,own-photo"),
  );
  view.rerender(
    <ProductImageEditor
      {...props}
      product={{
        ...missing,
        image: "/api/assets/late-result.png",
        imageSearch: {
          ...search("found"),
          imageUrl: "https://example.com/late.png",
        },
      }}
    />,
  );
  expect(
    view.getByRole("img", { name: missing.name }).getAttribute("src"),
  ).toBe("data:image/png;base64,own-photo");
  fireEvent.click(view.getByRole("button", { name: "Use this image" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ image: "data:image/png;base64,own-photo" }),
  );
  expect(requestAi).not.toHaveBeenCalled();
});

it("allows a known catalog image to bypass optional cutout while retaining the usual photo controls", () => {
  const known: Product = {
    code: "known",
    name: "Catalog product",
    image: "/catalog.png",
  };
  const save = vi.fn();
  const view = render(
    <ProductImageEditor
      product={known}
      catalogProduct={known}
      onSave={save}
      onClose={vi.fn()}
    />,
  );
  const cutout = view.getByRole("checkbox", {
    name: /Remove background with AI/,
  }) as HTMLInputElement;
  expect(cutout.checked).toBe(true);
  fireEvent.click(cutout);
  fireEvent.click(view.getByRole("button", { name: "Use this image" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ image: "/catalog.png", skipAiCutout: true }),
  );
  expect(view.getByRole("button", { name: "Product photo 1" })).toBeDefined();
  expect(requestAi).not.toHaveBeenCalled();
});

it("shows bundle notices only during editing and preserves every member layout, copy and shared price", () => {
  const known: Product = {
    code: "known",
    name: "Known product",
    image: "/known.png",
  };
  const uploaded: Product = { ...missing, code: "own", image: "/own.png" };
  const product: Product = {
    code: "set",
    name: "Set",
    sale: 699,
    bundleProducts: [known, missing, uploaded],
    missingCatalogCodes: [missing.code, uploaded.code],
  };
  const before = structuredClone(product);
  const edit = vi.fn();
  const props = {
    product,
    artwork: <span>Pictures</span>,
    price: <span className="brochure-price">699€</span>,
    renderMember: (member: Product) => <span>{member.name}</span>,
    onEditMemberImage: edit,
  };
  const view = render(<LargeBundleOffer {...props} editable />);
  expect(
    view.container.querySelectorAll(".large-bundle-missing-photo"),
  ).toHaveLength(1);
  expect(
    view.container.querySelectorAll(".large-bundle-missing-badge"),
  ).toHaveLength(1);
  expect(
    view.container.querySelectorAll(".large-bundle-member-copy"),
  ).toHaveLength(3);
  expect(view.container.querySelectorAll(".brochure-price")).toHaveLength(1);
  for (const notice of view.container.querySelectorAll(
    ".large-bundle-missing-photo,.large-bundle-missing-badge",
  ))
    expect(notice.getAttribute("data-export-hide")).toBe("true");
  fireEvent.click(view.getByRole("button", { name: "Upload own image" }));
  expect(edit).toHaveBeenCalledWith(missing);
  expect(product).toEqual(before);
  view.rerender(<LargeBundleOffer {...props} editable={false} />);
  expect(
    view.container.querySelector(
      ".missing-catalog-notice,.missing-catalog-badge",
    ),
  ).toBeNull();
  expect(missingCatalogCodes(product)).toEqual([missing.code, uploaded.code]);
});
