import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CatalogNavigator, filterCatalog } from "../../src/features/products/CatalogNavigator";
import { setLanguage } from "../../src/features/brochure/i18n";
const products=[
  {code:"1",name:"Laptop",brand:"APPLE",categoryPath:"IT > LAPTOP"},
  {code:"2",name:"Mouse pad",brand:"LOGITECH",categoryPath:"IT > AKSESORË > MOUSE > MOUSE PAD"},
  {code:"3",name:"Old laptop",brand:"ACER",categoryPath:"IT > LAPTOP",sourceMissing:true},
];
beforeEach(() => setLanguage("en"));
afterEach(() => { cleanup(); setLanguage("sq"); });
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

it("shows every saved product unless a website filter is explicitly selected", () => {
  const selection = { categoryPath: "", brand: "", availability: "all" };
  const onChange = vi.fn();
  const view = render(<CatalogNavigator products={products} selection={selection} onChange={onChange} />);
  expect(filterCatalog(products, selection).map(product => product.code)).toEqual(["1", "2", "3"]);
  const availability = view.getByLabelText("Catalog website availability");
  expect((availability as HTMLSelectElement).value).toBe("all");
  expect(view.getByRole("option", { name: "Kept in catalog · not found on website" })).toBeTruthy();
  fireEvent.change(availability, { target: { value: "missing" } });
  expect(onChange).toHaveBeenCalledWith({ ...selection, availability: "missing" });
  expect(filterCatalog(products, { ...selection, availability: "listed" }).map(product => product.code)).toEqual(["1", "2"]);
  expect(filterCatalog(products, selection).map(product => product.code)).toEqual(["1", "2", "3"]);
  expect(products.find(product => product.code === "3")?.sourceMissing).toBe(true);
});
it("explains in Albanian that products absent from the website remain saved", () => {
  setLanguage("sq");
  const view = render(<CatalogNavigator products={products} selection={{ categoryPath: "", brand: "", availability: "all" }} onChange={vi.fn()} />);
  expect(view.getByRole("option", { name: "Të gjitha produktet e ruajtura" })).toBeTruthy();
  expect(view.getByRole("option", { name: "Të ruajtura në katalog · nuk u gjetën në faqe" })).toBeTruthy();
});
