import type { Campaign, Product } from "../../domain/models";
import {
  appleProductFamily,
  isBrochureAccessory,
  isMacBook,
} from "./productTypes";
import { isTelevision } from "./tvSpecs";
import { categorySegments } from "../settings/categoryHierarchy";

export const BROCHURE_LAYOUTS = [
  {
    id: "feature3",
    name: "Three offers · one above two",
    detail: "One featured offer above two products",
    capacity: 3,
    columns: 2,
    rows: 2,
  },
  {
    id: "tv8",
    name: "Eight TVs · 3–2–3",
    detail: "Three TVs above, two larger TVs in the middle, three below",
    capacity: 8,
    columns: 6,
    rows: 3,
  },
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
  {
    id: "pair2",
    name: "Two offers · one above one",
    detail: "One centered column and two rows",
    capacity: 2,
    columns: 1,
    rows: 2,
  },
];

const canonicalLayout = (layout: string) =>
  ["grid4", "duo", "feature"].includes(layout) ? "duo4" : layout;
const isOctoberLayout = (campaign: Partial<Campaign>) =>
  campaign.brochureVisualStyle === "october" ||
  campaign.brochurePresetId === "neptun-october";

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
    isOctoberLayout(campaign) &&
    automaticProductLayout(campaign, pageIndex)
  ) {
    const run = consecutiveOctoberProducts(products);
    const family = run[0] ? appleProductFamily(run[0]) : null;
    if ((family === "macbook" || family === "ipad") && run.length <= 2)
      return "pair2";
    return run[0] && isBrochureAccessory(run[0]) ? "grid6portrait" : "duo4";
  }
  if (
    automaticProductLayout(campaign, pageIndex) &&
    (!campaign.layout || campaign.layout === "feature3") &&
    products[0] &&
    isTelevision(products[0])
  )
    return "tv8";
  if (
    automaticProductLayout(campaign, pageIndex) &&
    products[0] &&
    isMacBook(products[0])
  )
    return "duo4";
  return campaign.layout || "feature3";
}

export function productPageChunk(
  campaign: Partial<Campaign>,
  products: Product[],
  pageIndex: number,
) {
  const layout = productPageLayout(campaign, products, pageIndex);
  let run = products;
  if (automaticProductLayout(campaign, pageIndex) && products.length) {
    if (isOctoberLayout(campaign)) run = consecutiveOctoberProducts(products);
    else {
      const kind = (product: Product) =>
        isMacBook(product)
          ? "macbook"
          : (!campaign.layout || campaign.layout === "feature3") &&
              isTelevision(product)
            ? "tv"
            : "other";
      const firstKind = kind(products[0]!);
      const boundary = products.findIndex((item) => kind(item) !== firstKind);
      if (boundary > 0) run = products.slice(0, boundary);
    }
  }
  const count = run.length
    ? fittingProductCount(run, layout, layoutCapacity(layout))
    : 0;
  return { layout, products: run.slice(0, count) };
}

function octoberProductGroup(product: Product) {
  const family = appleProductFamily(product);
  if (family) return `apple-${family}`;
  return isBrochureAccessory(product) ? "accessory" : "ordinary";
}

function consecutiveOctoberProducts(products: Product[]) {
  if (!products.length) return products;
  const group = octoberProductGroup(products[0]!);
  const boundary = products.findIndex(
    (product) => octoberProductGroup(product) !== group,
  );
  return boundary < 0 ? products : products.slice(0, boundary);
}

const normalizedCategory = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
const cleanCategory = (value: string | undefined) =>
  categorySegments(value || "")
    .at(-1)
    ?.replace(/\s+/g, " ")
    .trim() || "";

/** Keep a mixed page's ribbon empty instead of guessing its category. */
export function pageCategoryLabel(products: Product[]) {
  if (!products.length) return "";
  const categories = products.map((product) => {
    const path = categorySegments(product.categoryPath || "");
    return {
      category: cleanCategory(product.category) || path[0] || "",
      subcategory:
        cleanCategory(product.subcategory) ||
        (path.length > 1 ? path.at(-1)! : ""),
    };
  });
  for (const key of ["subcategory", "category"] as const) {
    const first = categories[0]![key];
    if (
      first &&
      categories.every(
        (category) =>
          normalizedCategory(category[key]) === normalizedCategory(first),
      )
    )
      return first;
  }
  return "";
}

export function cardSize(
  product: Partial<Product>,
  layout: string,
  index?: number,
) {
  const { columns, rows } = layoutGrid(layout);
  return {
    width: Math.max(
      1,
      Math.min(
        columns,
        Math.round(
          Number(product?.brochureCardSize?.width) ||
            ((product.bundleProducts?.length || 0) >= 3
              ? columns
              : layout === "tv8"
                ? index === 3 || index === 4
                  ? 3
                  : 2
                : layout === "feature3" && index === 0
                  ? 2
                  : 1),
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
function placeProductGrid(
  products: Product[],
  layout: string,
  limit = products.length,
) {
  if (
    (layout === "feature3" || layout === "tv8") &&
    !products.some(
      (product) =>
        product.brochureCardSize || (product.bundleProducts?.length || 0) >= 3,
    )
  ) {
    const count = Math.min(products.length, limit, layoutCapacity(layout));
    return {
      count,
      occupiedRows:
        layout === "feature3"
          ? count <= 1
            ? 1
            : 2
          : count <= 3
            ? 1
            : count <= 5
              ? 2
              : 3,
    };
  }
  const { columns, rows } = layoutGrid(layout);
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => false),
  );
  let count = 0,
    occupiedRows = 0;
  for (const [index, product] of products.slice(0, limit).entries()) {
    const size = cardSize(product, layout, index);
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
    occupiedRows = Math.max(occupiedRows, slot.y + size.height);
  }
  return { count, occupiedRows };
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

export function fittingProductCount(
  products: Product[],
  layout: string,
  limit = products.length,
) {
  return Math.max(1, placeProductGrid(products, layout, limit).count);
}
export function occupiedProductRows(
  products: Product[],
  layout: string,
  limit = products.length,
) {
  return Math.max(1, placeProductGrid(products, layout, limit).occupiedRows);
}
