import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrandLogoPreview } from "../../src/features/brochure/BrandLogoPreview";
import { BrandLogoManager } from "../../src/features/brochure/BrandLogoManager";
import type { Campaign } from "../../src/domain/models";
import {
  brandLogoAppearance,
  DARK_BRAND_LOGO_FILTER,
} from "../../src/features/brochure/brandLogoAppearance";
import { BUILTIN_BRAND_LOGOS } from "../../src/features/brochure/brandLogos";
import { CreateCampaign } from "../../src/features/brochure/Modals";
import { brochureDesignSnapshot } from "../../src/features/brochure/brochurePresets";
import { campaignSchema } from "../../src/domain/schemas";
import {
  brochurePresetSchema,
  resolveSettings,
} from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(() => {
  cleanup();
  setLanguage("sq");
});

it("previews actual manufacturer assets in each page's default logo color", () => {
  setLanguage("en");
  const campaign = {
    theme: "blue",
    coverBackgroundColor: "#1c4075",
    productBackgroundColor: "#e4e4e4",
    brandLogos: { SAMSUNG: "/team-samsung.png" },
  };
  const view = render(
    <BrandLogoPreview
      campaign={campaign}
      products={[
        { code: "a", name: "Phone", brand: "Samsung" },
        { code: "b", name: "TV", brand: "LG" },
        { code: "c", name: "Another phone", brand: "SAMSUNG" },
      ]}
      onChange={vi.fn()}
    />,
  );
  expect(
    view
      .getAllByRole("img", { name: "Samsung" })
      .map((image) => image.getAttribute("src")),
  ).toEqual(["/team-samsung.png", "/team-samsung.png"]);
  expect(view.getAllByRole("img", { name: "LG" })[0]!.getAttribute("src")).toBe(
    BUILTIN_BRAND_LOGOS.LG,
  );
  const swatches = view.container.querySelectorAll<HTMLElement>(
    ".cs-brand-logo-preview-swatch",
  );
  expect(swatches[0]!.style.getPropertyValue("--brand-preview-filter")).toBe(
    "brightness(0) invert(1)",
  );
  expect(swatches[1]!.style.getPropertyValue("--brand-preview-filter")).toBe(
    DARK_BRAND_LOGO_FILTER,
  );
  expect(swatches[1]!.style.color).toBe("rgb(52, 53, 52)");
});

