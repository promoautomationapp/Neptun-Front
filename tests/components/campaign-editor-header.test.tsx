import React from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CampaignEditorHeader } from "../../src/features/brochure/CampaignEditorHeader";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { Campaign } from "../../src/domain/models";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);
const campaign: Campaign = {
  id: "compact-header",
  name: "Autumn campaign",
  type: "Offers",
  startDate: "2026-11-05",
  endDate: "2026-11-15",
  status: "in_progress",
  products: [{ code: "tv", name: "TV" }],
};

it("keeps campaign context, workflow status and every navigation/action accessible in the compact header", () => {
  const onAllCampaigns = vi.fn();
  const onNewCampaign = vi.fn();
  const onMakeSocial = vi.fn();
  const onSubmit = vi.fn();
  const view = render(
    <CampaignEditorHeader
      campaign={campaign}
      pageCount={17}
      now={new Date("2026-11-05T12:00:00Z")}
      onAllCampaigns={onAllCampaigns}
      onNewCampaign={onNewCampaign}
      onMakeSocial={onMakeSocial}
    >
      <button onClick={onSubmit}>Send for PM review</button>
      <button disabled>Mark complete</button>
    </CampaignEditorHeader>,
  );
  expect(
    view.getByRole("heading", { level: 1, name: campaign.name }),
  ).toBeTruthy();
  const breadcrumb = view.getByRole("navigation", {
    name: "Campaign navigation",
  });
  expect(within(breadcrumb).getByText("Offers")).toBeTruthy();
  expect(
    within(breadcrumb).getByText(campaign.name).getAttribute("aria-current"),
  ).toBe("page");
  expect(view.getByLabelText("Workflow status: In progress")).toBeTruthy();
  expect(view.getByText("2026-11-05 — 2026-11-15")).toBeTruthy();
  expect(view.getByText("1 products")).toBeTruthy();
  expect(view.getByText("17 brochure pages")).toBeTruthy();
  expect(view.getByText("Saved for the team")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "← All campaigns" }));
  fireEvent.click(view.getByRole("button", { name: "＋ New campaign" }));
  fireEvent.click(view.getByRole("button", { name: "Create social post" }));
  fireEvent.click(view.getByRole("button", { name: "Send for PM review" }));
  expect(onAllCampaigns).toHaveBeenCalledOnce();
  expect(onNewCampaign).toHaveBeenCalledOnce();
  expect(onMakeSocial).toHaveBeenCalledOnce();
  expect(onSubmit).toHaveBeenCalledOnce();
  expect(
    (view.getByRole("button", { name: "Mark complete" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it("handles campaigns without dates or social permission and preserves ended-period status", () => {
  const view = render(
    <CampaignEditorHeader
      campaign={{ ...campaign, startDate: undefined, endDate: undefined }}
      pageCount={1}
      onAllCampaigns={vi.fn()}
      onNewCampaign={vi.fn()}
    />,
  );
  expect(view.container.textContent).not.toContain("undefined");
  expect(view.queryByRole("button", { name: "Create social post" })).toBeNull();
  view.rerender(
    <CampaignEditorHeader
      campaign={campaign}
      pageCount={17}
      now={new Date("2026-11-20T12:00:00Z")}
      onAllCampaigns={vi.fn()}
      onNewCampaign={vi.fn()}
    />,
  );
  expect(view.getByLabelText("Workflow status: In progress")).toBeTruthy();
  expect(view.getByText("Offer period ended")).toBeTruthy();
});
