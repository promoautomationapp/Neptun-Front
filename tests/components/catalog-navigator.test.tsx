import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CatalogNavigator, defaultCatalogSelection, filterCatalog } from "../../src/features/products/CatalogNavigator";
import { setLanguage } from "../../src/features/brochure/i18n";
const products = [
  {code:"1",name:"Laptop",brand:"APPLE",categoryPath:"IT > LAPTOP"},
  {code:"2",name:"Mouse pad",brand:"LOGITECH",categoryPath:"IT > AKSESORË > MOUSE > MOUSE PAD"},
  {code:"3",name:"Old laptop",brand:"ACER",categoryPath:"IT > LAPTOP",sourceMissing:true},
];
beforeEach(() => setLanguage("en"));
afterEach(() => { cleanup(); setLanguage("sq"); });
it("shows only existing hierarchy levels and resets children/brand when parent changes", () => {
  const onChange=vi.fn(); const view=render(<CatalogNavigator products={products} selection={{categoryPath:"IT > LAPTOP",brand:"APPLE",availability:"all"}} onChange={onChange}/>);
  expect(view.getByRole("button", {name:"Category"})).toBeTruthy();
  expect(view.getByRole("button", {name:"Subcategory"})).toBeTruthy();
  expect(view.queryByRole("button", {name:"Sub-subcategory"})).toBeNull();
  view.rerender(<CatalogNavigator products={products} selection={{categoryPath:"IT > AKSESORË > MOUSE",brand:"LOGITECH",availability:"all"}} onChange={onChange}/>);
  expect(view.getByRole("button", {name:"Category level 4"})).toBeTruthy();
  fireEvent.click(view.getByRole("button", {name:"Category"}));
  fireEvent.click(view.getByRole("option", {name:"All categories"}));
  expect(onChange).toHaveBeenCalledWith({categoryPath:"",brand:"",availability:"all"});
});
it("chooses one initial root category and keeps every descendant including website-missing products", () => {
  const selection=defaultCatalogSelection(products);
  expect(selection).toEqual({categoryPath:"IT",brand:"",availability:"all"});
  expect(filterCatalog(products,selection)).toHaveLength(3);
  expect(filterCatalog(products,{categoryPath:"IT > LAPTOP",brand:"",availability:"all"}).map(p=>p.code)).toEqual(["1","3"]);
  expect(filterCatalog(products,{categoryPath:"IT",brand:"LOGITECH",availability:"all"}).map(p=>p.code)).toEqual(["2"]);
  expect(filterCatalog(products,{categoryPath:"",brand:"",availability:"missing"}).map(p=>p.code)).toEqual(["3"]);
  expect(products).toHaveLength(3);
});
it("lets people search accented category names regardless of case or spacing", () => {
  const view=render(<CatalogNavigator products={products} selection={{categoryPath:"IT",brand:"",availability:"all"}} onChange={vi.fn()}/>);
  fireEvent.click(view.getByRole("button", {name:"Subcategory"}));
  fireEvent.change(view.getByRole("searchbox", {name:"Search Subcategory"}),{target:{value:"  aKsE soRe  "}});
  expect(view.getByRole("option",{name:"AKSESORË"})).toBeTruthy();
  expect(view.queryByRole("option",{name:"LAPTOP"})).toBeNull();
});
it("shows every saved product unless a website filter is explicitly selected", () => {
  const selection = { categoryPath: "", brand: "", availability: "all" };
  const onChange = vi.fn();
  const view = render(<CatalogNavigator products={products} selection={selection} onChange={onChange} />);
  expect(filterCatalog(products, selection).map(product => product.code)).toEqual(["1", "2", "3"]);
  fireEvent.click(view.getByRole("button",{name:"Website availability"}));
  expect(view.getByRole("option",{name:"All saved products"}).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(view.getByRole("option", {name:"Kept in catalog · not found on website"}));
  expect(onChange).toHaveBeenCalledWith({ ...selection, availability: "missing" });
  expect(filterCatalog(products, { ...selection, availability: "listed" }).map(product => product.code)).toEqual(["1", "2"]);
  expect(filterCatalog(products, selection).map(product => product.code)).toEqual(["1", "2", "3"]);
});
it("explains in Albanian that products absent from the website remain saved", () => {
  setLanguage("sq");
  const view = render(<CatalogNavigator products={products} selection={{ categoryPath: "", brand: "", availability: "all" }} onChange={vi.fn()} />);
  fireEvent.click(view.getByRole("button",{name:"Prania në faqen e Neptun"}));
  expect(view.getByRole("option", {name:"Të gjitha produktet e ruajtura"})).toBeTruthy();
  expect(view.getByRole("option", {name:"Të ruajtura në katalog · nuk u gjetën në faqe"})).toBeTruthy();
});
