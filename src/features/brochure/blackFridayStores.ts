import type { Artwork, Campaign } from "../../domain/models";
import type { BrochurePage } from "./campaignPages";
import {
  blackFridayPage,
  blackFridayPageArtworkDefaults,
  isBlackCollectionBrochure,
  isBlackFridayBrochure,
} from "./blackFridayDesign";
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;

/** Saved source campaigns used a prize promotion as their final page. Leave
 * deliberate artwork edits intact while replacing unchanged source layers. */
export function blackFridayStoresPageContent(campaign: Campaign): Campaign {
  if (!isBlackFridayBrochure(campaign)) return campaign;
  const defaults = new Map(
    blackFridayPageArtworkDefaults("stores").map((item) => [item.id, item]),
  );
  const current = campaign.pageArtworks?.stores;
  if (!current?.length) return campaign;
  const filtered = current.filter((item) => {
    const native = defaults.get(item.id);
    if (!native) return true;
    // The person selector adds source metadata even when the original image is
    // kept. This metadata is not a deliberate change to the artwork itself.
    const comparable = (artwork: Artwork) =>
      Object.fromEntries(
        Object.entries(artwork).filter(
          ([key]) =>
            !["source", "referenceSource", "referenceRole"].includes(key),
        ),
      );
    return (
      JSON.stringify(canonical(comparable(item))) !==
      JSON.stringify(canonical(comparable(native)))
    );
  });
  return filtered.length === current.length
    ? campaign
    : {
        ...campaign,
        pageArtworks: { ...campaign.pageArtworks, stores: filtered },
      };
}

/** The source's page12 offers already finish above its 14% stores reservation.
 * Remove only unchanged native footer layers; saved edits remain user artwork. */
export function blackFridayStoresContent(
  campaign: Campaign,
  page?: BrochurePage,
) {
  if (
    !isBlackFridayBrochure(campaign) ||
    isBlackCollectionBrochure(campaign) ||
    page?.index !== 10
  )
    return { campaign, reserved: false };
  const source = blackFridayPage(12);
  const reserved = Boolean(
    source &&
    page.products.length === source.frames.length &&
    page.products.every((product) =>
      source.frames.some((frame) => frame.code === product.code),
    ) &&
    !page.products.some((product) => product.brochureContentPlacement?.frame),
  );
  const key = "product-10";
  const defaults = blackFridayPageArtworkDefaults(key);
  const footers = new Map(
    defaults.filter((item) => item.y >= 85).map((item) => [item.id, item]),
  );
  const current = campaign.pageArtworks?.[key] || defaults;
  const filtered = current.filter((item) => {
    const native = footers.get(item.id);
    return (
      !native ||
      JSON.stringify(canonical(item)) !== JSON.stringify(canonical(native))
    );
  });
  return {
    campaign: {
      ...campaign,
      pageArtworks: { ...campaign.pageArtworks, [key]: filtered as Artwork[] },
    },
    reserved,
  };
}
