import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { SettingsEditor } from "../../src/features/settings/SettingsEditor";
import {
  type WorkspaceSettings,
  resolveSettings,
} from "../../src/features/settings/settings.schema";
import { campaignDefaults } from "../../src/features/settings/campaign-defaults";
import { ProductPage } from "../../src/features/brochure/Brochure";
import { ProductLayoutControls } from "../../src/features/brochure/ProductLayoutControls";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { Campaign, Product } from "../../src/domain/models";

beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const product: Product = {
  code: "TV65",
  name: "TV QLED 65ABC",
  subcategory: "TV",
  image: "/tv.png",
  regular: 999,
  sale: 799,
  specs: { Përmasat: "65 inch", Teknologjia: "QLED" },
};
const page = {
  index: 0,
  layout: "grid6portrait",
  products: [product],
  image: "",
  backgroundColor: "",
  backgroundGradient: null,
  backgroundImage: "",
  showFooter: true,
  showFooterPageNumber: true,
  spacing: null,
  title: "TVs",
};
const campaign: Campaign = {
  id: "test",
  name: "Brochure",
  theme: "blue",
  products: [product],
};

it("keeps reference export markup identical when all defaults are untouched", () => {
  const original = renderToStaticMarkup(
    <ProductPage campaign={campaign} page={page} />,
  );
  const inherited = renderToStaticMarkup(
    <ProductPage
      campaign={{
        ...campaign,
        productDesign: resolveSettings(null).productDesign,
      }}
      page={page}
    />,
  );
  expect(inherited).toBe(original);
});

it("persists product design controls as settings and new campaign snapshots", async () => {
  const save = vi.fn(async (value: WorkspaceSettings) => value);
  const view = render(
    <SettingsEditor initial={resolveSettings(null)} onSave={save} />,
  );
  fireEvent.click(view.getByRole("tab", { name: "Product design" }));
  fireEvent.click(view.getByLabelText("Automatically group products by type"));
  fireEvent.change(view.getByLabelText("Default photo position and size"), {
    target: { value: "custom" },
  });
  fireEvent.change(view.getByLabelText("Default photo left (%)"), {
    target: { value: "40" },
  });
  fireEvent.change(view.getByLabelText("Default photo size (%)"), {
    target: { value: "120" },
  });
  fireEvent.change(view.getByLabelText("Default details position"), {
    target: { value: "bottom" },
  });
  fireEvent.change(view.getByLabelText("Default detail box fill"), {
    target: { value: "outline" },
  });
  fireEvent.change(view.getByLabelText("Default product text font"), {
    target: { value: "Arial" },
  });
  fireEvent.change(view.getByLabelText("Product name size (%)"), {
    target: { value: "110" },
  });
  fireEvent.click(view.getByLabelText("Show product name divider"));
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const saved = save.mock.calls[0]![0];
  expect(campaignDefaults(saved)).toMatchObject({
    autoProductLayout: false,
    productDesign: {
      photo: { mode: "custom", x: 40, scale: 1.2 },
      details: { placement: "bottom", fill: "outline" },
      typography: { font: "Arial", nameScale: 1.1 },
      divider: { visible: false },
    },
  });
});

it("uses custom artwork defaults in brochure export while saved per-product edits win", () => {
  const settings = resolveSettings(null);
  settings.productDesign.photo = {
    mode: "custom",
    x: 40,
    y: 45,
    scale: 1.15,
    automaticTvSizing: false,
  };
  settings.productDesign.details = { placement: "left", fill: "filled" };
  settings.productDesign.priceScale = 1.1;
  settings.productDesign.savingsScale = 0.9;
  settings.productDesign.typography = {
    font: "Arial",
    nameScale: 1.1,
    codeScale: 0.9,
    detailScale: 1.2,
  };
  settings.productDesign.grid = {
    mode: "custom",
    horizontal: 2,
    vertical: 4,
    content: 0.5,
  };
  settings.productDesign.divider.visible = false;
  const edited: Product = {
    ...product,
    brochureImagePlacement: { x: 60, y: 55, scale: 0.8 },
    detailPlacement: "bottom",
    detailBlockStyles: { Përmasat: "outline" },
    brochureContentPlacement: { price: { x: 2, y: 3, scale: 0.95 } },
  };
  const snapshot = {
    ...campaign,
    ...campaignDefaults(settings),
    products: [edited],
  };
  const view = render(
    <ProductPage campaign={snapshot} page={{ ...page, products: [edited] }} />,
  );
  const card = view.container.querySelector<HTMLElement>(".brochure-product")!;
  expect(card.dataset.customProductFont).toBe("true");
  expect(card.classList.contains("details-left")).toBe(false);
  expect(card.style.getPropertyValue("--product-name-scale")).toBe("1.1");
  expect(
    view.container.querySelector<HTMLImageElement>(".brochure-product-image")!
      .style.transform,
  ).toContain("scale(0.8)");
  expect(
    view.container.querySelector<HTMLElement>(".brochure-price")!.style.scale,
  ).toBe("");
  expect(
    view.container
      .querySelector<HTMLElement>('[data-detail-key="Përmasat"]')!
      .classList.contains("detail-style-outline"),
  ).toBe(true);
  expect(
    view.container.querySelector<HTMLElement>(".brochure-products")!.style
      .columnGap,
  ).toBe("2cqw");
  expect(
    view.container.querySelector<HTMLElement>(".brochure-product-name-divider")!
      .style.display,
  ).toBe("none");
});

it("resets a photo to its snapshotted custom default and shows the same numbers in controls", () => {
  setLanguage("en");
  const settings = resolveSettings(null);
  settings.productDesign.photo = {
    mode: "custom",
    x: 40,
    y: 45,
    scale: 1.15,
    automaticTvSizing: false,
  };
  const snapshot = { ...campaign, ...campaignDefaults(settings) };
  const change = vi.fn();
  const view = render(
    <ProductLayoutControls
      product={product}
      campaign={snapshot}
      onChange={change}
    />,
  );
  expect((view.getByLabelText("Left (%)") as HTMLInputElement).value).toBe(
    "40",
  );
  expect(
    (view.getAllByLabelText("Size (%)")[0] as HTMLInputElement).value,
  ).toBe("115");
  fireEvent.change(view.getByLabelText("Left (%)"), {
    target: { value: "50" },
  });
  expect(change).toHaveBeenCalledWith("brochureImagePlacement", {
    x: 50,
    y: 45,
    scale: 1.15,
  });
  fireEvent.click(view.getByRole("button", { name: "Reset photo position" }));
  expect(change).toHaveBeenLastCalledWith("brochureImagePlacement", null);
});
