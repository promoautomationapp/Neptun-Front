import { z } from "zod";
import { request } from "../../api/client";
import { workspaceSettingsSchema } from "./settings.schema";
import type { WorkspaceSettings } from "./settings.schema";
const snapshotSchema = z.object({
  settings: workspaceSettingsSchema.nullable(),
  version: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
});
export type SettingsSnapshot = z.infer<typeof snapshotSchema>;
export const loadSettings = () => request("/api/team/settings", snapshotSchema);
export const persistSettings = (
  settings: WorkspaceSettings,
  expectedVersion: number,
) =>
  request(
    "/api/team/settings",
    snapshotSchema.extend({ saved: z.literal(true) }),
    { method: "PUT", body: { settings, expectedVersion } },
  );
