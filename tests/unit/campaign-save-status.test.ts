import {expect, it} from "vitest";
import {setCampaignSaveStatus, subscribeCampaignSaveStatus, campaignSaveStatus} from "../../src/features/brochure/campaignSaveStatus";
import {mergeCampaignSnapshots} from "../../src/features/brochure/mergeCampaignSnapshots";
import type {Campaign} from "../../src/domain/models";

it("publishes saving and saved status for each campaign", () => {
  let notifications = 0; const unsubscribe = subscribeCampaignSaveStatus(()=>notifications++);
  setCampaignSaveStatus("save-qa", {state:"saving"});
  expect(campaignSaveStatus("save-qa").state).toBe("saving");
  setCampaignSaveStatus("save-qa", {state:"saved",savedAt:"2026-10-14T10:00:00Z"});
  expect(notifications).toBe(2); unsubscribe();
});

it("keeps a conflicted local edit even when another editor has a newer server timestamp", () => {
  const local: Campaign = {id:"conflict-qa",name:"My current edits",products:[],updatedAt:"2026-10-14T10:00:00Z"};
  const remote = {...local,name:"Other editor",updatedAt:"2026-10-14T10:01:00Z"};
  setCampaignSaveStatus(local.id,{state:"conflict"});
  expect(mergeCampaignSnapshots([local],[remote],local.id,true)[0]?.name).toBe(local.name);
  setCampaignSaveStatus(local.id,{state:"saved"});
  expect(mergeCampaignSnapshots([local],[remote],local.id,true)[0]?.name).toBe(remote.name);
});
