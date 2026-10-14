import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CreateCampaign } from "../../src/features/brochure/Modals";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";
afterEach(() => cleanup());
it("creates brochures from saved defaults with independently editable content", () => {
  setLanguage("en");
  const settings = resolveSettings(null);
  settings.defaultCampaignTypeId = settings.campaignTypes[1]!.id;
  settings.brochure.format = "a4";
  settings.brochure.storesDisplay = "footer";
  settings.brochure.coverBackground.color = "#112233";
  settings.brochure.productBackground.color = "#aabbcc";
  settings.brochure.showCoverMessage = true;
  settings.brochure.priceLogo = "wordmark";
  settings.stores[0]!.visible = false;
  settings.categorySavingModes.TV = { mode: "percentage" };
  const create = vi.fn();
  const view = render(
    <CreateCampaign settings={settings} onCreate={create} onClose={vi.fn()} />,
  );
  fireEvent.change(
    view.getByDisplayValue(`Happy Hour ${new Date().getFullYear()}`),
    { target: { value: "My edited brochure" } },
  );
  fireEvent.click(view.getByRole("button", { name: "Create campaign →" }));
  expect(create).toHaveBeenCalledOnce();
  expect(create.mock.calls[0]?.[0]).toMatchObject({
    name: "My edited brochure",
    type: "Happy Hour",
    brochureFormat: "a4",
    autoProductLayout: true,
    includeStoresPage: false,
    includeStoresFooter: true,
    priceLogo: "wordmark",
    showCoverMessage: false,
    showCoverBand: false,
    tagline: "",
    coverBackgroundColor: "#112233",
    productBackgroundColor: "#aabbcc",
    categorySavingModes: { TV: { mode: "percentage" } },
  });
  expect(create.mock.calls[0]?.[0].selectedStoreIndexes).not.toContain(0);
  settings.stores[1]!.name = "Future settings edit";
  expect(create.mock.calls[0]?.[0].storesSnapshot.stores[1].name).toBe(
    "Albi Mall",
  );
});

it("keeps an explicit creation grid choice instead of applying the automatic MacBook default", () => {
  setLanguage("en");
  const create = vi.fn();
  const view = render(
    <CreateCampaign
      settings={resolveSettings(null)}
      onCreate={create}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(view.getByText("Customize design (optional)"));
  fireEvent.click(view.getByRole("button", { name: /Two products per row/ }));
  fireEvent.click(view.getByRole("button", { name: "Create campaign →" }));
  expect(create.mock.calls[0]?.[0]).toMatchObject({
    layout: "duo4",
    autoProductLayout: false,
  });
});
