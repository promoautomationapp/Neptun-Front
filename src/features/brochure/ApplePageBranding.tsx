import type { Campaign, Product } from "../../domain/models";
import {
  CampaignAssetArtwork,
  type CampaignAssetChange,
} from "./CampaignAssetArtwork";
import { OCTOBER_ASSETS } from "./octoberDesign";
import { isAppleProduct } from "./productTypes";
import "../../styles/apple-page-branding.css";

export function allAppleProducts(products: readonly Product[]) {
  return products.length > 0 && products.every(isAppleProduct);
}

/** Keep an offer's edits when it moves to another mixed-brand page. */
export function appleOfferResellerAssetKey(product: Product) {
  return `offer-${product.code}-apple-reseller`;
}

function AppleResellerArtwork({
  campaign,
  assetKey,
  onChange,
}: {
  campaign: Campaign;
  assetKey: string;
  onChange?: CampaignAssetChange;
}) {
  return (
    <CampaignAssetArtwork
      campaign={campaign}
      assetKey={assetKey}
      label="Apple Authorised Reseller"
      onChange={onChange}
      defaultWidth="100%"
    >
      <img
        className="brochure-apple-reseller-default"
        src={OCTOBER_ASSETS.apple}
        alt="Apple Authorised Reseller"
        draggable={false}
      />
    </CampaignAssetArtwork>
  );
}

/** One replaceable page mark, kept out of the individual Apple photographs. */
export function ApplePageBranding({
  campaign,
  products,
  pageKey,
  onChange,
}: {
  campaign: Campaign;
  products: readonly Product[];
  pageKey: string;
  onChange?: CampaignAssetChange;
}) {
  if (!allAppleProducts(products)) return null;
  return (
    <div className="brochure-apple-page-branding">
      <AppleResellerArtwork
        campaign={campaign}
        assetKey={`${pageKey}-apple-reseller`}
        onChange={onChange}
      />
    </div>
  );
}

/** Mixed pages give each Apple offer its own editable mark in the offer frame. */
export function AppleOfferBranding({
  campaign,
  product,
  onChange,
}: {
  campaign: Campaign;
  product: Product;
  onChange?: CampaignAssetChange;
}) {
  if (!isAppleProduct(product)) return null;
  return (
    <div className="brochure-apple-offer-branding">
      <AppleResellerArtwork
        campaign={campaign}
        assetKey={appleOfferResellerAssetKey(product)}
        onChange={onChange}
      />
    </div>
  );
}
