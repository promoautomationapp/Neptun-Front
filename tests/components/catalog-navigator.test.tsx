import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CatalogNavigator, filterCatalog } from "../../src/features/products/CatalogNavigator";
const products=[
  {code:"1",name:"Laptop",brand:"APPLE",categoryPath:"IT > LAPTOP"},
  {code:"2",name:"Mouse pad",brand:"LOGITECH",categoryPath:"IT > AKSESORË > MOUSE > MOUSE PAD"},
  {code:"3",name:"Old laptop",brand:"ACER",categoryPath:"IT > LAPTOP",sourceMissing:true},
];
afterEach(cleanup);
it("shows the real depth and never creates a subcategory under a leaf",()=>{
  const onChange=vi.fn(); const view=render(<CatalogNavigator products={products} selection={{categoryPath:"IT > LAPTOP",brand:"",availability:"all"}} onChange={onChange}/>);
  expect(view.getByLabelText("Catalog category")).toBeTruthy();
  expect(view.getByLabelText("Catalog category level 2")).toBeTruthy();
  expect(view.queryByLabelText("Catalog category level 3")).toBeNull();
  view.rerender(<CatalogNavigator products={products} selection={{categoryPath:"IT > AKSESORË > MOUSE",brand:"",availability:"all"}} onChange={onChange}/>);
  expect(view.getByLabelText("Catalog category level 4")).toBeTruthy();
  fireEvent.change(view.getByLabelText("Catalog category"),{target:{value:""}});
  expect(onChange).toHaveBeenCalledWith({categoryPath:"",brand:"",availability:"all"});
});
it("filters full branches, brand and missing status without losing saved products",()=>{
  expect(filterCatalog(products,{categoryPath:"IT > LAPTOP",brand:"",availability:"all"}).map(p=>p.code)).toEqual(["1","3"]);
  expect(filterCatalog(products,{categoryPath:"IT",brand:"LOGITECH",availability:"all"}).map(p=>p.code)).toEqual(["2"]);
  expect(filterCatalog(products,{categoryPath:"",brand:"",availability:"missing"}).map(p=>p.code)).toEqual(["3"]);
  expect(products).toHaveLength(3);
});