it("uses a compact color picker, previews the tint and offers automatic/original resets", () => {
  setLanguage("en");
  const change = vi.fn();
  const view = render(
    <BrandLogoPreview
      campaign={{ brandLogoMode: "original" }}
      products={[]}
      onChange={change}
    />,
  );
  expect(view.getAllByRole("img")).toHaveLength(4);
  expect(view.queryByRole("combobox")).toBeNull();
  for (const swatch of view.container.querySelectorAll<HTMLElement>(
    ".cs-brand-logo-preview-swatch",
  ))
    expect(swatch.style.getPropertyValue("--brand-preview-filter")).toBe(
      "none",
    );
  fireEvent.click(view.getByRole("button", { name: /Brand logo colors:/ }));
  fireEvent.change(
    view.getByRole("textbox", { name: "Brand logo colors hex code" }),
    {
      target: { value: "#2676ad" },
    },
  );
  expect(change).toHaveBeenLastCalledWith({
    brandLogoMode: "auto",
    brandLogoColor: "#2676ad",
  });
  view.rerender(
    <BrandLogoPreview
      campaign={{ brandLogoColor: "#2676ad" }}
      products={[]}
      onChange={change}
    />,
  );
  for (const swatch of view.container.querySelectorAll<HTMLElement>(
    ".cs-brand-logo-preview-swatch",
  )) {
    expect(swatch.style.color).toBe("rgb(38, 118, 173)");
    expect(swatch.style.getPropertyValue("--brand-preview-filter")).toMatch(
      /^url\("#brand-preview-/,
    );
    expect(swatch.querySelector("feFlood")?.getAttribute("flood-color")).toBe(
      "#2676ad",
    );
  }
  fireEvent.click(view.getByRole("button", { name: "Automatic" }));
  expect(change).toHaveBeenLastCalledWith({
    brandLogoMode: "auto",
    brandLogoColor: undefined,
  });
  fireEvent.click(view.getByRole("button", { name: "Original colors" }));
  expect(change).toHaveBeenLastCalledWith({
    brandLogoMode: "original",
    brandLogoColor: undefined,
  });
  expect(
    brandLogoAppearance(
      { brandLogoMode: "white", productBackgroundColor: "#ffffff" },
      "product",
    ).mode,
  ).toBe("white");
});

it("places the creation picker below size and keeps a custom color through validation and design snapshots", () => {
  setLanguage("en");
  const create = vi.fn();
  const view = render(
    <CreateCampaign
      settings={resolveSettings(null)}
      onCreate={create}
      onClose={vi.fn()}
    />,
  );
  const format = view.container.querySelector(".cs-brochure-format-picker")!;
  const preview = view.container.querySelector(".cs-brand-logo-preview")!;
  const optional = view.container.querySelector(".cs-create-options")!;
  expect(
    format.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    preview.compareDocumentPosition(optional) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: /Brand logo colors:/ }));
  fireEvent.change(
    view.getByRole("textbox", { name: "Brand logo colors hex code" }),
    {
      target: { value: "#2676ad80" },
    },
  );
  fireEvent.click(view.getByRole("button", { name: "Close color picker" }));
  fireEvent.click(view.getByRole("button", { name: "Create campaign →" }));
  const campaign = create.mock.calls[0]![0];
  expect(
    campaignSchema.parse(JSON.parse(JSON.stringify(campaign))).brandLogoColor,
  ).toBe("#2676ad80");
  const design = brochureDesignSnapshot(campaign);
  expect(design.brandLogoMode).toBe("auto");
  expect(design.brandLogoColor).toBe("#2676ad80");
  expect(
    brochurePresetSchema.parse({
      id: "team-logos",
      name: "Team",
      design: {
        brandLogoMode: design.brandLogoMode,
        brandLogoColor: design.brandLogoColor,
      },
    }).design.brandLogoColor,
  ).toBe("#2676ad80");
  expect(
    campaignSchema.parse({
      id: "x",
      name: "X",
      products: [],
      brandLogoColor: "#123456",
    }).brandLogoColor,
  ).toBe("#123456");
  expect(
    campaignSchema.safeParse({
      id: "x",
      name: "X",
      products: [],
      brandLogoColor: "url(https://invalid.example)",
    }).success,
  ).toBe(false);
  expect(
    brochurePresetSchema.safeParse({
      id: "bad",
      name: "Bad",
      design: { brandLogoColor: "red" },
    }).success,
  ).toBe(false);
});

it("can change the saved brochure's logo colors without preparing an image again", () => {
  setLanguage("en");
  const campaign: Campaign = {
    id: "saved",
    name: "Saved",
    products: [{ code: "tv", name: "TV", brand: "LG" }],
    pageAppearances: {
      cover: { brandColor: "#ffffff", textColor: "#123456" },
      "product-2": { brandColor: "#343534", priceStyle: "card" },
    },
  };
  const update = vi.fn((mutator) => mutator(campaign));
  const view = render(
    <BrandLogoManager campaign={campaign} onUpdate={update} />,
  );
  view.container.querySelector<HTMLDetailsElement>("details")!.open = true;
  fireEvent.click(view.getByRole("button", { name: /Brand logo colors:/ }));
  fireEvent.change(
    view.getByRole("textbox", { name: "Brand logo colors hex code" }),
    { target: { value: "#8e44ad" } },
  );
  expect(update).toHaveBeenCalledOnce();
  expect(campaign).toHaveProperty("brandLogoMode", "auto");
  expect(campaign).toHaveProperty("brandLogoColor", "#8e44ad");
  expect(campaign.pageAppearances).toEqual({
    cover: { textColor: "#123456" },
    "product-2": { priceStyle: "card" },
  });
});
