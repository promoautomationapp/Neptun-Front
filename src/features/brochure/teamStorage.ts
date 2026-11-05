import { loadSettings, persistSettings } from "../settings/settings.api";
import { resolveSettings } from "../settings/settings.schema";
import { z } from "zod";
import { request, ApiError, normalizeApiDocument } from "../../api/client";
import { setCampaignSaveStatus } from "./campaignSaveStatus";
import { campaignEditSignature } from "./campaignEditHistory";
import {
  campaignDraft,
  campaignSaveOwner,
  forgetCampaignDraft,
  recoverCampaignDrafts,
  rememberCampaignDraft,
  subscribeCampaignSaveOwner,
  type CampaignDraft,
} from "./campaignDraftRecovery";
import { campaignSchema } from "../../domain/schemas";
import type { Campaign, JsonValue, Settings } from "../../domain/models";

export { getSession, login, logout } from "../auth/auth.api";
export const getMembers = async () =>
  (
    await request(
      "/api/team/members",
      z.object({
        members: z.array(
          z.object({
            id: z.string().optional(),
            name: z.string().optional(),
            username: z.string().optional(),
            email: z.string(),
            role: z.enum(["pm", "staff", "admin", "superadmin"]),
          }),
        ),
      }),
    )
  ).members;
const fetchCampaign = async (id: string, signal?: AbortSignal) =>
  (
    await request(
      `/api/team/campaigns/${encodeURIComponent(id)}`,
      z.object({ campaign: campaignSchema }),
      { signal },
    )
  ).campaign;
export const getCampaigns = async (signal?: AbortSignal) =>
  recoverCampaignDrafts(
    (
      await request(
        "/api/team/campaigns?includeDisabled=true",
        z.object({ campaigns: z.array(campaignSchema) }),
        { signal },
      )
    ).campaigns,
  );
export const getCampaign = async (id: string, signal?: AbortSignal) =>
  recoverCampaignDrafts([await fetchCampaign(id, signal)]).find(
    (item) => item.id === id,
  )!;
interface PendingSave {
  latest: Campaign | null;
  promise: Promise<Campaign>;
  controller: AbortController;
}
const pendingSaves = new Map<string, PendingSave>();
const acknowledgedVersions = new Map<string, number>();
subscribeCampaignSaveOwner(() => {
  for (const pending of pendingSaves.values()) pending.controller.abort();
  pendingSaves.clear();
  acknowledgedVersions.clear();
});
export function hasAcknowledgedCampaign(id: string): boolean {
  return acknowledgedVersions.has(id);
}
export function hasPendingSaves() {
  return pendingSaves.size > 0;
}
function saveSignature(campaign: Campaign) {
  return campaignEditSignature(normalizeApiDocument(campaign));
}
function transientSaveError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError &&
      ([408, 429].includes(error.status) || error.status >= 500))
  );
}
function waitForRetry(milliseconds: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, Math.max(0, milliseconds));
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}
/** A lost response is not proof of a failed write. Never replay against a newer
 * server version unless that exact attempted edit was already acknowledged. */
