import React from "react";
import { ProductDetailBlock } from "./ProductDetailBlock";
import { brandLogoFor } from "./brandLogos";
import { readImage } from "./utils";
import { t } from "./i18n";

import type { Campaign, Product } from "../../domain/models";
interface Props { campaign: Campaign; product: Product; onChange?: (field: keyof Product, value: Product[keyof Product]) => void; }
export function ProductBrandArtwork({ campaign, product, onChange }: Props) {
  const upload = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState("");
  const source = product.brandLogo || brandLogoFor(campaign, product.brand);
  if (product.hideBrandLogo) return onChange ? <button type="button" className="brand-artwork-restore" data-export-hide="true" onPointerDown={(event) => event.stopPropagation()} onClick={() => onChange("hideBrandLogo", false)}>{t("Restore brand logo")}</button> : null;
  async function replace(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) { setError(t("Choose an image under 12 MB.")); return; }
    try { onChange?.("brandLogo", await readImage(file)); setError(""); }
    catch { setError(t("Could not read this image.")); }
  }
  return <ProductDetailBlock product={product} detailKey="__brand" className="brochure-brand-artwork" onChange={onChange}
    onEdit={onChange ? () => upload.current?.click() : undefined} onRemove={onChange ? () => onChange("hideBrandLogo", true) : undefined}>
    <strong className="brochure-brand-mark">{source ? <img src={source} alt={product.brand || "NEPTUN"} loading="eager" draggable={false} /> : product.brand || "NEPTUN"}</strong>
    {onChange && <input ref={upload} data-export-hide="true" type="file" accept="image/*" aria-label={`${t("Replace brand logo")}: ${product.name}`} hidden onChange={(event) => { replace(event.target.files?.[0]); event.target.value = ""; }} />}
    {error && <small role="alert" data-export-hide="true">{error}</small>}
  </ProductDetailBlock>;
}
