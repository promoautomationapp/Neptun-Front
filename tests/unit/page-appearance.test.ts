import { expect,it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { applyPageBackground,setPageAppearance,resolvedPageAppearance,campaignForPageAppearance,artworkTextColor,pageAppearanceFor } from "../../src/features/brochure/pageAppearance";
import { offerStyleFor } from "../../src/features/brochure/offerStyles";
import { campaignSchema } from "../../src/domain/schemas";
const campaign = ():Campaign => ({id:"appearance",name:"Appearance",offerStyle:"card",theme:"blue",coverBackgroundColor:"#1c4075",productBackgroundColor:"#1c4075",products:[{code:"one",name:"Phone",brochureContentPlacement:{price:{x:3,y:2}},brochureImagePlacement:{x:7,y:4}}],pages:{"0":{backgroundColor:"#173b63"},"1":{backgroundColor:"#e4e4e4"}}});
it("keeps native preset choices until a smart background change, then matches each page independently",()=>{
 const c=campaign();
 expect(resolvedPageAppearance(c,"product",{index:0,backgroundColor:"#173b63"}).priceStyle).toBe("card");
 const original=structuredClone(c.products);
 applyPageBackground(c,"product",0,{backgroundColor:"#f1f2f4"},"page");
 const light=resolvedPageAppearance(c,"product",{index:0,...c.pages?.["0"]});
 expect(light).toMatchObject({textColor:"#1c4075",brandColor:"#343534",screenLabelColor:"#1c4075",priceStyle:"card",light:true});
 expect(c.pages?.["1"]?.backgroundColor).toBe("#e4e4e4");
 expect(c.coverBackgroundColor).toBe("#1c4075");
 expect(c.products).toEqual(original);
 applyPageBackground(c,"product",0,{backgroundColor:"#173b63"},"page");
 expect(resolvedPageAppearance(c,"product",{index:0,...c.pages?.["0"]})).toMatchObject({textColor:"#ffffff",brandColor:"#ffffff",priceStyle:"current",light:false});
 expect(c.aiBackgroundChanged).toBe(false);
});
it("applies a gradient to every page, clears only background overrides and resets stale appearance choices",()=>{
 const c=campaign();c.pages!["0"]!.layout="grid4";c.pageAppearances={"product-0":{textColor:"#ff0000",priceStyle:"card"}};
 const gradient={from:"#eef4fa",to:"#ffffff",angle:135};
 applyPageBackground(c,"cover",undefined,{backgroundGradient:gradient},"all");
 expect(c.coverBackgroundGradient).toEqual(gradient);expect(c.productBackgroundGradient).toEqual(gradient);expect(c.storesBackgroundGradient).toEqual(gradient);
 expect(c.pages?.["0"]).toEqual({layout:"grid4"});
 expect(c.pageAppearances).toEqual({cover:{priceStyle:"auto"},product:{priceStyle:"auto"},stores:{priceStyle:"auto"}});
});
it("advanced overrides persist and can be cleared without losing other fields or touching photos",()=>{
 const c=campaign();applyPageBackground(c,"product",0,{backgroundColor:"#eeeeee"});
 setPageAppearance(c,"product",0,{textColor:"#112233",brandColor:"#dd3355",screenLabelColor:"#ff9900",priceStyle:"current"});
 expect(resolvedPageAppearance(c,"product",{index:0,...c.pages?.["0"]})).toMatchObject({textColor:"#112233",brandColor:"#dd3355",screenLabelColor:"#ff9900",priceStyle:"current"});
 setPageAppearance(c,"product",0,{textColor:undefined,brandColor:undefined,screenLabelColor:undefined,priceStyle:"auto"});
 expect(pageAppearanceFor(c,"product",{index:0})).toEqual({priceStyle:"auto"});
 expect(campaignSchema.parse(JSON.parse(JSON.stringify(c))).pageAppearances).toEqual(c.pageAppearances);
});
it("page price defaults never override an explicit product choice or mutate the source campaign",()=>{
 const c=campaign();applyPageBackground(c,"product",0,{backgroundColor:"#173b63"});
 const render=campaignForPageAppearance(c,"product",{index:0,...c.pages?.["0"]});
 expect(offerStyleFor(render,c.products[0])).toBe("current");
 expect(offerStyleFor(render,{...c.products[0],offerStyle:"card"})).toBe("card");
 expect(c.offerStyle).toBe("card");expect(Object.hasOwn(c,"__pageAppearancePrice")).toBe(false);
});
it("unreadable saved white text adapts on light pages while readable custom text remains editable",()=>{
 const c=campaign();applyPageBackground(c,"cover",undefined,{backgroundColor:"#ffffff"});
 expect(artworkTextColor(c,"cover","#ffffff")).toBe("#1c4075");
 expect(artworkTextColor(c,"cover","#112233")).toBe("#112233");
 setPageAppearance(c,"cover",undefined,{textColor:"#ff3300"});expect(artworkTextColor(c,"cover","#112233")).toBe("#ff3300");
 expect(campaignSchema.safeParse({...c,pageAppearances:{cover:{textColor:"url(attack)"}}}).success).toBe(false);
});
