import type { Campaign } from "../../domain/models";
import { includesStoresPage, selectedStoreIndexes } from "./storesSelection";

export interface ProofreadFields {
  cover?: boolean;
  footer?: boolean;
  name?: boolean;
  description?: boolean;
  specs?: boolean;
}
export interface ProofreadItem {
  id: string;
  key: string;
  label: string;
  text: string;
  brand: string;
}
export interface ProofreadMetadata {
  scope: string;
  code: string;
  field: string;
  specKey: string;
  label: string;
  fieldKey: string;
}
interface ReviewedProposal {
  type: string;
  fieldKey?: string;
  original: string;
  suggested: string;
}
// Stable field keys let a brochure review check only text that changed.
function key(scope: string, code: string, field: string, specKey = "") {
  return JSON.stringify([scope, String(code ?? ""), field, specKey]);
}

export function legacyTextSnapshot(campaign: Campaign) {
  return JSON.stringify([
    campaign.coverHeadline ?? campaign.name,
    campaign.tagline,
    campaign.paymentText,
    (campaign.products || []).map((item) => [
      item.code,
      item.name,
      item.description,
      item.specs,
    ]),
  ]);
}

export function buildProofreadItems(
  campaign: Campaign,
  selectedCodes: Set<string>,
  fields: ProofreadFields,
) {
  const items: ProofreadItem[] = [];
  const metadata = new Map<string, ProofreadMetadata>();
  function add(
    scope: string,
    code: string,
    field: string,
    label: string,
    value: unknown,
    brand = "",
    specKey = "",
    identity = specKey,
  ) {
    if (typeof value !== "string" || !value.trim()) return;
    const id = `f${items.length}`;
    const fieldKey = key(scope, code, field, identity);
    items.push({ id, key: fieldKey, label, text: value, brand });
    metadata.set(id, { scope, code, field, specKey, label, fieldKey });
  }
  if (fields.cover) {
    add("campaign", "", "name", "Campaign name", campaign.name);
    add("campaign", "", "type", "Campaign type", campaign.type);
    if (campaign.coverHeadline !== undefined)
      add(
        "campaign",
        "",
        "coverHeadline",
        "Cover headline",
        campaign.coverHeadline,
      );
    add("campaign", "", "tagline", "Cover message", campaign.tagline);
    if (campaign.paymentText !== undefined)
      add(
        "campaign",
        "",
        "paymentText",
        "Payment message",
        campaign.paymentText,
      );
  }
  if (fields.footer) {
    const contact = campaign.storesSnapshot?.contact || {};
    add(
      "contact",
      "",
      "disclaimer",
      "Stores page disclaimer",
      contact.disclaimer,
    );
    add(
      "contact",
      "",
      "serviceAddress",
      "Service address",
      contact.serviceAddress,
    );
    if (includesStoresPage(campaign)) {
      const stores = campaign.storesSnapshot?.stores || [];
      for (const index of selectedStoreIndexes(campaign, stores.length)) {
        const store = stores[index];
        if (!store) continue;
        add(
          "store",
          String(index),
          "city",
          `Store ${index + 1} · City`,
          store.city,
        );
        add(
          "store",
          String(index),
          "name",
          `Store ${index + 1} · Name`,
          store.name,
        );
        add(
          "store",
          String(index),
          "address",
          `Store ${index + 1} · Address`,
          store.address,
        );
      }
    }
  }
  for (const product of campaign.products || []) {
    if (!selectedCodes.has(String(product.code))) continue;
    const label = `${product.brand || ""} · ${product.code}`;
    if (fields.name)
      add(
        "product",
        String(product.code),
        "name",
        `${label} · Product name`,
        product.name,
        product.brand,
      );
    if (fields.name)
      add(
        "product",
        String(product.code),
        "warranty",
        `${label} · Warranty`,
        product.warranty,
        product.brand,
      );
    if (fields.description)
      add(
        "product",
        String(product.code),
        "description",
        `${label} · Description`,
        product.description,
        product.brand,
      );
    if (fields.specs) {
      for (const [index, [specKey, value]] of Object.entries(
        product.specs || {},
      ).entries()) {
        if (!String(value).trim()) continue;
        add(
          "product",
          String(product.code),
          "specLabel",
          `${label} · Detail label`,
          specKey,
          product.brand,
          specKey,
          String(index),
        );
        add(
          "product",
          String(product.code),
          "specs",
          `${label} · ${specKey}`,
          value,
          product.brand,
          specKey,
          String(index),
        );
      }
    }
  }
  return { items, metadata };
}

