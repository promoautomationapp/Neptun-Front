import type {Campaign}from "../../domain/models";
// A refresh may start before a newly created or edited campaign is saved and
// finish afterward. Keep the current editor draft until the server catches up.
export function mergeCampaignSnapshots(current:Campaign[], remote:Campaign[], activeId:string|null, isEditing:boolean) {
  if (!isEditing || !activeId) return remote;
  const active = current.find((item) => item.id === activeId);
  if (!active) return remote;
  const saved = remote.find((item) => item.id === activeId);
  if (!saved) return [active, ...remote];
  const localTime = Date.parse(active.updatedAt || "") || 0;
  const savedTime = Date.parse(saved.updatedAt || "") || 0;
  return localTime > savedTime
    ? remote.map((item) => item.id === activeId ? active : item)
    : remote;
}
