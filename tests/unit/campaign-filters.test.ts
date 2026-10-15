import { describe, it, expect } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  campaignToday,
  emptyCampaignFilters,
  filterCampaigns,
  normalizeCampaignFilters,
} from "../../src/features/campaigns/campaignFilters";
const now = new Date("2026-10-15T10:00:00Z");
const campaigns = [
  {
    id: "past",
    name: "Oferta vjeshtore",
    type: "Custom type",
    startDate: "2026-10-01",
    endDate: "2026-10-14",
    status: "completed",
    brochureFormat: "square1080",
    updatedAt: "2026-10-01T00:00:00Z",
    products: [],
  },
  {
    id: "current",
    name: "Ditët e ofertave",
    type: "Black Friday",
    startDate: "2026-10-14",
    endDate: "2026-10-16",
    status: "in_review",
    brochureFormat: "a4",
    updatedAt: "2026-10-16T00:00:00Z",
    products: [
      {
        code: "set",
        name: "Set",
        bundleProducts: [
          { code: "84012345", name: "TV Samsung", brand: "SAMSUNG" },
        ],
      },
    ],
  },
  {
    id: "day",
    name: "Happy Day",
    type: "Custom type",
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    brochureFormat: "square1080",
    updatedAt: "2026-10-15T00:00:00Z",
    products: [],
  },
  {
    id: "future",
    name: "Winter",
    type: "Black Friday",
    startDate: "2026-10-20",
    endDate: "2026-10-25",
    updatedAt: "2026-10-14T00:00:00Z",
    products: [],
  },
  { id: "draft", name: "Undated draft", type: "Other", products: [] },
] as Campaign[];
const ids = (change: Partial<typeof emptyCampaignFilters>) =>
  filterCampaigns(campaigns, { ...emptyCampaignFilters, ...change }, now).map(
    (item) => item.id,
  );
describe("brochure library filters", () => {
  it("classifies dates in the workspace timezone and keeps undated drafts out of dated periods", () => {
    expect(campaignToday(new Date("2026-10-14T22:30:00Z"))).toBe("2026-10-15");
    expect(ids({ period: "past" })).toEqual(["past"]);
    expect(ids({ period: "current" })).toEqual(["current", "day"]);
    expect(ids({ period: "upcoming" })).toEqual(["future"]);
    expect(ids({ period: "one_day" })).toEqual(["day"]);
    expect(ids({})).toContain("draft");
  });
  it("uses inclusive date overlap rather than excluding campaigns that span a chosen date", () => {
    expect(ids({ from: "2026-10-15", to: "2026-10-15" })).toEqual([
      "current",
      "day",
    ]);
    expect(ids({ from: "2026-10-16", to: "2026-10-20" })).toEqual([
      "current",
      "future",
    ]);
  });
  it("combines status, configured or historical type, format and accent-insensitive search including bundle members", () => {
    expect(
      ids({
        status: "in_review",
        type: "Black Friday",
        format: "a4",
        query: "samsung 84012345 ditet",
      }),
    ).toEqual(["current"]);
    expect(ids({ type: "Custom type", format: "square1080" })).toEqual([
      "day",
      "past",
    ]);
    expect(ids({ status: "completed", query: "Samsung" })).toEqual([]);
  });
  it("normalizes corrupt or stale browser preferences without hiding the full library", () => {
    expect(
      normalizeCampaignFilters({
        query: 15,
        status: "deleted",
        period: "wrong",
        sort: "wrong",
        from: "2026-02-31",
        to: "bad",
      }),
    ).toEqual(emptyCampaignFilters);
    expect(
      normalizeCampaignFilters({ from: "2026-10-20", to: "2026-10-01" }),
    ).toMatchObject({ from: "2026-10-01", to: "2026-10-20" });
    expect(normalizeCampaignFilters(["invalid"])).toEqual(emptyCampaignFilters);
  });
  it("sorts deterministically without mutating campaigns and keeps undated drafts after dated entries", () => {
    const original = campaigns.map((item) => item.id);
    expect(ids({ sort: "updated_asc" })).toEqual([
      "draft",
      "past",
      "future",
      "day",
      "current",
    ]);
    expect(ids({ sort: "start_asc" })).toEqual([
      "past",
      "current",
      "day",
      "future",
      "draft",
    ]);
    expect(ids({ sort: "start_desc" })).toEqual([
      "future",
      "day",
      "current",
      "past",
      "draft",
    ]);
    expect(campaigns.map((item) => item.id)).toEqual(original);
  });
});

it("hides disabled brochures by default and keeps their original content when filtering the archive", () => {
  const disabled = { ...campaigns[0]!, disabledAt: "2026-10-15T10:00:00Z" };
  const list = [disabled, ...campaigns.slice(1)];
  expect(
    filterCampaigns(list, emptyCampaignFilters, now).some(
      (item) => item.id === disabled.id,
    ),
  ).toBe(false);
  expect(
    filterCampaigns(
      list,
      { ...emptyCampaignFilters, visibility: "disabled" },
      now,
    ),
  ).toEqual([disabled]);
  expect(
    filterCampaigns(list, { ...emptyCampaignFilters, visibility: "all" }, now),
  ).toHaveLength(campaigns.length);
  expect(disabled.disabledAt).toBe("2026-10-15T10:00:00Z");
});
