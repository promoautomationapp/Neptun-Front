import { useMemo } from "react";
import type { Product } from "../../domain/models";
import { categoryNodes, productCategoryPath } from "../settings/categoryHierarchy";
import "../../styles/catalog-navigator.css";
export interface CatalogSelection { categoryPath: string; brand: string; availability: string }
export function filterCatalog(products: Product[], selection: CatalogSelection): Product[] {
  return products.filter(product => {
    const path=productCategoryPath(product);
    return (!selection.categoryPath || path===selection.categoryPath || path.startsWith(`${selection.categoryPath} > `)) && (!selection.brand || product.brand===selection.brand) && (selection.availability==="missing" ? product.sourceMissing : selection.availability==="listed" ? !product.sourceMissing : true);
  });
}
export function CatalogNavigator({products, selection, onChange}: {products:Product[]; selection:CatalogSelection; onChange:(selection:CatalogSelection)=>void}) {
  const nodes=useMemo(()=>categoryNodes(products.map(product=>({category:product.category||"",subcategory:product.subcategory||"",categoryPath:product.categoryPath}))),[products]);
  const path=selection.categoryPath.split(" > ").filter(Boolean);
  const levels=Array.from({length:path.length+1},(_,depth)=>{
    const parent=path.slice(0,depth).join(" > ");
    return {parent,depth,children:nodes.filter(node=>node.parent===parent)};
  }).filter(level=>level.children.length);
  const branch=useMemo(()=>filterCatalog(products,{...selection,brand:"",availability:"all"}),[products,selection.categoryPath]);
  const brands=[...new Set(branch.map(product=>product.brand).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
  return <section className="cs-catalog-navigator" aria-label="Catalog categories and brands">
    <div className="cs-catalog-filter-head"><strong>Browse Neptun’s category tree</strong><small>Branches show only the levels that exist.</small><button type="button" onClick={()=>onChange({categoryPath:"",brand:"",availability:"all"})}>Clear filters</button></div>
    <div className="cs-catalog-filter-fields">
      {levels.map(({parent,depth,children})=><label key={parent}><span>{depth===0?"Category":depth===1?"Subcategory":`Level ${depth+1}`}</span><select aria-label={depth===0?"Catalog category":`Catalog category level ${depth+1}`} value={path.slice(0,depth+1).join(" > ")} onChange={event=>onChange({...selection,categoryPath:event.target.value,brand:""})}><option value={parent}>{depth===0?"All categories":"All in this branch"}</option>{children.map(node=><option key={node.path} value={node.path}>{node.label}</option>)}</select></label>)}
      <label><span>Brand</span><select aria-label="Catalog brand" value={selection.brand} onChange={event=>onChange({...selection,brand:event.target.value})}><option value="">All brands</option>{brands.map(brand=><option key={brand} value={brand}>{brand}</option>)}</select></label>
      <label><span>Website availability</span><select aria-label="Catalog website availability" value={selection.availability} onChange={event=>onChange({...selection,availability:event.target.value})}><option value="all">All saved products</option><option value="listed">Listed on Neptun</option><option value="missing">No longer listed · kept</option></select></label>
    </div>
    {selection.categoryPath && <div className="cs-catalog-crumbs">{path.map((part,index)=><button type="button" key={index} onClick={()=>onChange({...selection,categoryPath:path.slice(0,index+1).join(" > "),brand:""})}>{index>0&&<span aria-hidden="true">› </span>}{part}</button>)}</div>}
  </section>;
}
