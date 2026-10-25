import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { CampaignStatus } from "../../src/features/campaigns/CampaignStatus";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);

const now = new Date("2026-10-25T12:00:00Z");
const expired = { startDate: "2026-10-14", endDate: "2026-10-20" };

it.each([
  ["in_progress", "In progress"],
  ["in_review", "In review"],
  ["changes_requested", "Changes requested"],
  ["completed", "Completed"],
])("keeps %s primary when the offer period ends", (status, label) => {
  const campaign = { ...expired, status };
  const view = render(
    <div className="cs-editor-progress">
      <CampaignStatus campaign={campaign} now={now} />
    </div>,
  );
  const workflow = view.getByLabelText(`Workflow status: ${label}`);
  const expiry = view.getByText("Offer period ended");
  expect(workflow.textContent).toBe(label);
  expect(expiry.parentElement).toBe(workflow.parentElement);
  expect(workflow.contains(expiry)).toBe(false);
  expect(workflow.classList.contains("status-expired")).toBe(false);
  expect(campaign.status).toBe(status);
});

it("defaults an undated draft to In progress and clears expiry when dates are extended", () => {
  const view = render(<CampaignStatus campaign={{}} now={now} />);
  expect(view.getByLabelText("Workflow status: In progress")).toBeTruthy();
  expect(view.queryByText("Offer period ended")).toBeNull();
  view.rerender(
    <CampaignStatus
      campaign={{ ...expired, status: "in_progress" }}
      now={now}
    />,
  );
  expect(view.getByText("Offer period ended")).toBeTruthy();
  view.rerender(
    <CampaignStatus
      campaign={{ ...expired, endDate: "2026-10-30", status: "in_progress" }}
      now={now}
    />,
  );
  expect(view.getByLabelText("Workflow status: In progress")).toBeTruthy();
  expect(view.queryByText("Offer period ended")).toBeNull();
});

it("distinguishes an ended offer from completed work in Albanian", () => {
  setLanguage("sq");
  const view = render(
    <CampaignStatus
      campaign={{ ...expired, status: "in_progress" }}
      now={now}
    />,
  );
  expect(view.getByLabelText("Statusi i punës: Në proces").textContent).toBe(
    "Në proces",
  );
  expect(view.getByText("Afati i ofertës ka skaduar")).toBeTruthy();
  expect(view.queryByText(/Ka përfunduar/)).toBeNull();
});

it("keeps deleted library cards labelled as deleted", () => {
  const view = render(
    <CampaignStatus
      campaign={{ ...expired, status: "completed", disabledAt: "2026-10-24" }}
      now={now}
      surface="library"
    />,
  );
  expect(view.getByText("Deleted")).toBeTruthy();
  expect(view.queryByText("Completed")).toBeNull();
  expect(view.queryByText("Offer period ended")).toBeNull();
});
