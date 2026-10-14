import type {Campaign}from '../../domain/models';
export const CAMPAIGN_HISTORY_LIMIT=4;
const REVIEW_FIELDS=['status','reviewComments','reviewHistory']as const;
const NON_EDIT_FIELDS=['updatedAt','version',...REVIEW_FIELDS]as const;
export function campaignEditSignature(campaign:Campaign):string{
 const editable={...campaign};for(const field of NON_EDIT_FIELDS)delete editable[field];return JSON.stringify(editable);
}
export function restoreCampaignEdit(snapshot:Campaign,current:Campaign):Campaign{
 const restored=structuredClone(snapshot);
 const preserve=<K extends keyof Campaign>(field:K):void=>{if(Object.hasOwn(current,field))restored[field]=structuredClone(current[field]);else delete restored[field];};
 for(const field of [...REVIEW_FIELDS,'version']as const)preserve(field);return restored;
}
interface History{past:Campaign[];future:Campaign[];group:string|number|null;expected:string}
export function createCampaignEditHistory(limit=CAMPAIGN_HISTORY_LIMIT){
 const maxSteps=Number.isInteger(limit)&&limit>0?limit:CAMPAIGN_HISTORY_LIMIT;const campaigns=new Map<string,History>();
 function observe(campaign:Campaign){const state=campaigns.get(campaign.id);if(state&&state.expected!==campaignEditSignature(campaign))campaigns.delete(campaign.id);}
 function record(before:Campaign,after:Campaign,group:string|number|null=null){
  if(!before.id||before.id!==after.id)return false;const beforeSignature=campaignEditSignature(before),afterSignature=campaignEditSignature(after);if(beforeSignature===afterSignature)return false;observe(before);
  const state:History=campaigns.get(before.id)??{past:[],future:[],group:null,expected:beforeSignature};
  if(group===null||state.group!==group||!state.past.length){state.past.push(structuredClone(before));if(state.past.length>maxSteps)state.past.shift();}
  state.future=[];state.group=group;state.expected=afterSignature;const last=state.past.at(-1);if(group!==null&&last&&campaignEditSignature(last)===afterSignature){state.past.pop();state.group=null;}campaigns.set(before.id,state);return true;
 }
 function step(campaign:Campaign,direction:'undo'|'redo'){
  observe(campaign);const state=campaigns.get(campaign.id);if(!state)return null;const from=direction==='undo'?state.past:state.future;if(!from.length)return null;const to=direction==='undo'?state.future:state.past;const snapshot=from.pop();if(!snapshot)return null;
  to.push(structuredClone(campaign));if(to.length>maxSteps)to.shift();state.group=null;state.expected=campaignEditSignature(snapshot);return structuredClone(snapshot);
 }
 return {record,observe,undo:(campaign:Campaign)=>step(campaign,'undo'),redo:(campaign:Campaign)=>step(campaign,'redo'),counts:(id:string|null)=>({undo:id?campaigns.get(id)?.past.length??0:0,redo:id?campaigns.get(id)?.future.length??0:0}),endGroup:(id:string)=>{const state=campaigns.get(id);if(state)state.group=null;},clear:(id?:string)=>{if(id===undefined)campaigns.clear();else campaigns.delete(id);}};
}
