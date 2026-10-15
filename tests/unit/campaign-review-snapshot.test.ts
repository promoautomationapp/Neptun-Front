import { afterEach, expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { setCampaignSaveStatus } from "../../src/features/brochure/campaignSaveStatus";
import { mergeCampaignSnapshots } from "../../src/features/brochure/mergeCampaignSnapshots";

const local: Campaign = {
  id: "review-snapshot-draft",
  name: "Local design edits",
  version: 3,
  updatedAt: "2026-10-15T11:00:00Z",
  products: [{ code: "one", name: "Local product", sale: 77 }],
  coverHeadline: "My unsaved heading",
  reviewPagePlacements: { old: 1 },
  status: "in_progress",
  reviewComments: [{ id: "old", text: "Original comment", pageIndex: 0 }],
  reviewHistory: [],
};
const remote: Campaign = {
  ...local,
  version: 4,
  updatedAt: "2026-10-15T12:00:00Z",
  name: "Another editor's design",
  products: [{ code: "one", name: "Remote product", sale: 99 }],
  coverHeadline: "Another heading",
  reviewPagePlacements: { old: 0 },
  status: "changes_requested",
  reviewComments: [
    { id: "old", text: "Resolved comment", pageIndex: 0, fixed: true },
    { id: "new", text: "Please verify the price", pageIndex: 1 },
  ],
  reviewHistory: [{ id: "review", action: "comment", commentId: "new" }],
};

afterEach(() => setCampaignSaveStatus(local.id, { state: "saved" }));

it("refreshes server reviews over a conflicted local design without accepting its newer document version", () => {
  setCampaignSaveStatus(local.id, { state: "conflict" });
  const merged = mergeCampaignSnapshots([local], [remote], local.id, true)[0];
  expect(merged).toEqual({
    ...local,
    status: remote.status,
    reviewComments: remote.reviewComments,
    reviewHistory: remote.reviewHistory,
  });
  expect(merged?.products).toBe(local.products);
  expect(merged?.reviewPagePlacements).toBe(local.reviewPagePlacements);
  expect(merged?.version).toBe(3);
  expect(merged?.updatedAt).toBe(local.updatedAt);
  expect(local.reviewComments).toHaveLength(1);
});

it("also keeps a newer local design while refreshing reviews, and accepts the full server snapshot once safe", () => {
  const olderRemote = { ...remote, updatedAt: "2026-10-15T10:00:00Z" };
  const merged = mergeCampaignSnapshots(
    [local],
    [olderRemote],
    local.id,
    true,
  )[0];
  expect(merged?.name).toBe(local.name);
  expect(merged?.version).toBe(local.version);
  expect(merged?.reviewComments).toEqual(remote.reviewComments);
  expect(mergeCampaignSnapshots([local], [remote], local.id, true)[0]).toBe(
    remote,
  );
  expect(
    mergeCampaignSnapshots([local], [olderRemote], local.id, false)[0],
  ).toBe(olderRemote);
});
