import type { Campaign, Store } from "../../domain/models";
import { storeDisplayLines } from "../brochure/storesDesign";
export function visibleStoreLines(
  campaign: Partial<Campaign>,
  store: Partial<Store> | null,
) {
  const lines = storeDisplayLines(store ?? {});
  for (const field of ["city", "name", "address", "phone"] as const)
    if (campaign.storeFields?.[field] === false) lines[field] = "";
  return lines;
}
export function visibleContact(
  campaign: Partial<Campaign>,
  contact: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(contact).map(([key, value]) => [
      key,
      campaign.contactVisibility?.[key] === false ? "" : value,
    ]),
  );
}
export function iconVisible(campaign: Partial<Campaign>, key: string): boolean {
  return campaign.iconDefaults?.[key]?.visible !== false;
}
export function iconSource(campaign: Partial<Campaign>, key: string): string {
  return campaign.iconDefaults?.[key]?.image || "";
}
