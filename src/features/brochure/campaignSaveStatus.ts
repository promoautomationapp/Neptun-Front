export interface CampaignSaveStatus {state: "saved" | "saving" | "error" | "conflict"; message?: string; savedAt?: string;}
const clean: CampaignSaveStatus = {state: "saved"};
const states = new Map<string, CampaignSaveStatus>();
const listeners = new Set<() => void>();
export function campaignSaveStatus(id: string): CampaignSaveStatus { return states.get(id) || clean; }
export function setCampaignSaveStatus(id: string, status: CampaignSaveStatus) { states.set(id, status); for (const listener of listeners) listener(); }
export function subscribeCampaignSaveStatus(listener: () => void) { listeners.add(listener); return () => {listeners.delete(listener);}; }
export function hasUnsavedCampaign(id: string) { return ["saving", "error", "conflict"].includes(campaignSaveStatus(id).state); }
export function hasUnsavedCampaignChanges() { return [...states.values()].some(status => status.state !== "saved"); }
