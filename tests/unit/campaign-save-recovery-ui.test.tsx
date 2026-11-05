import { afterEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { CampaignActivityStatus } from "../../src/features/brochure/CampaignActivityStatus";
import {
  clearCampaignSaveStatuses,
  setCampaignSaveStatus,
} from "../../src/features/brochure/campaignSaveStatus";
import { setLanguage } from "../../src/features/brochure/i18n";
const { retry, heartbeat } = vi.hoisted(() => ({
  retry: vi.fn().mockResolvedValue({}),
  heartbeat: vi.fn().mockResolvedValue({ participants: [] }),
}));
vi.mock("../../src/features/brochure/teamStorage", () => ({
  retryCampaignSave: retry,
}));
vi.mock("../../src/api/client", () => ({
  request: heartbeat,
  apiFetch: vi.fn().mockResolvedValue({}),
}));
afterEach(() => {
  cleanup();
  clearCampaignSaveStatuses();
  setLanguage("sq");
});
test("shows the localized failure reason and explicit retry", async () => {
  setLanguage("sq");
  setCampaignSaveStatus("ui-save", {
    state: "error",
    message: "Could not save changes.",
  });
  await act(async () => {
    render(
      <CampaignActivityStatus
        campaignId="ui-save"
        mode="edit"
        pageLabel="Kopertina"
      />,
    );
  });
  expect(screen.getByText("Ndryshimet nuk mund të ruheshin.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Riprovo ruajtjen" }));
  expect(retry).toHaveBeenCalledWith("ui-save");
});
test("disables explicit retries during the supplied cooldown", async () => {
  setLanguage("en");
  setCampaignSaveStatus("cooldown-save", {
    state: "error",
    message: "Could not save changes.",
    retryAt: Date.now() + 5000,
  });
  await act(async () => {
    render(
      <CampaignActivityStatus
        campaignId="cooldown-save"
        mode="edit"
        pageLabel="Cover"
      />,
    );
  });
  expect(
    (screen.getByRole("button", { name: /Retry save/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
