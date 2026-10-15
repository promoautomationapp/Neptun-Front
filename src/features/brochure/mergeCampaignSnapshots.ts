import type { Campaign } from "../../domain/models";
import { hasUnsavedCampaign } from "./campaignSaveStatus";
import { ApiError } from "../../api/client";
// A refresh may start before a newly created or edited campaign is saved and
// finish afterward. Keep the current editor draft until the server catches up.
export function mergeCampaignSnapshots(
  current: Campaign[],
  remote: Campaign[],
  activeId: string | null,
  isEditing: boolean,
  missingActiveConfirmed = false,
) {
  if (!isEditing || !activeId) return remote;
  const active = current.find((item) => item.id === activeId);
  if (!active) return remote;
  const saved = remote.find((item) => item.id === activeId);
  if (!saved) return missingActiveConfirmed ? remote : [active, ...remote];
  // Disable/restore are authoritative lifecycle changes, even when a local edit is dirty.
  if (saved.disabledAt || active.disabledAt) return remote;
  const localTime = Date.parse(active.updatedAt || "") || 0;
  const savedTime = Date.parse(saved.updatedAt || "") || 0;
  return hasUnsavedCampaign(activeId) || localTime > savedTime
    ? remote.map((item) => (item.id === activeId ? active : item))
    : remote;
}

/** A partial/stale list is not proof that an editor draft was disabled. Confirm persisted IDs directly. */
export async function confirmMissingCampaign(
  remote: Campaign[],
  active: Campaign | undefined,
  knownPersisted: boolean,
  fetchCampaign: (id: string) => Promise<Campaign>,
): Promise<{ remote: Campaign[]; confirmedMissingId: string | null }> {
  if (
    !active ||
    !knownPersisted ||
    remote.some((item) => item.id === active.id)
  )
    return { remote, confirmedMissingId: null };
  try {
    const saved = await fetchCampaign(active.id);
    return { remote: [saved, ...remote], confirmedMissingId: null };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404)
      return { remote, confirmedMissingId: active.id };
    // Authentication/network errors must leave current drafts intact.
    throw error;
  }
}