async function reconcileSave(
  attempted: Campaign,
  signal: AbortSignal,
): Promise<Campaign | null> {
  let remote: Campaign;
  try {
    remote = await fetchCampaign(attempted.id, signal);
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 404 &&
      attempted.version === undefined
    )
      return null;
    throw error;
  }
  if (!remote.disabledAt && saveSignature(remote) === saveSignature(attempted))
    return remote;
  if (
    !remote.disabledAt &&
    attempted.version !== undefined &&
    remote.version === attempted.version
  )
    return null;
  throw new ApiError(
    "This document was changed by another team member. Reload it before saving.",
    409,
    "VERSION_CONFLICT",
  );
}
export function retryCampaignSave(id: string): Promise<Campaign> {
  const draft = campaignDraft(id);
  if (!draft) return Promise.reject(new Error("No unsaved changes to retry."));
  return saveCampaign(draft.latest);
}
export function saveCampaign(campaign: Campaign): Promise<Campaign> {
  const owner = campaignSaveOwner();
  if (!owner) return Promise.reject(new ApiError("Sign in to continue.", 401));
  const pending = pendingSaves.get(campaign.id);
  if (pending) {
    pending.latest = structuredClone(campaign);
    rememberCampaignDraft({
      ...campaignDraft(campaign.id),
      latest: pending.latest,
    });
    return pending.promise;
  }
  const recovered = campaignDraft(campaign.id);
  const draft: CampaignDraft = {
    ...recovered,
    latest: structuredClone(campaign),
  };
  rememberCampaignDraft(draft);
  const state: PendingSave = {
    latest: draft.latest,
    promise: Promise.resolve(campaign),
    controller: new AbortController(),
  };
  pendingSaves.set(campaign.id, state);
  const signal = state.controller.signal;
  const active = () => owner === campaignSaveOwner() && !signal.aborted;
  const remember = () => {
    if (active())
      rememberCampaignDraft({ ...draft, latest: state.latest ?? draft.latest });
  };
  setCampaignSaveStatus(campaign.id, {
    state: "saving",
    retryAt: draft.retryAt,
  });
  state.promise = (async () => {
    let saved = campaign;
    // Debounce rapid pointer/typing changes into the latest full snapshot.
    await waitForRetry(300, signal);
    if (draft.retryAt && draft.retryAt > Date.now())
      await waitForRetry(draft.retryAt - Date.now(), signal);
    if (draft.attempted) {
      const reconciled = await reconcileSave(draft.attempted, signal);
      if (reconciled?.version)
        acknowledgedVersions.set(reconciled.id, reconciled.version);
      if (
        reconciled &&
        saveSignature(state.latest!) === saveSignature(draft.attempted)
      ) {
        saved = reconciled;
        state.latest = null;
      }
    }
    let retries = 0;
    while (state.latest) {
      signal.throwIfAborted();
      const next = state.latest;
      draft.latest = next;
      state.latest = null;
      const acknowledged = acknowledgedVersions.get(next.id);
      const version = acknowledged
        ? Math.max(acknowledged, next.version ?? 1)
        : next.version;
      const attempted = { ...next, ...(version ? { version } : {}) };
      draft.attempted = attempted;
      draft.message = undefined;
      draft.retryAt = undefined;
      remember();
      try {
        saved = (
          await request(
            "/api/team/campaigns",
            z.object({ campaign: campaignSchema }),
            {
              method: "POST",
              body: { campaign: attempted },
              signal,
            },
          )
        ).campaign;
      } catch (error) {
        if (!active() || !transientSaveError(error) || retries >= 2)
          throw error;
        retries += 1;
        draft.message =
          error instanceof Error ? error.message : "Could not save changes.";
        draft.retryAt =
          Date.now() +
          (error instanceof ApiError
            ? (error.retryAfterSeconds ?? 2 ** retries)
            : 2 ** retries) *
            1000;
        state.latest ??= next;
        remember();
        setCampaignSaveStatus(campaign.id, {
          state: "saving",
          message: draft.message,
          retryAt: draft.retryAt,
        });
        await waitForRetry(draft.retryAt - Date.now(), signal);
        const reconciled = await reconcileSave(attempted, signal);
        if (reconciled) {
          saved = reconciled;
          if (saved.version) acknowledgedVersions.set(saved.id, saved.version);
          if (saveSignature(state.latest) === saveSignature(attempted))
            state.latest = null;
        }
        // An unchanged version is safe to retry with the latest coalesced edits.
        continue;
      }
      signal.throwIfAborted();
      if (saved.version) acknowledgedVersions.set(saved.id, saved.version);
      draft.attempted = undefined;
      remember();
      if (state.latest) await waitForRetry(300, signal);
    }
    if (active()) {
      forgetCampaignDraft(campaign.id);
      setCampaignSaveStatus(campaign.id, {
        state: "saved",
        savedAt: saved.updatedAt,
      });
    }
    return saved;
  })()
    .catch((error) => {
      if (active()) {
        const current = campaignDraft(campaign.id);
        draft.latest = state.latest ?? current?.latest ?? draft.latest;
        draft.message =
          error instanceof Error ? error.message : "Could not save changes.";
        if (error instanceof ApiError && error.retryAfterSeconds)
          draft.retryAt = Date.now() + error.retryAfterSeconds * 1000;
        draft.conflict =
          error instanceof ApiError && error.code === "VERSION_CONFLICT";
        rememberCampaignDraft(draft);
        setCampaignSaveStatus(campaign.id, {
          state:
            error instanceof ApiError && error.code === "VERSION_CONFLICT"
              ? "conflict"
              : "error",
          message: draft.message,
          retryAt: draft.retryAt,
        });
      }
      throw error;
    })
    .finally(() => {
      if (pendingSaves.get(campaign.id) === state)
        pendingSaves.delete(campaign.id);
    });
  return state.promise;
}
export async function removeCampaign(id: string, version?: number) {
  await pendingSaves.get(id)?.promise;
  const currentVersion = Math.max(
    acknowledgedVersions.get(id) ?? 0,
    version ?? 0,
  );
  const result = await request(
    `/api/team/campaigns/${encodeURIComponent(id)}${currentVersion ? `?version=${currentVersion}` : ""}`,
    z.object({ deleted: z.boolean() }),
    { method: "DELETE" },
  );
  if (!result.deleted)
    throw new Error("Could not disable the campaign. Refresh and try again.");
  return result;
}
export async function restoreCampaign(campaign: Campaign): Promise<Campaign> {
  const result = await request(
    `/api/team/campaigns/${encodeURIComponent(campaign.id)}/restore`,
    z.object({ campaign: campaignSchema }),
    {
      method: "POST",
      body: campaign.version ? { version: campaign.version } : {},
    },
  );
  if (result.campaign.version)
    acknowledgedVersions.set(campaign.id, result.campaign.version);
  return result.campaign;
}

let settingsVersion: number | undefined;
export const getSettingsSnapshot = async (signal?: AbortSignal) => {
  const snapshot = await loadSettings(signal);
  settingsVersion = snapshot.version;
  return snapshot;
};
export const getSettings = async () => (await getSettingsSnapshot()).settings;
export const saveSettings = async (settings: Settings) => {
  if (settingsVersion === undefined) await getSettings();
  const snapshot = await persistSettings(
    resolveSettings(settings),
    settingsVersion ?? 0,
  );
  settingsVersion = snapshot.version;
  return snapshot;
};

export async function reviewCampaign(
  id: string,
  action: string,
  details: Record<string, JsonValue> = {},
) {
  await pendingSaves.get(id)?.promise;
  const saved = (
    await request(
      `/api/team/campaigns/${encodeURIComponent(id)}/review`,
      z.object({ campaign: campaignSchema }),
      { method: "POST", body: { action, ...details } },
    )
  ).campaign;
  if (saved.version) acknowledgedVersions.set(saved.id, saved.version);
  return saved;
}
export async function bootstrapWorkspace() {
  const [campaigns, settingsSnapshot] = await Promise.all([
    getCampaigns(),
    getSettingsSnapshot(),
  ]);
  return { campaigns, settings: settingsSnapshot.settings, settingsSnapshot };
}
