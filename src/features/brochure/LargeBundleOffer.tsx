import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from "react";
import type { Product } from "../../domain/models";
import {
  isLargeBundleOffer,
  largeBundleLayout,
  largeBundlePanelColors,
  measuredBundleSeparators,
  type BundlePanelRect,
  type BundleSeparator,
  type LargeBundleLayout,
} from "./largeBundleLayout";
import {
  MissingCatalogNotice,
  missingCatalogCodes,
  productPhotoSource,
} from "./MissingCatalogNotice";
import "../../styles/large-bundle-offer.css";
import { effectiveProductArtworks } from "./productArtwork";
import { productArtworkPhotoBox } from "./ProductArtworkLayer";
import { BundleVariantColors } from "./BundleVariantColors";

function BundleSeparators({
  layout,
  memberCodes,
}: {
  layout: LargeBundleLayout;
  memberCodes: string[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<BundleSeparator[] | null>(null);
  const membersKey = memberCodes.join("\n");
  useLayoutEffect(() => {
    const root = rootRef.current?.closest<HTMLElement>(".large-bundle-offer");
    const artwork = root?.querySelector<HTMLElement>(
      ".large-bundle-artwork-slot",
    );
    if (!root || !artwork) return;
    const update = () => {
      const bounds: Array<BundlePanelRect | null> = memberCodes.map((code) => {
        const frame = [
          ...artwork.querySelectorAll<HTMLElement>(".bundle-product-image"),
        ].find((node) => node.dataset.bundleArtworkCode === code);
        const image = frame?.querySelector<HTMLImageElement>(":scope > img");
        return productArtworkPhotoBox(image, root);
      });
      const next = measuredBundleSeparators(layout, bounds);
      setMeasured((current) =>
        current &&
        current.length === next.length &&
        current.every(
          (point, index) =>
            Math.abs(point.x - next[index]!.x) < 0.005 &&
            Math.abs(point.y - next[index]!.y) < 0.005 &&
            point.startsRow === next[index]!.startsRow,
        )
          ? current
          : next,
      );
    };
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(update) : null;
    observer?.observe(root);
    const observeFrames = () => {
      artwork
        .querySelectorAll(".bundle-product-image,.bundle-product-image > img")
        .forEach((node) => observer?.observe(node));
      update();
    };
    const changes =
      typeof MutationObserver === "function"
        ? new MutationObserver(observeFrames)
        : null;
    changes?.observe(artwork, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style", "src", "data-bundle-artwork-code"],
    });
    root.addEventListener("load", update, true);
    root.addEventListener("error", update, true);
    root.addEventListener("brochure-photo-clearance", update);
    window.addEventListener("beforeprint", update);
    observeFrames();
    return () => {
      observer?.disconnect();
      changes?.disconnect();
      root.removeEventListener("load", update, true);
      root.removeEventListener("error", update, true);
      root.removeEventListener("brochure-photo-clearance", update);
      window.removeEventListener("beforeprint", update);
    };
  }, [membersKey, layout.columns, layout.rows]);
  return (
    <div className="large-bundle-separators" ref={rootRef}>
      {(measured ?? layout.separators).map((separator, index) => (
        <span
          key={index}
          className={`large-bundle-plus${separator.startsRow ? " starts-row" : ""}`}
          aria-hidden="true"
          style={{ left: `${separator.x}%`, top: `${separator.y}%` }}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <path d="M10 4v12M4 10h12" />
          </svg>
        </span>
      ))}
    </div>
  );
}

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
      <BundleSeparators
        layout={layout}
        memberCodes={members.map((member) => String(member.code))}
      />
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
            {product.hideColors !== true && (
              <BundleVariantColors product={member} showNames={false} />
            )}
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
