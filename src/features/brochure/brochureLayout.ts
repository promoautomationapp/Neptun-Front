import type { Campaign, Product } from "../../domain/models";
import { isMacBook } from "./productTypes";

export const BROCHURE_LAYOUTS = [
  {
    id: "grid6portrait",
    name: "Six offers · 2 × 3 grid",
    detail: "Two columns and three rows",
    capacity: 6,
    columns: 2,
    rows: 3,
  },
  {
    id: "classic8",
    name: "Eight offers · 3 × 3 grid",
    detail: "Three columns and three rows, with one open slot",
    capacity: 8,
    columns: 3,
    rows: 3,
  },
  {
    id: "grid9",
    name: "Nine offers",
    detail: "3 columns × 3 rows",
    capacity: 9,
    columns: 3,
    rows: 3,
  },
  {
    id: "grid6",
    name: "Six offers",
    detail: "Three columns, two rows",
    capacity: 6,
    columns: 3,
    rows: 2,
  },
  {
    id: "duo4",
    name: "Two products per row",
    detail: "Two spacious columns",
    capacity: 4,
    columns: 2,
    rows: 2,
  },
];

const canonicalLayout = (layout: string) =>
  ["grid4", "duo", "feature"].includes(layout) ? "duo4" : layout;

export function layoutGrid(layout: string) {
  const option = BROCHURE_LAYOUTS.find(
    (item) => item.id === canonicalLayout(layout),
  );
  return { columns: option?.columns ?? 3, rows: option?.rows ?? 3 };
}

export function layoutCapacity(layout: string) {
  return (
    BROCHURE_LAYOUTS.find((item) => item.id === canonicalLayout(layout))
      ?.capacity ?? 8
  );
}

// Old saved layouts are explicit unless a new campaign opted into automatic
// grouping. A manual per-page choice always takes precedence.
export function automaticProductLayout(
  campaign: Partial<Campaign>,
  pageIndex: number,
) {
  return (
    !campaign.pages?.[pageIndex]?.layout &&
    (campaign.autoProductLayout === true ||
      (!campaign.layout && campaign.autoProductLayout !== false))
  );
}

export function productPageLayout(
  campaign: Partial<Campaign>,
  products: Product[],
  pageIndex: number,
) {
  const manual = campaign.pages?.[pageIndex]?.layout;
  if (manual) return manual;
  if (
    automaticProductLayout(campaign, pageIndex) &&
    products[0] &&
    isMacBook(products[0])
  )
    return "duo4";
  return campaign.layout || "grid6portrait";
}

export function productPageChunk(
  campaign: Partial<Campaign>,
  products: Product[],
  pageIndex: number,
) {
  const layout = productPageLayout(campaign, products, pageIndex);
  let run = products;
  if (automaticProductLayout(campaign, pageIndex) && products.length) {
    const firstIsMacBook = isMacBook(products[0]);
    const boundary = products.findIndex(
      (item) => isMacBook(item) !== firstIsMacBook,
    );
    if (boundary > 0) run = products.slice(0, boundary);
  }
  const count = run.length
    ? fittingProductCount(run, layout, layoutCapacity(layout))
    : 0;
  return { layout, products: run.slice(0, count) };
}

export function cardSize(product: Partial<Product>, layout: string) {
  const { columns, rows } = layoutGrid(layout);
  return {
    width: Math.max(
      1,
      Math.min(
        columns,
        Math.round(
          Number(product?.brochureCardSize?.width) ||
            ((product.bundleProducts?.length || 0) >= 3 ? columns : 1),
        ),
      ),
    ),
    height: Math.max(
      1,
      Math.min(
        rows,
        Math.round(Number(product?.brochureCardSize?.height) || 1),
      ),
    ),
  };
}

// Place blocks row by row. A wider block wraps to the next available row;
// when no rectangle remains, the caller starts a new brochure page.
export function fittingProductCount(
  products: Product[],
  layout: string,
  limit = products.length,
) {
  const { columns, rows } = layoutGrid(layout);
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => false),
  );
  let count = 0;
  for (const product of products.slice(0, limit)) {
    const size = cardSize(product, layout);
    let slot = null;
    for (let y = 0; y <= rows - size.height && !slot; y++) {
      for (let x = 0; x <= columns - size.width; x++) {
        if (
          Array.from({ length: size.height }, (_, dy) =>
            (cells[y + dy] ?? [])
              .slice(x, x + size.width)
              .every((used) => !used),
          ).every(Boolean)
        ) {
          slot = { x, y };
          break;
        }
      }
    }
    if (!slot) break;
    for (let y = slot.y; y < slot.y + size.height; y++)
      for (let x = slot.x; x < slot.x + size.width; x++) {
        const row = cells[y];
        if (row) row[x] = true;
      }
    count++;
  }
  return Math.max(1, count);
}

export function orderedStoreIndexes(
  campaign: Partial<Campaign>,
  count: number,
) {
  const all = Array.from({ length: count }, (_, index) => index);
  const order = Array.isArray(campaign?.storeOrder) ? campaign.storeOrder : [];
  return [
    ...new Set([
      ...order.filter(
        (index) => Number.isInteger(index) && index >= 0 && index < count,
      ),
      ...all,
    ]),
  ];
}

export function moveStore(order: number[], from: number, to: number) {
  const next = [...order];
  const start = next.indexOf(from);
  const end = next.indexOf(to);
  if (start < 0 || end < 0 || start === end) return next;
  next.splice(start, 1);
  next.splice(end, 0, from);
  return next;
}
