import type { Product } from "../../domain/models";
import { normalize } from "./utils";

const compact = (value: string | null | undefined) =>
  normalize(value ?? "").replace(/[^a-z0-9]/g, "");

function orderedMatch(needle: string, haystack: string) {
  let at = 0;
  for (const character of haystack) if (character === needle[at]) at += 1;
  return at === needle.length;
}

export function productMatchScore(
  product: Product,
  query: string | null | undefined,
) {
  const phrase = normalize(query ?? "").trim();
  if (!phrase) return 0;
  const joined = normalize(
    [
      product.code,
      product.name,
      product.brand,
      product.category,
      product.subcategory,
      product.categoryPath,
      product.description,
    ].join(" "),
  );
  const dense = compact(joined);
  const wanted = compact(phrase);
  if (!wanted) return -1;
  const phoneQuery =
    /^(phone|phones|telefon|telefona|telefoni|smartphone|smartphones)$/.test(
      wanted,
    );
  const isPhone = /smartphone|mobilephone|celular/i.test(
    product.subcategory ?? "",
  );
  const words = phrase.split(/[^a-z0-9]+/).filter(Boolean);
  const wordMatch = words.every((word) => joined.includes(word));
  if (
    !wordMatch &&
    !dense.includes(wanted) &&
    !(phoneQuery && isPhone) &&
    !(
      wanted.length >= 6 &&
      orderedMatch(wanted, compact(`${product.brand} ${product.name}`))
    )
  )
    return -1;
  const name = compact(product.name);
  const code = compact(product.code);
  const subcategory = compact(product.subcategory);
  let score = 1;
  if (code === wanted) score += 500;
  else if (code.includes(wanted)) score += 230;
  if (name.includes(wanted)) score += 160;
  if (subcategory.includes(wanted)) score += 90;
  if (compact(product.brand).includes(wanted)) score += 70;
  if (phoneQuery && isPhone) score += 400;
  return score;
}

export function searchProducts(
  products: Product[],
  query: string | null | undefined,
) {
  if (!normalize(query ?? "").trim()) return products;
  return products
    .map((product, index) => ({
      product,
      index,
      score: productMatchScore(product, query),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.product);
}

/** Code-only lookup deliberately excludes names, descriptions and brands. */
export function searchProductCodes(products: Product[], query: string | null | undefined) {
  if (!query?.trim()) return products;
  const codes = query.split(/[,;\n]+/).map(compact).filter(Boolean);
  if (!codes.length) return [];
  return products.map((product, index) => ({ product, index, code: compact(product.code) }))
    .filter(entry => codes.some(code => entry.code.includes(code)))
    .sort((a, b) => Number(codes.includes(b.code)) - Number(codes.includes(a.code)) || a.index - b.index)
    .map(entry => entry.product);
}
