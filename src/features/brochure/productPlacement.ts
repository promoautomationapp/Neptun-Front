import type { Campaign, Product } from "../../domain/models";
import { layoutCapacity, productPageChunk } from "./brochureLayout";

export function pageCapacity(layout: string | number) {
  return layoutCapacity(String(layout));
}

const codeOf = (product: Product) => String(product.code);

export function reorderProducts(
  products: Product[],
  sourceCode: string | number,
  targetCode: string | number | undefined,
  after = false,
) {
  const source = String(sourceCode);
  const target = String(targetCode);
  if (source === target) return products;
  const next = [...products];
  const sourceIndex = next.findIndex(
    (product: Product) => codeOf(product) === source,
  );
  if (
    sourceIndex < 0 ||
    !next.some((product: Product) => codeOf(product) === target)
  )
    return products;
  const [product] = next.splice(sourceIndex, 1);
  if (!product) return products;
  const targetIndex = next.findIndex((item) => codeOf(item) === target);
  next.splice(targetIndex + Number(after), 0, product);
  return next;
}

// Page membership follows the order of non-cover products. Inserting at a page
// boundary moves a full page's last product on to the next page automatically.
export function placeProductOnPage(
  campaign: Campaign,
  sourceCode: string | number,
  pageIndex: number,
  coverCodes: (string | number)[],
  position = "start",
) {
  const source = String(sourceCode);
  if (!campaign.products.some((product: Product) => codeOf(product) === source))
    return false;
  const cover = coverCodes
    .map(String)
    .filter((code: string) =>
      campaign.products.some(
        (product: Product) => codeOf(product) === code && code !== source,
      ),
    );

  if (pageIndex === -1) {
    if (cover.length === 3) cover.pop();
    campaign.coverProductCodes = [...cover, source];
    if (cover.length) {
      campaign.products = reorderProducts(
        campaign.products,
        source,
        position === "start" ? cover[0] : cover[cover.length - 1],
        position !== "start",
      );
    }
    return true;
  }

  if (pageIndex < 0) return false;
  if (!cover.length && campaign.products.length > 1) {
    const first = campaign.products.find(
      (product: Product) => codeOf(product) !== source,
    );
    if (first) cover.push(codeOf(first));
  }
  campaign.coverProductCodes = cover;
  const coverSet = new Set(cover);
  const sourceProduct = campaign.products.find(
    (product: Product) => codeOf(product) === source,
  );
  if (!sourceProduct) return false;
  const withoutSource = campaign.products.filter(
    (product: Product) => codeOf(product) !== source,
  );
  const nonCover = withoutSource.filter(
    (product: Product) => !coverSet.has(codeOf(product)),
  );
  let offset = 0;
  for (let index = 0; index < pageIndex; index += 1) {
    if (offset < nonCover.length)
      offset += productPageChunk(campaign, nonCover.slice(offset), index)
        .products.length;
  }
  const capacity = productPageChunk(campaign, nonCover.slice(offset), pageIndex)
    .products.length;
  const slot =
    position === "end"
      ? Math.min(offset + capacity - 1, nonCover.length)
      : Math.min(offset, nonCover.length);
  const before = nonCover[slot];
  if (before) {
    withoutSource.splice(withoutSource.indexOf(before), 0, sourceProduct);
  } else {
    withoutSource.push(sourceProduct);
  }
  campaign.products = withoutSource;
  return true;
}
