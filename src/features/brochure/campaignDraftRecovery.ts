import { campaignSchema } from "../../domain/schemas";
import type { Campaign } from "../../domain/models";
import {
  setCampaignSaveStatus,
  clearCampaignSaveStatuses,
} from "./campaignSaveStatus";

export interface CampaignDraft {
  latest: Campaign;
  attempted?: Campaign;
  message?: string;
  retryAt?: number;
  conflict?: boolean;
}
interface Owner {
  id: string;
  organizationId: string;
}
const prefix = "neptun-campaign-draft:v1:";
let ownerKey: string | null = null;
const drafts = new Map<string, CampaignDraft>();
const ownerListeners = new Set<() => void>();
export const campaignSaveOwner = () => ownerKey;
export function subscribeCampaignSaveOwner(listener: () => void) {
  ownerListeners.add(listener);
  return () => {
    ownerListeners.delete(listener);
  };
}
export function setCampaignSaveOwner(owner: Owner | null, discard = false) {
  const next = owner ? `${owner.organizationId}:${owner.id}:` : null;
  if (discard && ownerKey) {
    try {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith(prefix + ownerKey)) sessionStorage.removeItem(key);
    } catch {
      /* A blocked browser store must not prevent sign-out. */
    }
  }
  if (next === ownerKey && !discard) return;
  ownerKey = next;
  drafts.clear();
  clearCampaignSaveStatuses();
  for (const listener of ownerListeners) listener();
  if (!next) return;
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (!key.startsWith(prefix + next)) continue;
      try {
        const value = JSON.parse(sessionStorage.getItem(key) || "null");
        const latest = campaignSchema.parse(value.latest);
        if (key !== prefix + next + latest.id) continue;
        const attempted = value.attempted
          ? campaignSchema.parse(value.attempted)
          : undefined;
        if (attempted && attempted.id !== latest.id) continue;
        const draft: CampaignDraft = {
          latest,
          attempted,
          conflict: value.conflict === true,
          message:
            typeof value.message === "string"
              ? value.message
              : "Recovered unsaved changes. Retry saving to sync this brochure.",
          retryAt:
            typeof value.retryAt === "number" && Number.isFinite(value.retryAt)
              ? value.retryAt
              : undefined,
        };
        drafts.set(latest.id, draft);
        setCampaignSaveStatus(latest.id, {
          state: draft.conflict ? "conflict" : "error",
          message: draft.message,
          retryAt: draft.retryAt,
        });
      } catch {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    /* In-memory recovery remains available when storage is blocked. */
  }
}
export const campaignDraft = (id: string) => drafts.get(id);
export function rememberCampaignDraft(draft: CampaignDraft) {
  drafts.set(draft.latest.id, draft);
  if (!ownerKey) return;
  try {
    sessionStorage.setItem(
      prefix + ownerKey + draft.latest.id,
      JSON.stringify(draft),
    );
  } catch {
    /* Keep the current tab draft even when its storage quota is full. */
  }
}
export function forgetCampaignDraft(id: string) {
  drafts.delete(id);
  if (ownerKey)
    try {
      sessionStorage.removeItem(prefix + ownerKey + id);
    } catch {
      /* Optional store. */
    }
}
export function recoverCampaignDrafts(remote: Campaign[]): Campaign[] {
  const ids = new Set(remote.map((item) => item.id));
  const merged = remote.map((saved) => {
    const draft = drafts.get(saved.id);
    if (!draft) return saved;
    if (saved.disabledAt) {
      draft.conflict = true;
      draft.message =
        "This brochure was disabled. Your unsaved draft is kept for recovery.";
      rememberCampaignDraft(draft);
      setCampaignSaveStatus(saved.id, {
        state: "conflict",
        message: draft.message,
      });
      return saved;
    }
    return {
      ...draft.latest,
      status: saved.status,
      reviewComments: saved.reviewComments,
      reviewHistory: saved.reviewHistory,
    };
  });
  for (const draft of drafts.values())
    if (!ids.has(draft.latest.id)) merged.push(draft.latest);
  return merged;
}
if (typeof window !== "undefined")
  window.addEventListener("neptun:session-expired", () =>
    setCampaignSaveOwner(null),
  );
