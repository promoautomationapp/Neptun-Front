import React from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import { CampaignLibrary } from "../../src/features/studio/Studio";
import { setLanguage } from "../../src/features/brochure/i18n";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import type { Campaign } from "../../src/domain/models";
beforeEach(() => {
  setLanguage("en");
  localStorage.removeItem("neptun-campaign-filters");
});
afterEach(() => {
  cleanup();
  localStorage.removeItem("neptun-campaign-filters");
});
const campaigns = [
  {
    id: "1",
    name: "Autumn sale",
    type: "Autumn offer",
    startDate: "2026-10-15",
    endDate: "2026-10-20",
    status: "in_review",
    brochureFormat: "square1080",
    products: [],
  },
  {
    id: "2",
    name: "Winter sale",
    type: "Historical type",
    startDate: "2026-11-01",
    endDate: "2026-11-10",
    status: "completed",
    brochureFormat: "a4",
    products: [],
  },
] as Campaign[];
const props = {
  campaigns,
  onCreate: () => {},
  onOpen: () => {},
  onDuplicate: () => {},
  onDelete: () => {},
  onPrint: () => {},
};
it("filters real library cards, includes Settings campaign types and historical types, persists and clears filters", () => {
  const settings = resolveSettings(null);
  settings.campaignTypes = [
    { id: "autumn", name: "Autumn offer", tagline: "", visible: true },
    { id: "spring", name: "Spring offer", tagline: "", visible: true },
  ];
  settings.defaultCampaignTypeId = "autumn";
  const view = render(<CampaignLibrary {...props} settings={settings} />);
  const cards = () =>
    [...view.container.querySelectorAll(".cs-campaign-card-title strong")].map(
      (item) => item.textContent,
    );
  expect(cards()).toHaveLength(2);
  fireEvent.click(view.getByRole("button", { name: "Filters" }));
  fireEvent.click(view.getByRole("button", { name: "Type" }));
  const list = view.getByRole("listbox", { name: "Type" });
  expect(
    within(list).getByRole("option", { name: "Spring offer" }),
  ).toBeTruthy();
  expect(
    within(list).getByRole("option", { name: "Historical type" }),
  ).toBeTruthy();
  fireEvent.click(within(list).getByRole("option", { name: "Autumn offer" }));
  expect(cards()).toEqual(["Autumn sale"]);
  fireEvent.click(view.getByRole("button", { name: "Status" }));
  fireEvent.click(view.getByRole("option", { name: "Completed" }));
  expect(cards()).toHaveLength(0);
  expect(view.getByText("No campaigns match these filters")).toBeTruthy();
  fireEvent.click(view.getAllByRole("button", { name: "Clear filters" })[0]!);
  expect(cards()).toHaveLength(2);
  fireEvent.click(view.getByRole("button", { name: "Format" }));
  fireEvent.click(view.getByRole("option", { name: /A4 ·/ }));
  expect(cards()).toEqual(["Winter sale"]);
  expect(
    JSON.parse(localStorage.getItem("neptun-campaign-filters") || "{}").format,
  ).toBe("a4");
  fireEvent.click(view.getAllByRole("button", { name: "Clear filters" })[0]!);
  fireEvent.change(view.getByRole("searchbox"), {
    target: { value: "Autumn" },
  });
  expect(cards()).toEqual(["Autumn sale"]);
});
it("ignores an obsolete saved type and format instead of silently returning no cards", () => {
  localStorage.setItem(
    "neptun-campaign-filters",
    JSON.stringify({
      type: "Removed type",
      format: "obsolete",
      status: "invalid",
    }),
  );
  const view = render(<CampaignLibrary {...props} />);
  expect(
    view.container.querySelectorAll(".cs-campaign-card-title strong"),
  ).toHaveLength(2);
  fireEvent.click(view.getByRole("button", { name: "Filters" }));
  expect(view.getByRole("button", { name: "Type" }).textContent).toBe(
    "All types",
  );
  expect(view.getByRole("button", { name: "Format" }).textContent).toBe(
    "All formats",
  );
});

it("keeps the search inside compact filters and separates readable card actions", () => {
  const onDuplicate = vi.fn(),
    onDelete = vi.fn(),
    onOpen = vi.fn(),
    onPrint = vi.fn();
  const view = render(
    <CampaignLibrary
      {...props}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onOpen={onOpen}
      onPrint={onPrint}
    />,
  );
  expect(view.container.querySelector(".cs-hero")).toBeNull();
  const filters = view.getByRole("region", { name: "Campaign filters" });
  expect(within(filters).getByRole("searchbox")).toBeTruthy();
  expect(
    view.getByRole("button", { name: "Filters" }).getAttribute("aria-expanded"),
  ).toBe("false");
  expect(view.queryByRole("button", { name: "Status" })).toBeNull();
  const card = view.container.querySelector(".cs-campaign-card") as HTMLElement;
  expect(card.querySelector(".cs-campaign-type")?.textContent).toBe(
    "Autumn offer",
  );
  expect(
    card.querySelector(".cs-campaign-cover .cs-campaign-badges"),
  ).toBeNull();
  fireEvent.click(
    within(card).getByRole("button", {
      name: "Duplicate campaign: Autumn sale",
    }),
  );
  fireEvent.click(
    within(card).getByRole("button", { name: "Delete campaign: Autumn sale" }),
  );
  fireEvent.click(
    within(card).getByRole("button", { name: "Open campaign: Autumn sale" }),
  );
  fireEvent.click(
    within(card).getByRole("button", { name: "Download brochure" }),
  );
  expect(onDuplicate).toHaveBeenCalledWith(campaigns[0]);
  expect(onDelete).toHaveBeenCalledWith(campaigns[0]);
  expect(onOpen).toHaveBeenCalledWith("1");
  expect(onPrint).toHaveBeenCalledWith("1");
});
