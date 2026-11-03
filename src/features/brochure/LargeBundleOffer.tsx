import type { CSSProperties, ReactNode, Ref } from "react";
import type { Product } from "../../domain/models";
import {
  isLargeBundleOffer,
  largeBundleLayout,
  largeBundlePanelColors,
} from "./largeBundleLayout";
import {
  MissingCatalogNotice,
  missingCatalogCodes,
  productPhotoSource,
} from "./MissingCatalogNotice";
import "../../styles/large-bundle-offer.css";
import { effectiveProductArtworks } from "./productArtwork";

export interface LargeBundleOfferProps {
  product: Product;
  pageColor?: string;
  panelColor?: string;
  photoAreaRef?: Ref<HTMLDivElement>;
  artwork: ReactNode;
  brand?: ReactNode;
  savings?: ReactNode;
  price: ReactNode;
  controls?: ReactNode;
  renderMember: (member: Product, index: number) => ReactNode;
  className?: string;
  editable?: boolean;
  onEditMemberImage?: (member: Product) => void;
  onFindMemberImage?: (member: Product) => void | Promise<void>;
}

/** Slots keep the existing price, image and detail editors in charge of their gestures and saved data. */
export function LargeBundleOffer({
  product,
  pageColor,
  panelColor,
  photoAreaRef,
  artwork,
  brand,
  savings,
  price,
  controls,
  renderMember,
  className = "",
  editable = false,
  onEditMemberImage,
  onFindMemberImage,
}: LargeBundleOfferProps) {
  if (!isLargeBundleOffer(product)) return null;
  const members = product.bundleProducts ?? [];
  const layout = largeBundleLayout(members.length);
  if (!layout) return null;
  const colors = largeBundlePanelColors(
    pageColor,
    panelColor ?? product.bundlePanelColor,
  );
  const style: CSSProperties &
    Record<`--large-bundle-${string}`, string | number> = {
    "--large-bundle-panel-color": colors.background,
    "--large-bundle-copy-color": colors.foreground,
    "--large-bundle-brand-filter":
      colors.foreground === "#ffffff"
        ? "brightness(0) invert(1)"
        : "brightness(0)",
  };
  const artworks = effectiveProductArtworks(product);
  return (
    <div
      className={`large-bundle-offer ${className}`}
      style={style}
      role="group"
      aria-label={product.name}
      data-bundle-members={members.length}
      data-bundle-columns={layout.columns}
      data-bundle-rows={layout.rows}
    >
      <div className="large-bundle-panel" aria-hidden="true" />
      <div
        className="large-bundle-photo-area"
        ref={photoAreaRef}
        style={{
          left: `${layout.photoArea.x}%`,
          top: `${layout.photoArea.y}%`,
          width: `${layout.photoArea.width}%`,
          height: `${layout.photoArea.height}%`,
        }}
      >
        {editable &&
          members.map((member, index) => {
            const photo = layout.members[index]!.image;
            const saved = artworks.find(
              (item) =>
                item.type === "bundle-product" &&
                String(item.memberCode) === String(member.code),
            );
            const source = saved
              ? saved.image
              : (index === 0 ? product.image : "") ||
                productPhotoSource(member);
            const missing =
              member.catalogMissing || missingCatalogCodes(member).length > 0;
            const edit = onEditMemberImage
              ? () => onEditMemberImage(member)
              : undefined;
            if (source && !missing) return null;
            return (
              <div
                key={`${member.code}-catalog-notice`}
                className={
                  source
                    ? "large-bundle-missing-badge"
                    : "large-bundle-missing-photo"
                }
                style={{
                  left: `${saved?.x ?? photo.x}%`,
                  top: `${saved?.relativeTo === "photo-area" ? saved.y : (((saved?.y ?? photo.y) - layout.photoArea.y) * 100) / layout.photoArea.height}%`,
                  width: `${saved?.width ?? photo.width}%`,
                  ...(source
                    ? {}
                    : {
                        height: `${saved?.relativeTo === "photo-area" ? (saved.height ?? photo.height) : ((saved?.height ?? photo.height) * 100) / layout.photoArea.height}%`,
                      }),
                }}
                data-export-hide="true"
              >
                <MissingCatalogNotice
                  product={member}
                  variant={source ? "badge" : "placeholder"}
                  onOpenEditor={edit}
                  onFindImage={
                    onFindMemberImage
                      ? () => onFindMemberImage(member)
                      : undefined
                  }
                />
              </div>
            );
          })}
      </div>
      <div className="large-bundle-artwork-slot">{artwork}</div>
      {layout.separators.map((separator, index) => (
        <span
          key={index}
          className="large-bundle-plus"
          aria-hidden="true"
          style={{ left: `${separator.x}%`, top: `${separator.y}%` }}
        >
          +
        </span>
      ))}
      {members.map((member, index) => {
        const copy = layout.members[index]!.copy;
        return (
          <div
            key={`${member.code}-${index}`}
            className="large-bundle-member-copy"
            data-bundle-member-code={member.code}
            style={{
              left: `${copy.x}%`,
              top: `${copy.y}%`,
              width: `${copy.width}%`,
              minHeight: `${copy.height}%`,
            }}
          >
            {renderMember(member, index)}
          </div>
        );
      })}
      <div className="large-bundle-brand-slot">{brand}</div>
      <div className="large-bundle-savings-slot">{savings}</div>
      <div className="large-bundle-price-slot">{price}</div>
      {controls && <div className="large-bundle-controls-slot">{controls}</div>}
    </div>
  );
}
