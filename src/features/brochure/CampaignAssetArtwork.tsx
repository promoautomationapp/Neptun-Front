import React from "react";
import type { Campaign, Placement, Product } from "../../domain/models";
import { ProductDetailBlock } from "./ProductDetailBlock";
import { readImage } from "./utils";
import { t } from "./i18n";
export interface CampaignAsset { image?: string; hidden?: boolean; placement?: Placement; }
export type CampaignAssetChange = (key: string, changes: CampaignAsset) => void;
export function CampaignAssetArtwork({ campaign, assetKey, label, onChange, children, defaultWidth = "4cqw" }: { campaign: Campaign; assetKey: string; label: string; onChange?: CampaignAssetChange; children: React.ReactNode; defaultWidth?: string }) {
  const saved = campaign.campaignAssets?.[assetKey] || {};
  const upload = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState("");
  const key = `__asset-${assetKey}`;
  const product: Product = { code: assetKey, name: label, detailBlockPlacements: { [key]: saved.placement || {} } };
  if (saved.hidden) return onChange ? <button type="button" data-export-hide="true" className="brand-artwork-restore" onPointerDown={(event) => event.stopPropagation()} onClick={() => onChange(assetKey, { hidden: false })}>{t("Restore")} {label}</button> : null;
  async function replace(file?: File) {
    if (!file || !onChange) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) { setError(t("Choose an image under 12 MB.")); return; }
    try { onChange(assetKey, { image: await readImage(file) }); setError(""); } catch { setError(t("Could not read this image.")); }
  }
  return <ProductDetailBlock product={product} detailKey={key} className="campaign-asset-artwork" style={{ width: saved.placement?.width ? undefined : defaultWidth }}
    onChange={onChange ? (field, value) => { if (field === "detailBlockPlacements") onChange(assetKey, { placement: (value as Product["detailBlockPlacements"])?.[key] }); } : undefined}
    onEdit={onChange ? () => upload.current?.click() : undefined} onRemove={onChange ? () => onChange(assetKey, { hidden: true }) : undefined}>
    {saved.image ? <img src={saved.image} alt={label} draggable={false} /> : children}
    {onChange && <input hidden data-export-hide="true" ref={upload} type="file" accept="image/*" aria-label={`${t("Replace image")}: ${label}`} onChange={(event) => { replace(event.target.files?.[0]); event.target.value = ""; }} />}
    {error && <small role="alert" data-export-hide="true">{error}</small>}
  </ProductDetailBlock>;
}
