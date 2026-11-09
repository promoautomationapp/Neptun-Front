import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BrandLogoPreview } from "../../src/features/brochure/BrandLogoPreview";
import { BrandLogoManager } from "../../src/features/brochure/BrandLogoManager";
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

afterEach(cleanup);

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

it("lets a user choose the logo treatment without preparing new images", () => {
  setLanguage("en");
  const change = vi.fn();
  const view = render(
    <BrandLogoPreview
      campaign={{ brandLogoMode: "original" }}
      products={[]}
      onChange={change}
    />,
  );
  expect(view.getAllByRole("img")).toHaveLength(6);
  for (const swatch of view.container.querySelectorAll<HTMLElement>(
    ".cs-brand-logo-preview-swatch",
  ))
    expect(swatch.style.getPropertyValue("--brand-preview-filter")).toBe(
      "none",
    );
  fireEvent.change(view.getByRole("combobox", { name: "Brand logo colors" }), {
    target: { value: "dark" },
  });
  expect(change).toHaveBeenCalledWith("dark");
  expect(
    brandLogoAppearance(
      { brandLogoMode: "white", productBackgroundColor: "#ffffff" },
      "product",
    ).mode,
  ).toBe("white");
});

it("keeps a creation override through campaign validation and reusable design snapshots", () => {
  setLanguage("en");
  const create = vi.fn();
  const view = render(
    <CreateCampaign
      settings={resolveSettings(null)}
      onCreate={create}
      onClose={vi.fn()}
    />,
  );
  fireEvent.change(view.getByRole("combobox", { name: "Brand logo colors" }), {
    target: { value: "original" },
  });
  fireEvent.click(view.getByRole("button", { name: "Create campaign →" }));
  const campaign = create.mock.calls[0]![0];
  expect(
    campaignSchema.parse(JSON.parse(JSON.stringify(campaign))).brandLogoMode,
  ).toBe("original");
  const design = brochureDesignSnapshot(campaign);
  expect(design.brandLogoMode).toBe("original");
  expect(
    brochurePresetSchema.parse({
      id: "team-logos",
      name: "Team",
      design: { brandLogoMode: design.brandLogoMode },
    }).design.brandLogoMode,
  ).toBe("original");
});

it("can change the saved brochure's logo colors without preparing an image again", () => {
  setLanguage("en");
  const campaign = {
    id: "saved",
    name: "Saved",
    products: [{ code: "tv", name: "TV", brand: "LG" }],
  };
  const update = vi.fn((mutator) => mutator(campaign));
  const view = render(
    <BrandLogoManager campaign={campaign} onUpdate={update} />,
  );
  fireEvent.change(
    view.getByRole("combobox", { name: "Brand logo colors", hidden: true }),
    { target: { value: "white" } },
  );
  expect(update).toHaveBeenCalledOnce();
  expect(campaign).toHaveProperty("brandLogoMode", "white");
});
