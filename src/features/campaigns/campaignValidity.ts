import { useEffect, useState } from "react";
import type { Campaign } from "../../domain/models";
/** Validity is separate from review approval: reaching the end date never deletes or locks a brochure. */
export function workspaceDate(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function campaignValidity(
  campaign: Pick<Campaign, "startDate" | "endDate">,
  now = new Date(),
): "expired" | "active" | "upcoming" | null {
  const valid = (value: unknown): value is string =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
  const end = valid(campaign.endDate) ? campaign.endDate : "";
  const start = valid(campaign.startDate) ? campaign.startDate : "";
  if (!end || (start && start > end)) return null;
  const today = workspaceDate(now);
  return end < today
    ? "expired"
    : start && start > today
      ? "upcoming"
      : "active";
}
/** Refresh an already-open tab across midnight and after the computer wakes. */
export function useCampaignClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 30_000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  return now;
}
