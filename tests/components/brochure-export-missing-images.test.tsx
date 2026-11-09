import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { BrochureExport } from "../../src/features/brochure/BrochureExport";
import { brochureExportGeometry } from "../../src/features/brochure/brochureFormat";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { Campaign, Product } from "../../src/domain/models";
import { toCanvas } from "html-to-image";

const pdfLinks = vi.hoisted(() => ({ link: vi.fn(), addPage: vi.fn() }));

vi.mock("html-to-image", () => ({
  toCanvas: vi.fn(),
  getFontEmbedCSS: async () => "",
}));
vi.mock("jspdf", () => ({
  jsPDF: class {
    addPage = pdfLinks.addPage;
    addImage() {}
    link = pdfLinks.link;
    output() {
      return new Blob(["PDF"], { type: "application/pdf" });
    }
  },
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
vi.mock("../../src/features/brochure/Brochure", () => ({
  splitPages: (campaign: Campaign) => [{ products: campaign.products }],
  CoverPage: () => <section className="brochure-output-page">Cover</section>,
  StoresPage: () => null,
  ProductPage: ({ page }: { page: { products: Product[] } }) => (
    <section className="brochure-output-page">
      {page.products.map((product) => (
        <div key={product.code} data-product-code={product.code}>
          {product.name}
          {product.image && <img src={product.image} alt={product.name} />}
        </div>
      ))}
    </section>
  ),
}));

const close = vi.fn();
const save = vi.fn();
beforeEach(() => {
  setLanguage("en");
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    0,
  );
  const geometry = brochureExportGeometry("neptun1080x1350");
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    right: geometry.previewWidth,
    bottom: geometry.previewHeight,
    width: geometry.previewWidth,
    height: geometry.previewHeight,
  } as DOMRect);
  vi.mocked(toCanvas).mockImplementation(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = geometry.width;
    canvas.height = geometry.height;
    return canvas;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/jpeg;base64,photo",
  );
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:download"),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(save);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function open(image?: string, initialPage = 0) {
  return render(
    <BrochureExport
      campaign={{
        id: "export",
        name: "Offers",
        brochureFormat: "neptun1080x1350",
        includeStoresPage: false,
        products: [
          {
            code: "84001",
            name: "Phone",
            url: "https://www.neptun-ks.com/products/phone",
            brochurePage: 2,
            ...(image ? { image } : {}),
          },
        ],
      }}
      settings={{ stores: [], contact: {} }}
      initialPage={initialPage}
      onClose={close}
    />,
  );
}

it("shows missing product and page in Albanian and downloads after the user chooses to continue", async () => {
  setLanguage("sq");
  const view = open();
  expect(view.getByRole("alert").textContent).toContain(
    "Faqja 2 · Phone (84001)",
  );
  expect(view.getByRole("alert").textContent).toContain(
    "Hapësirat e tyre do të mbeten bosh",
  );
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(
    view.getByRole("button", { name: /Vazhdo me shkarkimin PDF/ }),
  );
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(close).toHaveBeenCalledOnce();
  expect(pdfLinks.link).toHaveBeenCalledOnce();
  expect(pdfLinks.link).toHaveBeenCalledWith(
    0,
    0,
    expect.any(Number),
    expect.any(Number),
    { url: "https://www.neptun-ks.com/products/phone" },
  );
});

it("keeps the selected inside page's product link when downloading only that page", async () => {
  const view = open(undefined, 1);
  fireEvent.click(view.getByRole("button", { name: "One page" }));
  fireEvent.click(view.getByRole("button", { name: /Download anyway PDF/ }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(toCanvas).toHaveBeenCalledOnce();
  expect(pdfLinks.addPage).not.toHaveBeenCalled();
  expect(pdfLinks.link).toHaveBeenCalledOnce();
  expect(pdfLinks.link.mock.calls[0]![4]).toEqual({
    url: "https://www.neptun-ks.com/products/phone",
  });
});

it("pauses a prepared download for a broken photo, then saves without rendering again on approval", async () => {
  const view = open("/missing.png");
  fireEvent.click(view.getByRole("button", { name: /Download PDF/ }));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toContain("Page 2 · Phone"),
  );
  expect(save).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  const captures = vi.mocked(toCanvas).mock.calls.length;
  fireEvent.click(view.getByRole("button", { name: /Download anyway PDF/ }));
  expect(save).toHaveBeenCalledOnce();
  expect(close).toHaveBeenCalledOnce();
  expect(toCanvas).toHaveBeenCalledTimes(captures);
});
