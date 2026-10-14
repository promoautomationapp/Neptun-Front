import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SettingsPreview } from "../../src/features/settings/SettingsPreview";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import {
  PageSettingsTabs,
  PageSettingsGroup,
} from "../../src/features/brochure/PageSettingsTabs";

afterEach(cleanup);

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
  expect(frame().style.background).toBe("rgb(28, 64, 117)");
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
