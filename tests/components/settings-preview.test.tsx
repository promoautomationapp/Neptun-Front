import React from "react";
import type { Product } from "../../src/domain/models";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  SettingsPreview,
  settingsPreviewCampaign,
} from "../../src/features/settings/SettingsPreview";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";
import {
  PageSettingsTabs,
  PageSettingsGroup,
} from "../../src/features/brochure/PageSettingsTabs";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
beforeEach(() => {
  setLanguage("en");
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

it("opens an independent enlarged preview without saving or altering the draft", () => {
  const initial = resolveSettings(null);
  const draft = structuredClone(initial);
  draft.brochure.coverBackground.color = "#112233";
  draft.brochure.coverBackground.gradient = null;
  const unchanged = JSON.stringify(draft);
  const view = render(
    <SettingsPreview draft={draft} initial={initial} tab="design" />,
  );
  fireEvent.click(view.getByRole("button", { name: "Enlarge preview ↗" }));
  const dialog = view.getByRole("dialog", { name: "Brochure preview" });
  expect(
    dialog.querySelector<HTMLElement>(".brochure-output-page")!.style
      .background,
  ).toBe("rgb(17, 34, 51)");
  expect(dialog.querySelector(".ns-preview-canvas")).toBeTruthy();
  expect(JSON.stringify(draft)).toBe(unchanged);
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(view.queryByRole("dialog")).toBeNull();
});

it("renders real backgrounds, logos and price palettes while comparing saved defaults", () => {
  const initial = resolveSettings(null);
  const draft = structuredClone(initial);
  draft.brochure.coverBackground = {
    color: "#112233",
    gradient: null,
    image: "",
  };
  draft.brochure.coverLogoSource =
    "/api/assets/12345678-1234-4234-8234-123456789012";
  draft.brochure.pricePalette.red = "#884422";
  const view = render(
    <SettingsPreview draft={draft} initial={initial} tab="logos" />,
  );
  const frame = () =>
    view.container.querySelector<HTMLElement>(".brochure-output-page")!;
  expect(frame().style.background).toBe("rgb(17, 34, 51)");
  expect(frame().style.getPropertyValue("--brochure-price-red")).toBe(
    "#884422",
  );
  expect(
    view.container.querySelector(
      `img[src="${draft.brochure.coverLogoSource}"]`,
    ),
  ).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Saved defaults" }));
  expect(frame().style.background).toBe(
    "linear-gradient(110deg, rgb(31, 86, 135), rgb(56, 115, 159))",
  );
  expect(
    view.container.querySelector(
      `img[src="${draft.brochure.coverLogoSource}"]`,
    ),
  ).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Your changes" }));
  expect(frame().style.background).toBe("rgb(17, 34, 51)");
});

it("shows the selected download ratio and keeps the last valid preview during incomplete edits", () => {
  const initial = resolveSettings(null);
  const draft = structuredClone(initial);
  draft.brochure.format = "a4";
  const view = render(
    <SettingsPreview draft={draft} initial={initial} tab="formats" />,
  );
  const ratio =
    view.container.querySelector<HTMLElement>(".ns-preview-page")!.style
      .aspectRatio;
  expect(ratio).not.toBe("0.8");
  draft.brochure.installments = 0;
  view.rerender(
    <SettingsPreview
      draft={structuredClone(draft)}
      initial={initial}
      tab="formats"
    />,
  );
  expect(view.getByRole("status").textContent).toContain("Your draft is kept");
  expect(
    view.container.querySelector<HTMLElement>(".ns-preview-page")!.style
      .aspectRatio,
  ).toBe(ratio);
});

it("groups brochure controls in accessible tabs without losing unrelated panels", () => {
  const view = render(
    <PageSettingsTabs>
      <PageSettingsGroup title="Cover controls" category="appearance">
        Background options
      </PageSettingsGroup>
      <PageSettingsGroup title="Price controls" category="prices">
        Savings options
      </PageSettingsGroup>
      <PageSettingsGroup title="Size controls" category="layout">
        Layout options
      </PageSettingsGroup>
    </PageSettingsTabs>,
  );
  expect(view.getByText("Background options")).toBeTruthy();
  expect(view.queryByText("Savings options")).toBeNull();
  fireEvent.click(view.getByRole("tab", { name: /Prices & savings/ }));
  expect(view.getByText("Savings options")).toBeTruthy();
  expect(view.queryByText("Background options")).toBeNull();
  fireEvent.keyDown(view.getByRole("tab", { name: /Prices & savings/ }), {
    key: "ArrowRight",
  });
  expect(view.getByText("Layout options")).toBeTruthy();
  expect(view.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
    view.getByRole("tab", { name: /Format & layout/ }).id,
  );
});

it("scales one full paper at the selected ratio when the preview panel resizes", () => {
  let panelWidth = 320;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return DOMRect.fromRect({
        width: this.classList.contains("ns-preview-page") ? panelWidth : 760,
        height: 400,
      });
    },
  );
  const settings = resolveSettings(null);
  settings.brochure.format = "square1080";
  const view = render(
    <SettingsPreview draft={settings} initial={settings} tab="formats" />,
  );
  const canvas =
    view.container.querySelector<HTMLElement>(".ns-preview-canvas")!;
  expect(canvas.style.width).toBe("760px");
  expect(canvas.style.height).toBe("760px");
  expect(canvas.style.transform).toBe(`scale(${320 / 760})`);
  panelWidth = 380;
  fireEvent(window, new Event("resize"));
  expect(canvas.style.transform).toBe("scale(0.5)");
  const landscape = structuredClone(settings);
  landscape.brochure.format = "landscape1920x1080";
  view.rerender(
    <SettingsPreview draft={landscape} initial={settings} tab="formats" />,
  );
  expect(canvas.style.height).toBe("427.5px");
  expect(
    view.container.querySelector<HTMLElement>(".ns-preview-page")!.style
      .aspectRatio,
  ).toBe("1920 / 1080");
});
it("uses available category catalog photos without persisting or mutating the products", () => {
  const settings = resolveSettings(null);
  const catalog: Product[] = [
    {
      code: "TV",
      name: "TV LED LG",
      image: "/api/assets/00000000-0000-4000-8000-000000000301",
      categoryPath: "TV",
      regular: 499,
      specs: { Size: "55 inches" },
    },
    {
      code: "WM",
      name: "Washing machine",
      image: "/api/assets/00000000-0000-4000-8000-000000000302",
      categoryPath: "Appliances > Washing machines",
      regular: 399,
      specs: { Capacity: "8 kg" },
    },
  ];
  const before = structuredClone(catalog);
  const campaign = settingsPreviewCampaign(settings, catalog, "Appliances");
  expect(
    campaign.products.every((product) => product.image === catalog[1]!.image),
  ).toBe(true);
  expect(campaign.products[0]?.specs).toEqual({ Capacity: "8 kg" });
  expect(campaign.products[0]?.code).toBe("PREVIEW-1");
  expect(catalog).toEqual(before);
  expect(settings.brochure.coverBackground.image).toBe("");
});
it("keeps the logo independent from a blank default background and an explicitly uploaded background", () => {
  const settings = resolveSettings(null);
  settings.brochure.showCoverLogo = false;
  const view = render(
    <SettingsPreview draft={settings} initial={settings} tab="logos" />,
  );
  expect(view.container.querySelector(".cover-element-logo")).toBeNull();
  expect(settingsPreviewCampaign(settings).coverBackgroundImage).toBe("");
  const background = "/api/assets/00000000-0000-4000-8000-000000000303";
  settings.brochure.coverBackground.image = background;
  view.rerender(
    <SettingsPreview
      draft={structuredClone(settings)}
      initial={settings}
      tab="logos"
    />,
  );
  expect(view.container.querySelector(".cover-element-logo")).toBeNull();
  expect(settingsPreviewCampaign(settings).coverBackgroundImage).toBe(
    background,
  );
  settings.brochure.showCoverLogo = true;
  view.rerender(
    <SettingsPreview
      draft={structuredClone(settings)}
      initial={settings}
      tab="logos"
    />,
  );
  expect(view.container.querySelector(".cover-element-logo img")).toBeTruthy();
  expect(settingsPreviewCampaign(settings).coverBackgroundImage).toBe(
    background,
  );
});
