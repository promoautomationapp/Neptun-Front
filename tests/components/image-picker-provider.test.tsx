import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Campaign, Product } from "../../src/domain/models";
import { requestAi } from "../../src/features/ai/ai.api";
import { CampaignAssetArtwork } from "../../src/features/brochure/CampaignAssetArtwork";
import { ImagePickerProvider } from "../../src/features/brochure/ImagePickerProvider";
import { PageArtwork } from "../../src/features/brochure/PageArtwork";
import { ProductBrandArtwork } from "../../src/features/brochure/ProductBrandArtwork";
import { setLanguage } from "../../src/features/brochure/i18n";
import { readImage } from "../../src/features/brochure/utils";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import type * as BrochureUtils from "../../src/features/brochure/utils";

vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: vi.fn() }));
vi.mock("../../src/features/brochure/utils", async (original) => ({
  ...(await original<typeof BrochureUtils>()),
  readImage: vi.fn(),
}));

beforeEach(() => {
  setLanguage("en");
  vi.mocked(readImage).mockResolvedValue("/uploaded-image.png");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const placement = { x: 8, y: 12, width: 18, height: 9, rotation: 15 };
const campaign: Campaign = {
  id: "picker-test",
  name: "Offers",
  products: [],
  campaignAssets: { footer: { placement } },
};
const product: Product = {
  code: "phone",
  name: "Phone",
  brand: "Samsung",
  brandLogo: "/current-brand.svg",
  detailBlockPlacements: { __brand: placement },
};
const pageImage = {
  id: "page-photo",
  type: "image" as const,
  image: "/current-page.png",
  ...placement,
  opacity: 0.7,
  zIndex: 4,
  imageFit: "contain" as const,
};
function provider(children: React.ReactNode) {
  const settings = resolveSettings(null);
  settings.logoLibrary = [
    { id: "chosen", name: "Saved artwork", url: "/chosen.svg" },
  ];
  return (
    <ImagePickerProvider settings={settings}>{children}</ImagePickerProvider>
  );
}

it("opens campaign asset logos with the rendered source and applies only a confirmed source", () => {
  const change = vi.fn();
  const view = render(
    provider(
      <CampaignAssetArtwork
        campaign={campaign}
        assetKey="footer"
        label="Footer logo"
        onChange={change}
      >
        <img src="/original-footer.svg" alt="Footer logo" />
      </CampaignAssetArtwork>,
    ),
  );
  fireEvent.doubleClick(view.getByAltText("Footer logo"));
  expect(
    view.getByRole("dialog", { name: "Replace image: Footer logo" }),
  ).toBeTruthy();
  expect(view.getAllByAltText("Selected logo")[0]?.getAttribute("src")).toBe(
    "/original-footer.svg",
  );
  fireEvent.click(
    view.getByRole("button", { name: "Select logo: Saved artwork" }),
  );
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.doubleClick(view.getByAltText("Footer logo"));
  fireEvent.click(
    view.getByRole("button", { name: "Select logo: Saved artwork" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Use this logo" }));
  expect(change).toHaveBeenCalledExactlyOnceWith("footer", {
    image: "/chosen.svg",
  });
  expect(campaign.campaignAssets?.footer?.placement).toEqual(placement);
  expect(view.queryByRole("dialog")).toBeNull();
  expect(readImage).not.toHaveBeenCalled();
  expect(requestAi).not.toHaveBeenCalled();
});

it("replaces a product brand mark from the saved library without changing its layout", () => {
  const change = vi.fn();
  const view = render(
    provider(
      <ProductBrandArtwork
        campaign={campaign}
        product={product}
        onChange={change}
      />,
    ),
  );
  fireEvent.doubleClick(view.getByAltText("Samsung"));
  expect(
    view.getByRole("dialog", { name: "Replace brand logo: Samsung" }),
  ).toBeTruthy();
  fireEvent.click(
    view.getByRole("button", { name: "Select logo: Saved artwork" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Use this logo" }));
  expect(change).toHaveBeenCalledExactlyOnceWith("brandLogo", "/chosen.svg");
  expect(product.detailBlockPlacements?.__brand).toEqual(placement);
  expect(requestAi).not.toHaveBeenCalled();
});

it("uses image-specific choices for page images, preserves their styling, and leaves page text editable", () => {
  const change = vi.fn();
  const view = render(
    provider(
      <PageArtwork
        campaign={{
          pageArtworks: {
            cover: [
              pageImage,
              {
                id: "text",
                type: "text",
                text: "Editable",
                x: 5,
                y: 5,
                width: 10,
              },
            ],
          },
        }}
        pageKey="cover"
        onChange={change}
      />,
    ),
  );
  fireEvent.doubleClick(view.getByRole("textbox", { name: "Edit page text" }));
  expect(view.queryByRole("dialog")).toBeNull();
  const image = view.getByRole("img", { name: "Page artwork" });
  fireEvent.doubleClick(image);
  expect(view.getByRole("dialog", { name: "Replace page image" })).toBeTruthy();
  fireEvent.click(
    view.getByRole("button", { name: "Select image: Saved artwork" }),
  );
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Use this image" }));
  expect(change).toHaveBeenCalledExactlyOnceWith("page-photo", {
    ...pageImage,
    image: "/chosen.svg",
  });
  expect(image.getAttribute("src")).toBe("/chosen.svg");
  expect(requestAi).not.toHaveBeenCalled();
});

it("previews a local upload in the shared chooser and keeps it unapplied until confirmation", async () => {
  const change = vi.fn();
  const view = render(
    provider(
      <ProductBrandArtwork
        campaign={campaign}
        product={product}
        onChange={change}
      />,
    ),
  );
  fireEvent.doubleClick(view.getByAltText("Samsung"));
  const file = new File(["photo"], "replacement.png", { type: "image/png" });
  fireEvent.change(view.getByLabelText("Upload logo"), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(view.getAllByAltText("Selected logo")[0]?.getAttribute("src")).toBe(
      "/uploaded-image.png",
    ),
  );
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Use this logo" }));
  expect(change).toHaveBeenCalledExactlyOnceWith(
    "brandLogo",
    "/uploaded-image.png",
  );
  expect(readImage).toHaveBeenCalledExactlyOnceWith(file);
  expect(requestAi).not.toHaveBeenCalled();
});

it("retains direct upload replacement for standalone artwork outside the provider", async () => {
  const change = vi.fn();
  const view = render(
    <PageArtwork
      campaign={{ pageArtworks: { cover: [pageImage] } }}
      pageKey="cover"
      onChange={change}
    />,
  );
  const input = view.getByLabelText("Replace page image");
  const click = vi.spyOn(input, "click");
  fireEvent.doubleClick(view.getByRole("img", { name: "Page artwork" }));
  expect(click).toHaveBeenCalledOnce();
  expect(view.queryByRole("dialog")).toBeNull();
  fireEvent.change(input, {
    target: { files: [new File(["photo"], "page.png", { type: "image/png" })] },
  });
  await waitFor(() =>
    expect(change).toHaveBeenCalledExactlyOnceWith("page-photo", {
      ...pageImage,
      image: "/uploaded-image.png",
    }),
  );
  expect(requestAi).not.toHaveBeenCalled();
});

it("keeps dropping a file onto a page image direct even when a picker is available", async () => {
  const change = vi.fn();
  const view = render(
    provider(
      <PageArtwork
        campaign={{ pageArtworks: { cover: [pageImage] } }}
        pageKey="cover"
        onChange={change}
      />,
    ),
  );
  const file = new File(["photo"], "drop.png", { type: "image/png" });
  fireEvent.drop(view.getByRole("img", { name: "Page artwork" }), {
    dataTransfer: { files: [file], types: ["Files"] },
  });
  await waitFor(() =>
    expect(change).toHaveBeenCalledExactlyOnceWith("page-photo", {
      ...pageImage,
      image: "/uploaded-image.png",
    }),
  );
  expect(view.queryByRole("dialog")).toBeNull();
  expect(readImage).toHaveBeenCalledExactlyOnceWith(file);
  expect(requestAi).not.toHaveBeenCalled();
});

it.each(["campaign", "brand"])(
  "keeps the standalone %s asset upload available without a provider",
  (kind) => {
    const change = vi.fn();
    const view = render(
      kind === "campaign" ? (
        <CampaignAssetArtwork
          campaign={campaign}
          assetKey="footer"
          label="Footer logo"
          onChange={change}
        >
          <img src="/footer.svg" alt="Footer logo" />
        </CampaignAssetArtwork>
      ) : (
        <ProductBrandArtwork
          campaign={campaign}
          product={product}
          onChange={change}
        />
      ),
    );
    const input =
      view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const click = vi.spyOn(input, "click");
    fireEvent.doubleClick(
      view.getByAltText(kind === "campaign" ? "Footer logo" : "Samsung"),
    );
    expect(click).toHaveBeenCalledOnce();
    expect(view.queryByRole("dialog")).toBeNull();
    expect(change).not.toHaveBeenCalled();
  },
);
