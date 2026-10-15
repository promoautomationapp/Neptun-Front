import {expect,it} from "vitest";
import {campaignValidity} from "../../src/features/campaigns/campaignValidity";
import {emptyCampaignFilters,filterCampaigns} from "../../src/features/campaigns/campaignFilters";
it("expires after the full last day in workspace time including DST",()=>{
 const campaign={id:"expiry-test",startDate:"2026-10-14",endDate:"2026-10-15",status:"completed",name:"Test",products:[]};
 expect(campaignValidity(campaign,new Date("2026-10-15T21:59:59Z"))).toBe("active");
 expect(campaignValidity(campaign,new Date("2026-10-15T22:00:00Z"))).toBe("expired");
 const winter={...campaign,endDate:"2026-10-25"};
 expect(campaignValidity(winter,new Date("2026-10-25T22:59:59Z"))).toBe("active");
 expect(campaignValidity(winter,new Date("2026-10-25T23:00:00Z"))).toBe("expired");
 expect(filterCampaigns([campaign],{...emptyCampaignFilters,status:"expired"},new Date("2026-10-16T10:00:00Z"))).toEqual([campaign]);
 expect(campaign.status).toBe("completed");
});
it("does not expire undated or invalid drafts and supports extending dates",()=>{
 const now=new Date("2026-10-16T10:00:00Z");
 expect(campaignValidity({},now)).toBeNull();
 expect(campaignValidity({endDate:"2026-02-30"},now)).toBeNull();
 expect(campaignValidity({startDate:"2026-10-20",endDate:"2026-10-15"},now)).toBeNull();
 expect(campaignValidity({endDate:"2026-10-20"},now)).toBe("active");
 expect(campaignValidity({startDate:"2026-10-19",endDate:"2026-10-20"},now)).toBe("upcoming");
});
