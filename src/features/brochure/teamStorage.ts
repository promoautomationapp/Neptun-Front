import { loadSettings, persistSettings } from "../settings/settings.api";
import { resolveSettings } from "../settings/settings.schema";
import { z } from "zod";
import { request, ApiError } from "../../api/client";
import { setCampaignSaveStatus } from "./campaignSaveStatus";
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
export const getCampaigns = async (signal?: AbortSignal) =>
  (
    await request(
      "/api/team/campaigns?includeDisabled=true",
      z.object({ campaigns: z.array(campaignSchema) }),
      { signal },
    )
  ).campaigns;
export const getCampaign = async (id: string, signal?: AbortSignal) =>
  (
    await request(
      `/api/team/campaigns/${encodeURIComponent(id)}`,
      z.object({ campaign: campaignSchema }),
      { signal },
    )
  ).campaign;
const pendingSaves = new Map<
  string,
  { latest: Campaign | null; promise: Promise<Campaign> }
>();
const acknowledgedVersions = new Map<string, number>();
export function hasAcknowledgedCampaign(id: string): boolean {
  return acknowledgedVersions.has(id);
}
export function hasPendingSaves() {
  return pendingSaves.size > 0;
}
export function saveCampaign(campaign: Campaign): Promise<Campaign> {
  setCampaignSaveStatus(campaign.id, { state: "saving" });
  const pending = pendingSaves.get(campaign.id);
  if (pending) {
    pending.latest = campaign;
    return pending.promise;
  }
  const state: { latest: Campaign | null; promise: Promise<Campaign> } = {
    latest: campaign,
    promise: Promise.resolve(campaign),
  };
  pendingSaves.set(campaign.id, state);
  state.promise = (async () => {
    let saved = campaign;
    while (state.latest) {
      const next = state.latest;
      state.latest = null;
      const acknowledged = acknowledgedVersions.get(next.id);
      const version = acknowledged
        ? Math.max(acknowledged, next.version ?? 1)
        : next.version;
      saved = (
        await request(
          "/api/team/campaigns",
          z.object({ campaign: campaignSchema }),
          {
            method: "POST",
            body: { campaign: { ...next, ...(version ? { version } : {}) } },
          },
        )
      ).campaign;
      if (saved.version) acknowledgedVersions.set(saved.id, saved.version);
    }
    setCampaignSaveStatus(campaign.id, {
      state: "saved",
      savedAt: saved.updatedAt,
    });
    return saved;
  })()
    .catch((error) => {
      setCampaignSaveStatus(campaign.id, {
        state:
          error instanceof ApiError && error.code === "VERSION_CONFLICT"
            ? "conflict"
            : "error",
        message:
          error instanceof Error ? error.message : "Could not save changes.",
      });
      throw error;
    })
    .finally(() => pendingSaves.delete(campaign.id));
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
const getSettingsSnapshot = async () => {
  const snapshot = await loadSettings();
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