function reviewedValues(campaign: Campaign, items: ProofreadItem[]) {
  if (
    campaign.aiReviewedFields &&
    typeof campaign.aiReviewedFields === "object"
  )
    return campaign.aiReviewedFields;
  const reviewed: Record<string, string> = {};
  if (
    !campaign.aiReviewedTextSnapshot ||
    campaign.aiReviewedTextSnapshot !== legacyTextSnapshot(campaign)
  )
    return reviewed;
  // Existing campaigns already reviewed these fields under the old snapshot.
  for (const item of items) {
    const [scope, , field] = JSON.parse(item.key);
    if (
      (scope === "product" &&
        ["name", "description", "specs"].includes(field)) ||
      (scope === "campaign" &&
        (field === "tagline" ||
          field === "paymentText" ||
          (field === "name" && campaign.coverHeadline === undefined) ||
          (field === "coverHeadline" && campaign.coverHeadline !== undefined)))
    )
      reviewed[item.key] = item.text;
  }
  return reviewed;
}

export function dirtyProofreadItems(
  campaign: Campaign,
  items: ProofreadItem[],
) {
  const reviewed = reviewedValues(campaign, items);
  const history = campaign.aiReviewedFieldHistory || {};
  return items.filter(
    (item) =>
      reviewed[item.key] !== item.text &&
      !history[item.key]?.includes(item.text),
  );
}

export function needsTextReview(campaign: Campaign) {
  const selectedCodes = new Set(
    (campaign.products || []).map((item) => String(item.code)),
  );
  const { items } = buildProofreadItems(campaign, selectedCodes, {
    cover: true,
    footer: true,
    name: true,
    description: true,
    specs: true,
  });
  return dirtyProofreadItems(campaign, items).length > 0;
}

export function recordTextReview(
  campaign: Campaign,
  proposals: ReviewedProposal[] = [],
  checkedItems?: ProofreadItem[],
) {
  const selectedCodes = new Set(
    campaign.products.map((item) => String(item.code)),
  );
  const { items } = buildProofreadItems(campaign, selectedCodes, {
    cover: true,
    footer: true,
    name: true,
    description: true,
    specs: true,
  });
  const checked = checkedItems ?? items;
  const history = { ...(campaign.aiReviewedFieldHistory ?? {}) };
  const reviewed = { ...reviewedValues(campaign, items) };
  const currentByKey = new Map(items.map((item) => [item.key, item.text]));
  const remember = (fieldKey: string, value: string) => {
    if (!fieldKey || !value.trim()) return;
    const previous = history[fieldKey] ?? [];
    if (!previous.includes(value)) history[fieldKey] = [...previous, value];
  };
  for (const item of checked) {
    remember(item.key, item.text);
    reviewed[item.key] = item.text;
  }
  const checkedByKey = new Map(checked.map((item) => [item.key, item.text]));
  for (const proposal of proposals) {
    if (
      proposal.type !== "text" ||
      !proposal.fieldKey ||
      checkedByKey.get(proposal.fieldKey) !== proposal.original
    )
      continue;
    remember(proposal.fieldKey, proposal.original);
    remember(proposal.fieldKey, proposal.suggested);
    if (currentByKey.get(proposal.fieldKey) === proposal.suggested)
      reviewed[proposal.fieldKey] = proposal.suggested;
  }
  campaign.aiReviewedFieldHistory = history;
  campaign.aiReviewedFields = reviewed;
  if (!dirtyProofreadItems(campaign, items).length)
    campaign.aiReviewedTextSnapshot = legacyTextSnapshot(campaign);
  else delete campaign.aiReviewedTextSnapshot;
}
