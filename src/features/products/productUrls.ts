import type { Product } from "../../domain/models";

/** Retain only ordinary Neptun destinations supplied by the product/catalog. */
export function neptunProductUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  if (!/^(?:https?:\/\/|\/)/i.test(value.trim())) return null;
  try {
    const url = new URL(value.trim(), "https://www.neptun-ks.com");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      !/(?:^|\.)neptun-ks\.com$/i.test(url.hostname) ||
      url.pathname === "/"
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

const text = (value?: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const words = (value?: string) =>
  text(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const sku = (value?: string) =>
  text(value)
    .replace(/\.0+$/, "")
    .replace(/[\s_-]/g, "");
const modelTokens = (value?: string) =>
  (text(value).match(/[a-z0-9]+(?:[./_-][a-z0-9]+)*/g) || [])
    .map((token) => token.replace(/[^a-z0-9]/g, ""))
    // Short family names and capacities (A17, 128GB, 55) do not identify a SKU.
    .filter(
      (token) =>
        token.length >= 5 &&
        /[a-z]/.test(token) &&
        /\d/.test(token) &&
        !/^(?:\d+(?:gb|tb|mb|kg|hz|wh|mah|kw|w|cm|mm))+$/.test(token),
    );

export type ProductUrlResolver = (product: Partial<Product>) => string | null;

/** Resolve a destination from the loaded catalog, never synthesize a slug.
 * Model fallback requires a known brand and one unique full model token or
 * exact model name. All candidates count, including products without a URL. */
export function createCatalogProductUrlResolver(
  catalog: Iterable<Product>,
): ProductUrlResolver {
  const products = [...catalog];
  const byCode = new Map<string, Product[]>();
  const brands = new Set<string>();
  for (const product of products) {
    const key = sku(product.code);
    if (key) byCode.set(key, [...(byCode.get(key) || []), product]);
    if (product.brand) brands.add(words(product.brand));
  }
  const uniqueUrl = (candidates: Product[]) => {
    if (candidates.length !== 1) return null;
    return neptunProductUrl(candidates[0]!.url);
  };
  return (product) => {
    const saved = neptunProductUrl(product.url);
    if (saved) return saved;
    const exact = byCode.get(sku(product.code));
    if (exact) return uniqueUrl(exact);

    const name = words(product.name);
    const explicitBrand = words(product.brand);
    const matchingBrands = explicitBrand
      ? brands.has(explicitBrand)
        ? [explicitBrand]
        : []
      : [...brands].filter((brand) => ` ${name} `.includes(` ${brand} `));
    if (matchingBrands.length !== 1) return null;
    const brand = matchingBrands[0]!;
    const codeTokens = modelTokens(product.code);
    const suppliedTokens = codeTokens.length
      ? codeTokens
      : modelTokens(product.name);
    const candidates = products.filter((candidate) => {
      if (words(candidate.brand) !== brand) return false;
      const candidateName = words(candidate.name);
      // Exact titles still need model evidence; a generic brand/category is insufficient.
      if (
        !codeTokens.length &&
        name &&
        name === candidateName &&
        modelTokens(product.name).length
      )
        return true;
      if (!suppliedTokens.length) return false;
      const candidateTokens = new Set([
        ...modelTokens(candidate.code),
        ...modelTokens(candidate.name),
        ...Object.entries(candidate.specs || {}).flatMap(([key, value]) =>
          /^(?:model|modeli|model code|mpn|manufacturer part number)$/i.test(
            key.trim(),
          )
            ? modelTokens(value)
            : [],
        ),
      ]);
      return suppliedTokens.every((token) => candidateTokens.has(token));
    });
    return uniqueUrl(candidates);
  };
}

/** Saved brochures may contain nested offers and collapsed color choices. */
export function enrichProductUrls(
  product: Product,
  resolve: ProductUrlResolver,
): Product {
  const url = resolve(product);
  return {
    ...product,
    ...(url ? { url } : {}),
    ...(Array.isArray(product.bundleProducts)
      ? {
          bundleProducts: product.bundleProducts.map((member) =>
            enrichProductUrls(member, resolve),
          ),
        }
      : {}),
    ...(Array.isArray(product.brochureVariants)
      ? {
          brochureVariants: product.brochureVariants.map((variant) => {
            const destination = resolve({
              code: typeof variant.code === "string" ? variant.code : "",
              name: typeof variant.name === "string" ? variant.name : "",
              brand:
                typeof variant.brand === "string"
                  ? variant.brand
                  : product.brand,
              url: typeof variant.url === "string" ? variant.url : undefined,
            });
            return destination ? { ...variant, url: destination } : variant;
          }),
        }
      : {}),
  };
}
