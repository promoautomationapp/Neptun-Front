import { expect, it, vi } from "vitest";
import {
  setCampaignSaveStatus,
  subscribeCampaignSaveStatus,
  campaignSaveStatus,
} from "../../src/features/brochure/campaignSaveStatus";
import {
  mergeCampaignSnapshots,
  confirmMissingCampaign,
} from "../../src/features/brochure/mergeCampaignSnapshots";
import { ApiError } from "../../src/api/client";
import type { Campaign } from "../../src/domain/models";

it("publishes saving and saved status for each campaign", () => {
  let notifications = 0;
  const unsubscribe = subscribeCampaignSaveStatus(() => notifications++);
  setCampaignSaveStatus("save-qa", { state: "saving" });
  expect(campaignSaveStatus("save-qa").state).toBe("saving");
  setCampaignSaveStatus("save-qa", {
    state: "saved",
    savedAt: "2026-10-14T10:00:00Z",
  });
  expect(notifications).toBe(2);
  unsubscribe();
});

it("accepts server disable and restore lifecycle changes even over a conflicted local draft", () => {
  const local: Campaign = {
    id: "lifecycle-qa",
    name: "Local unsaved edits",
    products: [],
    version: 2,
    updatedAt: "2026-10-15T12:00:00Z",
  };
  const disabled = {
    ...local,
    name: "Saved before disable",
    version: 3,
    disabledAt: "2026-10-15T11:00:00Z",
  };
  setCampaignSaveStatus(local.id, { state: "conflict" });
  expect(mergeCampaignSnapshots([local], [disabled], local.id, true)).toEqual([
    disabled,
  ]);
  const enabled = { ...disabled, version: 4, disabledAt: null };
  expect(mergeCampaignSnapshots([disabled], [enabled], local.id, true)).toEqual(
    [enabled],
  );
  setCampaignSaveStatus(local.id, { state: "saved" });
});

it("confirms missing persisted IDs directly before removing the active editor", async () => {
  const active: Campaign = {
    id: "missing-qa",
    name: "Previously saved",
    version: 2,
    products: [],
  };
  const get = vi.fn(async () => {
    throw new ApiError("Document not found.", 404);
  });
  const result = await confirmMissingCampaign([], active, true, get);
  expect(get).toHaveBeenCalledWith(active.id);
  expect(result.confirmedMissingId).toBe(active.id);
  expect(
    mergeCampaignSnapshots([active], result.remote, active.id, true, true),
  ).toEqual([]);
});

it("keeps never-persisted drafts and repairs incomplete lists without treating absence as disable", async () => {
  const active: Campaign = {
    id: "new-draft-qa",
    name: "Unsaved new brochure",
    products: [],
  };
  const get = vi.fn(async () => ({ ...active, version: 1 }));
  const localOnly = await confirmMissingCampaign([], active, false, get);
  expect(get).not.toHaveBeenCalled();
  expect(
    mergeCampaignSnapshots([active], localOnly.remote, active.id, true),
  ).toEqual([active]);
  const repaired = await confirmMissingCampaign([], active, true, get);
  expect(repaired.remote[0]?.version).toBe(1);
  expect(repaired.confirmedMissingId).toBeNull();
});

it("does not turn network, authentication or cancellation errors into document removal", async () => {
  const active: Campaign = {
    id: "offline-qa",
    name: "My draft",
    products: [],
    version: 3,
  };
  for (const error of [
    new ApiError("Offline", 503),
    new ApiError("Sign in", 401),
    new DOMException("Navigation changed", "AbortError"),
  ]) {
    await expect(
      confirmMissingCampaign([], active, true, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(mergeCampaignSnapshots([active], [], active.id, true)).toEqual([
      active,
    ]);
  }
});

it("keeps a conflicted local edit even when another editor has a newer server timestamp", () => {
  const local: Campaign = {
    id: "conflict-qa",
    name: "My current edits",
    products: [],
    updatedAt: "2026-10-14T10:00:00Z",
  };
  const remote = {
    ...local,
    name: "Other editor",
    updatedAt: "2026-10-14T10:01:00Z",
  };
  setCampaignSaveStatus(local.id, { state: "conflict" });
  expect(
    mergeCampaignSnapshots([local], [remote], local.id, true)[0]?.name,
  ).toBe(local.name);
  setCampaignSaveStatus(local.id, { state: "saved" });
  expect(
    mergeCampaignSnapshots([local], [remote], local.id, true)[0]?.name,
  ).toBe(remote.name);
});
