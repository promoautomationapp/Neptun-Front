import {describe,it,expect}from 'vitest';
import type {Campaign,Product}from '../../src/domain/models';
import {BROCHURE_FORMATS,resolveBrochureFormat,brochureExportGeometry,brochureFormatContentGeometry}from '../../src/features/brochure/brochureFormat';
import {createCampaignEditHistory,restoreCampaignEdit}from '../../src/features/brochure/campaignEditHistory';
import {catalogByCode,resolveOfferProduct,defaultBundleImages}from '../../src/features/brochure/productBundles';
import {placeProductOnPage}from '../../src/features/brochure/productPlacement';
import {splitPages}from '../../src/features/brochure/campaignPages';
import {compactStoresFooterHeight,includesStoresFooter,selectedStoreIndexes}from '../../src/features/brochure/storesSelection';
import {pageBackgroundFill,validBackgroundGradient}from '../../src/features/brochure/pageBackground';
import {imageBackgroundSignature}from '../../src/features/brochure/imagePreparationContext';
import {artworkPrice,artworkInstallment,artworkSaving}from '../../src/features/brochure/priceCardModel';
const product=(code:string):Product=>({code,name:`Product ${code}`,regular:499,sale:'399'});
const campaign=():Campaign=>({id:'one',name:'October',products:['c1','c2','c3',...Array.from({length:9},(_,i)=>`p${i+1}`)].map(product),layout:'classic8',showCoverBand:false,version:1,status:'in_progress'});
describe('reference formats and composition',()=>{
 it.each(BROCHURE_FORMATS)('$id retains output pixels, PDF ratio and canonical composition',format=>{
  const output=brochureExportGeometry(format);expect(output.width).toBe(format.width);expect(output.height).toBe(format.height);expect(output.pdfWidthMm/output.pdfHeightMm).toBeCloseTo(format.ratio,12);
  for(const width of [200,794,format.width]){const fit=brochureFormatContentGeometry(format,width);expect(fit.contentWidth/fit.contentHeight).toBeCloseTo(.8,12);expect(fit.contentWidth).toBeLessThanOrEqual(fit.width+1e-9);expect(fit.contentHeight).toBeLessThanOrEqual(fit.height+1e-9);expect(2*fit.left+fit.contentWidth).toBeCloseTo(fit.width,10);}
 });
 it('preserves legacy format aliases and 300-DPI paper sizes',()=>{expect(resolveBrochureFormat('4:5').id).toBe('neptun1080x1350');expect(resolveBrochureFormat('1:1').id).toBe('square1080');expect(resolveBrochureFormat('A4').width).toBe(2480);expect(resolveBrochureFormat('A3').height).toBe(4961);expect(resolveBrochureFormat({brochureFormat:{width:1}}).id).toBe('neptun1080x1350');});
});
describe('saved editing behavior',()=>{
 it('retains four undo steps and clears redo when another design edit arrives',()=>{const history=createCampaignEditHistory();let value=campaign();for(let i=0;i<6;i++){const next={...value,name:`Edit ${i}`};history.record(value,next);value=next;}expect(history.counts(value.id)).toEqual({undo:4,redo:0});const previous=history.undo(value);if(!previous)throw new Error('Undo missing');expect(previous.name).toBe('Edit 4');const next={...previous,name:'Replacement'};history.record(previous,next);expect(history.counts(next.id).redo).toBe(0);});
 it('undo preserves the current DB version and subsequent review activity',()=>{const initial=campaign();const current={...initial,name:'Changed',version:3,status:'in_review',reviewComments:[{id:'r1',text:'Check price'}]};const restored=restoreCampaignEdit(initial,current);expect(restored.name).toBe('October');expect(restored.version).toBe(3);expect(restored.status).toBe('in_review');expect(restored.reviewComments).toEqual(current.reviewComments);});
 it('groups a continuous gesture and removes a gesture that returns to its starting value',()=>{const history=createCampaignEditHistory();const initial=campaign();const first={...initial,name:'Dragging'};history.record(initial,first,'gesture');history.record(first,initial,'gesture');expect(history.counts(initial.id)).toEqual({undo:0,redo:0});});
 it('moves a product into a full page and shifts the last product to the next page',()=>{const value=campaign();placeProductOnPage(value,'p9',0,['c1','c2','c3']);const pages=splitPages(value);expect(pages[0]?.products.map(x=>x.code)).toEqual(['p9','p1','p2','p3','p4','p5','p6','p7']);expect(pages[1]?.products[0]?.code).toBe('p8');});
});
describe('bundle, price, store and background parity',()=>{
 it('keeps every bundle member, its shared price and independent image positions',()=>{const oven={...product('84065513'),name:'FURRE FUEGO OVEN',subcategory:'FURRË',regular:299,image:'/oven.png'};const hob={...product('84066276'),name:'PLLAKE FUEGO HOB',regular:179,image:'/hob.png'};const lookup=catalogByCode([oven,hob]);for(const separator of [' + ',' & ',';','\n',' / ',' dhe ']){const offer=resolveOfferProduct(`${hob.code}${separator}${oven.code}`,lookup).product;if(!offer)throw new Error('Bundle missing');expect(offer.bundleProducts?.map(x=>x.code)).toEqual([oven.code,hob.code]);expect(offer.regular).toBe(478);expect(defaultBundleImages(offer)).toHaveLength(2);}expect(resolveOfferProduct(`${oven.code}+missing`,lookup).product).toBeNull();});
 it('preserves decimal artwork and installment/saving calculations',()=>{expect(artworkPrice(399.9)).toEqual({whole:'399',cents:'90',text:'399.90'});expect(artworkInstallment(399,12)).toBe('12 x muaj: 33.3 €');expect(artworkSaving(499,399)).toEqual({label:'KURSENI',text:'100€'});expect(artworkSaving(499,399,'percentage')?.text).toBe('20%');});
 it('preserves store selection and footer constraints',()=>{expect(selectedStoreIndexes({selectedStoreIndexes:[2,0,99]},3)).toEqual([0,2]);expect(includesStoresFooter({includeStoresPage:false,includeStoresFooter:true})).toBe(true);expect(includesStoresFooter({includeStoresFooter:true})).toBe(false);expect(compactStoresFooterHeight({compactStoresFooterHeight:100})).toBe(28);});
 it('preserves background precedence and stable preparation signatures',()=>{const value=campaign();value.productBackgroundColor='#112233';expect(pageBackgroundFill(value,'product',{backgroundGradient:{from:'#FFFFFF',to:'#223344',angle:500}})).toBe('linear-gradient(360deg, #ffffff, #223344)');expect(validBackgroundGradient({from:'invalid',to:'#ffffff',angle:45})).toBeNull();expect(imageBackgroundSignature({kind:'solid',color:'#AABBCC'})).toBe(imageBackgroundSignature({color:'#aabbcc',kind:'solid'}));});
});
