import { loadSettings, persistSettings } from "../settings/settings.api";
import { resolveSettings } from "../settings/settings.schema";
import { z } from "zod";
import { request } from "../../api/client";
import { campaignSchema } from "../../domain/schemas";
import type { Campaign, JsonValue, Settings } from "../../domain/models";

export { getSession, login, logout } from "../auth/auth.api";
export const getMembers = async () =>
  (
    await request(
      "/api/team/members",
      z.object({
        members: z.array(
          z.object({ email: z.string(), role: z.enum(["pm", "staff", "admin", "superadmin"]) }),
        ),
      }),
    )
  ).members;
export const getCampaigns = async () =>
  (
    await request(
      "/api/team/campaigns",
      z.object({ campaigns: z.array(campaignSchema) }),
    )
  ).campaigns;
export const getCampaign = async (id: string) =>
  (
    await request(
      `/api/team/campaigns/${encodeURIComponent(id)}`,
      z.object({ campaign: campaignSchema }),
    )
  ).campaign;
const pendingSaves = new Map<
  string,
  { latest: Campaign | null; promise: Promise<Campaign> }
>();
const acknowledgedVersions = new Map<string, number>();
export function hasPendingSaves() {
  return pendingSaves.size > 0;
}
export function saveCampaign(campaign: Campaign): Promise<Campaign> {
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
    return saved;
  })().finally(() => pendingSaves.delete(campaign.id));
  return state.promise;
}
export async function removeCampaign(id: string) {
  await pendingSaves.get(id)?.promise;
  return request(
    `/api/team/campaigns/${encodeURIComponent(id)}`,
    z.object({ deleted: z.boolean() }),
    { method: "DELETE" },
  );
}
let settingsVersion: number | undefined;
export const getSettings = async () => {
  const snapshot = await loadSettings();
  settingsVersion = snapshot.version;
  return snapshot.settings;
};
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
  const [campaigns, settings] = await Promise.all([
    getCampaigns(),
    getSettings(),
  ]);
  return { campaigns, settings };
}
