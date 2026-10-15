import type { Campaign, Product } from "../../domain/models";
import { normalize } from "../brochure/utils";
import { resolveBrochureFormat } from "../brochure/brochureFormat";
export interface CampaignFilters {
  query: string;
  status: string;
  period: string;
  type: string;
  format: string;
  from: string;
  to: string;
  sort: string;
}
export const emptyCampaignFilters: CampaignFilters = {
  query: "",
  status: "all",
  period: "all",
  type: "all",
  format: "all",
  from: "",
  to: "",
  sort: "updated_desc",
};
const statuses = [
  "all",
  "in_progress",
  "in_review",
  "changes_requested",
  "completed",
];
const periods = ["all", "past", "current", "upcoming", "one_day"];
const sorts = [
  "updated_desc",
  "updated_asc",
  "start_desc",
  "start_asc",
  "name",
];
function date(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return "";
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? value
    : "";
}
/** Browser preferences are untrusted and may come from an older build. */
export function normalizeCampaignFilters(value: unknown): CampaignFilters {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const choice = (key: string, allowed: string[], fallback: string) =>
    typeof input[key] === "string" && allowed.includes(input[key])
      ? input[key]
      : fallback;
  const text = (key: string, fallback: string, max: number) =>
    typeof input[key] === "string" ? input[key].slice(0, max) : fallback;
  let from = date(input.from),
    to = date(input.to);
  if (from && to && from > to) [from, to] = [to, from];
  return {
    query: text("query", "", 500),
    status: choice("status", statuses, "all"),
    period: choice("period", periods, "all"),
    type: text("type", "all", 200),
    format: text("format", "all", 200),
    from,
    to,
    sort: choice("sort", sorts, "updated_desc"),
  };
}
export function campaignToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}
function searchProduct(product: Product): unknown[] {
  return [
    product.code,
    product.name,
    product.brand,
    (product as Product & { model?: string }).model,
    product.category,
    product.subcategory,
    ...(product.bundleProducts || []).flatMap(searchProduct),
  ];
}
function interval(item: Campaign) {
  const first = date(item.startDate),
    last = date(item.endDate);
  const start = first || last,
    end = last || first;
  return start > end ? { start: end, end: start } : { start, end };
}
export function filterCampaigns(
  campaigns: Campaign[],
  input: CampaignFilters,
  now = new Date(),
) {
  const filters = normalizeCampaignFilters(input),
    today = campaignToday(now);
  const terms = normalize(filters.query).split(/\s+/).filter(Boolean);
  return campaigns
    .filter((item) => {
      const searchable = normalize(
        [
          item.name,
          item.type,
          item.startDate,
          item.endDate,
          ...(item.products || []).flatMap(searchProduct),
        ].join(" "),
      );
      if (!terms.every((term) => searchable.includes(term))) return false;
      if (
        filters.status !== "all" &&
        (item.status || "in_progress") !== filters.status
      )
        return false;
      if (filters.type !== "all" && item.type !== filters.type) return false;
      if (
        filters.format !== "all" &&
        resolveBrochureFormat(item).id !== filters.format
      )
        return false;
      const { start, end } = interval(item);
      // Undated drafts are neither past, current, upcoming nor one-day campaigns.
      if (
        (filters.from || filters.to || filters.period !== "all") &&
        (!start || !end)
      )
        return false;
      if (filters.from && end < filters.from) return false;
      if (filters.to && start > filters.to) return false;
      if (filters.period === "one_day" && start !== end) return false;
      if (filters.period === "past" && end >= today) return false;
      if (filters.period === "current" && !(start <= today && end >= today))
        return false;
      if (filters.period === "upcoming" && start <= today) return false;
      return true;
    })
    .sort((a, b) => {
      const time = (item: Campaign) =>
        Date.parse(item.updatedAt || item.createdAt || "") || 0;
      if (filters.sort === "updated_asc") return time(a) - time(b);
      if (filters.sort === "name") return a.name.localeCompare(b.name);
      if (filters.sort === "start_asc" || filters.sort === "start_desc") {
        const first = interval(a).start,
          last = interval(b).start;
        if (!first || !last) return first ? -1 : last ? 1 : 0;
        return filters.sort === "start_asc"
          ? first.localeCompare(last)
          : last.localeCompare(first);
      }
      return time(b) - time(a);
    });
}
