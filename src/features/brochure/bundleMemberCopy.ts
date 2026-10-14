import type { Product } from "../../domain/models";
import {
  catalogDetailFacts,
  detailPlainText,
  normalizedDetail,
  savedDetailEntries,
} from "./detailFacts";

// Each member keeps its own copy, even though all members share one offer price.
export function defaultBundleMemberText(member: Product): string {
  const facts = Array.isArray(member.brochureDetails)
    ? (savedDetailEntries(member) || []).map(([, value]) => value)
    : catalogDetailFacts(member)
        .filter(
          ({ key }) =>
            !/garanc|warrant|ngjyr|colou?r/.test(normalizedDetail(key)),
        )
        .map(({ key, value }) =>
          /^(?:fuqia|power|kapaciteti|capacity)$/i.test(normalizedDetail(key))
            ? value
            : key
              ? `${key}: ${value}`
              : value,
        );
  const rows = [...new Set(facts.filter(Boolean))];
  const warranty = member.hideWarranty ? "" : detailPlainText(member.warranty);
  if (warranty && !rows.some((line) => /garanc|warrant/i.test(line)))
    rows.push(`${warranty} GARANCION`);
  return [detailPlainText(member.name), ...rows].filter(Boolean).join("\n");
}

export function bundleMemberText(offer: Product, member: Product): string {
  return (
    offer.bundleMemberDetails?.[member.code] ?? defaultBundleMemberText(member)
  );
}
