import {expect,it} from "vitest";
import {searchProductCodes,searchProducts} from "../../src/features/brochure/productSearch";
const products=[{code:"84 057-265",name:"KRUPS KP243110",brand:"Krups"},{code:"1234",name:"Product 84057265",brand:"Samsung"}];
it("matches codes with different spacing/case/punctuation without searching product names",()=>{
 expect(searchProductCodes(products,"84057265").map(p=>p.code)).toEqual(["84 057-265"]);
 expect(searchProductCodes(products," 84 057 265 ").map(p=>p.code)).toEqual(["84 057-265"]);
 expect(searchProductCodes(products,"84057265, 1234")).toHaveLength(2);
 expect(searchProductCodes(products,"krups")).toEqual([]);
 expect(searchProducts(products," kRuPSkP243110 ").map(p=>p.code)).toEqual(["84 057-265"]);
});
