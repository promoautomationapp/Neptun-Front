import { FileUpload } from "../../components/FileUpload";
import { NavIcon } from "../studio/NavIcon";
import { CloseIcon } from "../../components/CloseIcon";
import { SearchableSelect } from "../../components/SearchableSelect";
import {ReusableImages,droppedReusableImage,REUSABLE_IMAGE_TYPE} from "../settings/ReusableImages";
import type {Settings} from "../../domain/models";
import type {LogoAsset} from "../settings/settings.schema";
import type { Artwork, Campaign, Placement, Product, SocialPost } from "../../domain/models";
import { requestAi, type ProofreadChange } from "../ai/ai.api";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SocialApplePhotoClearance } from "./SocialApplePhotoClearance";
import { SocialOfferFrame } from "./SocialOfferFrame";
import { SocialProductDetails, socialProductDetailEntries } from "./SocialProductDetails";
import { captureSocialPost } from "./socialExport";
import { ProductBrandArtwork } from "../brochure/ProductBrandArtwork";
import { getPosts, savePost, removePost, restorePost } from "./socialStorage";
import {
  createPost,
  clearPostImagePreparation,
  cssBackground,
  outputDimensions,
  productForPost,
  postPriceCampaign,
  postPriceProduct,
  postImageBackgroundContext,
  reorderByCode,
  layoutSocialProducts,
  SOCIAL_PRESETS,
  QUALITY_PRESETS,
} from "./postModel";
import { ProductImageEditor } from "../brochure/ProductImageEditor";
import { ScreenImageEditor } from "../brochure/ScreenImageEditor";
import { hasEditableScreen, otherScreenInches, tvScreenInches } from "../brochure/tvSpecs";
import { CanvasAsset, EditableOfferBlock, SocialProductVisual } from "./CanvasLayers";
import { readImage } from "../brochure/utils";
import { money, discount } from "../brochure/Brochure";
import { isAppleProduct, usesBlueReferencePrice, usesRedReferencePrice } from "../brochure/priceDesign";
import { ReferencePriceCard } from "../brochure/ReferencePriceCard";
import { RedReferencePrice, RedReferenceSavings } from "../brochure/RedReferencePrice";
import { defaultProductDetailPlacement, isMobilePhone } from "../brochure/mobileDetails";
import { reorderDisplayedDetails } from "../brochure/detailRows";
import { productColors } from "../brochure/colors";
import { warrantyDuration } from "../brochure/warranty";
import { ProductDetailBlock } from "../brochure/ProductDetailBlock";
import { isAirConditioner } from "../brochure/productArtwork";
import { ProductArtworkControls } from "../brochure/ProductArtworkControls";
import { t } from "../brochure/i18n";
import { loadPreparedBrandLogos } from "../brochure/brandLogos";
import { lightBackground, validBackgroundColor } from "../brochure/pageBackground";
import { RichTextModal, safeRichHtml } from "./RichTextModal";
import { StudioSelect } from "./StudioSelect";
import { ImageUploadButton } from "../brochure/ImageUploadButton";
import { ColorField } from "../brochure/ColorField";
import { GRADIENT_DIRECTIONS } from "../brochure/gradientDirections";
import { plainBackgroundPreview } from "./plainBackgroundPreview";
import { NeptunWordmark } from "../brochure/NeptunWordmark";
import { BrandLogoManager } from "../brochure/BrandLogoManager";
import "./social.css";
import "../../styles/social-product-offer.css";

const POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];
const EVENT_LOGOS = [
  { id: "happy-day", label: "Happy Day" },
  { id: "back-school", label: "Back to School" },
  { id: "e-days", label: "e-days" },
];
const TEMPLATES = [
  {
    id: "classic",
    label: "NEPTUN classic",
    detail: "Strong blue canvas and red offer card",
  },
  {
    id: "editorial",
    label: "Editorial",
    detail: "More room for product and story",
  },
  {
    id: "minimal",
    label: "Clean product",
    detail: "Quiet layout with simple price",
  },
  {
    id: "spotlight",
    label: "Spotlight",
    detail: "Full background photo with readable overlay",
  },
];
const PRICE_STYLES = [
  { id: "current", label: "Red haPPy offer", detail: "Red price, crossed original and blue installment strip" },
  { id: "card", label: "Blue brochure card", detail: "Savings tab, regular price, haPPy price and monthly amount" },
];
const normalizedPriceStyle = (value?: string): string =>
  value === "card" || value === "compact" ? "card" : "current";
const DETAIL_STYLES = [
  { id: "chips", label: "Outlined specifications", detail: "Brochure detail tiles with editable text, size and fill" },
  { id: "simple", label: "Brand and name", detail: "Clean product copy without feature chips" },
];
const POST_VISIBILITY = [
  ["showDetails", "Product name & brand"],
  ["showSpecs", "Specification chips"],
  ["showInches", "Screen inches"],
  ["showPrice", "Price"],
  ["showRegular", "Original price"],
  ["showSaving", "Saving badge"],
  ["showInstallments", "12 installments"],
] as const;
type ProductChange = (code: string, field: keyof Product | Partial<Product>, value?: Product[keyof Product] | null) => void;
type PostMutator = (draft: SocialPost) => void;
type ReviewItem = { id: string; key: string; label: string; text: string; brand: string };
type AssetPlacement = { x: number; y: number; width: number };
interface PostCanvasProps {
  post: SocialPost;
  onMove?: (code: string, x: number, y: number) => void;
  onResize?: (code: string, width: number, point: {x: number; y: number}) => void;
  onEditProduct?: (code: string) => void;
  onEditScreen?: (code: string) => void;
  imageAdjustCode?: string | null;
  onToggleImageAdjust?: (code: string) => void;
  onPlaceImage?: (code: string, placement: Placement) => void;
  onEditDetails?: (code: string) => void;
  onReorderDetails?: (code: string, from: number, to: number) => void;
  onMoveOfferBlock?: (code: string, kind: string, placement: Placement) => void;
  onChangeProduct?: ProductChange;
  onDropImage?: (code: string, file: File) => void;
  onAddSavedArtwork?: (asset:LogoAsset,point:{x:number;y:number})=>void;
  onAddArtwork?: (files: File[], point: {x: number; y: number}) => void;
  onUpdateAsset?: (id: string, value: AssetPlacement) => void;
  onRemoveArtwork?: (id: string) => void;
  showGuides?: boolean;
  canvasRef?: React.Ref<HTMLDivElement>;
  maxWidth?: number | string;
  previewCutouts?: Record<string, string>;
}
interface SocialStudioProps {
  settings?: Settings;
  canManageDisabled?: boolean;
  canViewCatalog?: boolean;
  catalog: Product[];
  campaigns: Campaign[];
  seed?: {campaignId: string; products: Product[]} | null;
  onSeedUsed?: () => void;
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function DesignPreview({ kind, id, image }: {kind: string; id: string; image?: string}) {
  return <span className={`social-design-preview ${kind}-${id}`} aria-hidden="true">
    {kind === "template" && <><i className="mini-logo">N</i><span className="mini-product">{image && <img src={imageSource(image)} alt="" />}</span><span className="mini-copy">PRODUCT<br />4K · UHD</span><span className="mini-offer">399€</span></>}
    {kind === "price" && <><span className="mini-saving">SAVE 100€</span><del>499€</del><strong>399€</strong><small>12 × 33,25€</small></>}
    {kind === "detail" && <><strong>LG</strong><span>TV LED 55″</span>{id === "chips" && <small>4K UHD &nbsp; HDR10 &nbsp; Smart TV</small>}</>}
  </span>;
}
function LogoSize({ label, value, onChange }: {label: string; value?: number; onChange: (value: number) => void}) {
  return <label className="social-logo-size"><span>{label}<b>{value || 100}%</b></span><input type="range" min="40" max="200" step="5" value={value || 100} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
function positionStyle(position?: string, inset = 4.5): React.CSSProperties {
  const [row, side] = String(position || "top-left").split("-");
  return {
    top: row === "top" ? `${inset}%` : row === "middle" ? "48%" : undefined,
    bottom: row === "bottom" ? `${inset}%` : undefined,
    left: side === "left" ? `${inset}%` : side === "center" ? "50%" : undefined,
    right: side === "right" ? `${inset}%` : undefined,
    transform:
      side === "center"
        ? "translateX(-50%)"
        : row === "middle"
          ? "translateY(-50%)"
          : undefined,
  };
}
function autoPoint(index: number, count: number) {
  if (count === 1) return { x: 50, y: 48 };
  if (count === 2) return { x: index ? 75 : 25, y: 46 };
  if (count === 3) return { x: 18 + index * 32, y: 44 };
  const cols = 3;
  return { x: 18 + (index % cols) * 32, y: 36 + Math.floor(index / cols) * 31 };
}
function imageSource(source?: string): string {
  if (!source?.startsWith("https://")) return source || "";
  try {
    return /(?:^|\.)neptun-ks\.com$/i.test(new URL(source).hostname)
      ? `/api/export-image?url=${encodeURIComponent(source)}`
      : source;
  } catch {
    return source;
  }
}
function SocialScreenAnnotationControls({ product, onChange }: {product: Product; onChange: (field: "screenAnnotationPlacement", value: Placement | null) => void}) {
  const television = tvScreenInches(product);
  if (!television && !otherScreenInches(product)) return null;
  const placement = { x: 0, y: 0, scale: 1, horizontalLength: 1, verticalLength: 1, ...product.screenAnnotationPlacement };
  const field = (label: string, key: "x" | "y" | "scale" | "horizontalLength" | "verticalLength", multiplier: number, min: number, max: number, step: number) => <label key={key}><span>{t(label)}</span><input type="number" min={min} max={max} step={step} value={Math.round((placement[key] ?? 0) * multiplier * 100) / 100} onChange={(event) => { if (event.target.value !== "") onChange("screenAnnotationPlacement", { ...placement, [key]: Math.max(min, Math.min(max, Number(event.target.value))) / multiplier }); }} /></label>;
  return <section className="cs-product-layout-controls">
    <h4>{t("Inch label & lines")}</h4>
    <div className="cs-product-layout-fields">
      {field("Horizontal offset", "x", 1, -50, 50, .5)}
      {field("Vertical offset", "y", 1, -50, 50, .5)}
      {field("Size (%)", "scale", 100, 25, 250, 5)}
      {!television && field("Horizontal line (%)", "horizontalLength", 100, 0, 300, 10)}
      {!television && field("Vertical line (%)", "verticalLength", 100, 0, 300, 10)}
    </div>
    <label className="cs-details-placement"><span>{t("Show inch label")}</span><input type="checkbox" checked={!placement.hidden} onChange={(event) => onChange("screenAnnotationPlacement", { ...placement, hidden: !event.target.checked })} /></label>
    <button type="button" onClick={() => onChange("screenAnnotationPlacement", null)}>{t("Reset inch label & lines")}</button>
  </section>;
}

export function PostCanvas({
  post,
  onMove,
  onResize,
  onEditProduct,
  onEditScreen,
  imageAdjustCode,
  onToggleImageAdjust,
  onPlaceImage,
  onEditDetails,
  onReorderDetails,
  onMoveOfferBlock,
  onChangeProduct,
  onDropImage,
  onAddArtwork,
  onAddSavedArtwork,
  onUpdateAsset,
  onRemoveArtwork,
  showGuides = false,
  canvasRef,
  maxWidth,
  previewCutouts = {},
}: PostCanvasProps) {
  const dims = outputDimensions(post);
  const items = post.products || [];
  const background = post.background || {};
  const priceCampaign = postPriceCampaign(post);
  const midpoint = background.type === "gradient" && background.from && background.to && validBackgroundColor(background.from) && validBackgroundColor(background.to)
    ? `#${[1, 3, 5].map((offset) => Math.round((parseInt(background.from!.slice(offset, offset + 2), 16) + parseInt(background.to!.slice(offset, offset + 2), 16)) / 2).toString(16).padStart(2, "0")).join("")}`
    : background.color;
  const isLight = background.type !== "image" && lightBackground(midpoint);
  const brandOnLight = post.template === "editorial" || (isLight && post.template !== "spotlight");
  const drag = useRef<{code: string; kind: string; width: number; point: {x: number; y: number}; startX: number; element: HTMLElement} | null>(null);
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  function detailsBlock(product: Product, atImage = false) {
    if (!post.showSpecs || post.detailStyle === "simple") return null;
    const reference = usesRedReferencePrice(postPriceProduct(product), priceCampaign) ? "red" : usesBlueReferencePrice(postPriceProduct(product), priceCampaign) ? "blue" : "legacy";
    return <SocialProductDetails product={product} reference={reference} atImage={atImage}
      editable={Boolean(onMoveOfferBlock)}
      onChange={onChangeProduct ? changes => onChangeProduct(product.code, changes) : undefined}
      onPlacementChange={value => onMoveOfferBlock?.(product.code, "details", value)}
      onEdit={onEditDetails ? () => onEditDetails(product.code) : undefined}
      onReorder={onReorderDetails ? (from, to) => onReorderDetails(product.code, from, to) : undefined}
      onGestureStart={() => setDraggingCanvas(true)} onGestureEnd={() => setDraggingCanvas(false)} />;
  }
  function beginDrag(event: React.PointerEvent<HTMLElement>, product: Product, kind = "move", width = product.scale ?? 50, point: {x: number; y: number} = {x: product.x ?? 50, y: product.y ?? 49}) {
    if (!onMove || imageAdjustCode === product.code) return;
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const element = event.currentTarget.closest<HTMLElement>(".social-canvas");
    if (!element) return;
    drag.current = {
      code: product.code, kind, width, point, startX: event.clientX,
      element,
    };
    setDraggingCanvas(true);
  }
  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    if (!drag.current || !onMove) return;
    const rect = drag.current.element.getBoundingClientRect();
    if (drag.current.kind === "resize") {
      const width = Math.max(15, Math.min(85, drag.current.width + (event.clientX - drag.current.startX) / rect.width * 200));
      onResize?.(drag.current.code, width, drag.current.point);
      return;
    }
    const x = Math.max(
      10,
      Math.min(90, ((event.clientX - rect.left) / rect.width) * 100),
    );
    const y = Math.max(
      15,
      Math.min(75, ((event.clientY - rect.top) / rect.height) * 100),
    );
    onMove(drag.current.code, x, y);
  }
  return (
    <div
      ref={canvasRef}
      className={`social-canvas social-template-${post.template} social-details-${post.detailStyle || "chips"} ${post.logoLayout === "footer" && post.showNeptunLogo ? "social-with-brand-footer" : ""} ${isLight ? "social-light" : ""} ${dims.height > dims.width * 1.25 ? "social-portrait" : ""} ${showGuides || draggingCanvas ? "social-guides" : ""} ${onMove ? "social-edit-mode" : ""} social-count-${items.length}`}
      style={{
        aspectRatio: `${dims.width} / ${dims.height}`,
        background: cssBackground(post.background),
        maxWidth,
        "--social-artwork-scale": items.length <= 1 ? 1.2 : items.length === 2 ? .95 : .7,
        "--social-grid-columns": post.productGrid?.columns || 10,
        "--social-grid-rows": post.productGrid?.rows || 10,
      } as React.CSSProperties}
      onDragOver={onAddArtwork ? (event) => { if ([...event.dataTransfer.types].some(type=>type==="Files"||type===REUSABLE_IMAGE_TYPE)) event.preventDefault(); } : undefined}
      onDrop={onAddArtwork ? (event) => { const asset=droppedReusableImage(event.dataTransfer);if(asset){event.preventDefault();event.stopPropagation();const rect=event.currentTarget.getBoundingClientRect();onAddSavedArtwork?.(asset,{x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100});return;} const files = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/")); if (!files.length) return; event.preventDefault(); event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); if (!rect.width || !rect.height) return; onAddArtwork(files, { x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100 }); } : undefined}
    >
      {post.background?.type === "image" && (
        <div className="social-image-shade" />
      )}
      {post.showNeptunLogo && post.logoLayout !== "footer" && (
        <CanvasAsset name="NEPTUN logo" editable={Boolean(onUpdateAsset)} onGestureStart={() => setDraggingCanvas(true)} onGestureEnd={() => setDraggingCanvas(false)} position={post.logoCoords?.neptun} presetStyle={positionStyle(post.logoPosition)} width={12 * (post.logoScale || 100) / 100} minWidth={4.8} maxWidth={24} onChange={(value) => onUpdateAsset?.("neptun", value)} source={
            post.neptunLogoUpload ||
            (post.logoVariant === "blue"
              ? "/api/assets/legacy/assets/social/neptun-blue.png"
              : "/api/assets/legacy/assets/social/neptun-white.png")
          } />
      )}
      {post.showEventLogo && (
        <CanvasAsset name="Event badge" editable={Boolean(onUpdateAsset)} onGestureStart={() => setDraggingCanvas(true)} onGestureEnd={() => setDraggingCanvas(false)} position={post.logoCoords?.event} presetStyle={positionStyle(post.eventPosition)} width={19 * (post.eventScale || 100) / 100} minWidth={7.6} maxWidth={38} onChange={(value) => onUpdateAsset?.("event", value)} source={post.eventLogoUpload || (post.eventLogo === "happy-day" ? "/api/assets/legacy/assets/social/happy-day.png" : post.eventLogo === "back-school" ? "/api/assets/legacy/assets/social/back-to-school.png" : "")}>
          <span className="social-event-text">e-days</span>
        </CanvasAsset>
      )}
      {post.showCustomLogo && post.customLogo && (
        <CanvasAsset name="Campaign badge" editable={Boolean(onUpdateAsset)} onGestureStart={() => setDraggingCanvas(true)} onGestureEnd={() => setDraggingCanvas(false)} position={post.logoCoords?.custom} presetStyle={positionStyle(post.customLogoPosition)} width={15 * (post.customLogoScale || 100) / 100} minWidth={6} maxWidth={30} onChange={(value) => onUpdateAsset?.("custom", value)} source={post.customLogo} />
      )}
      {(post.artworks || []).map((artwork: Artwork) => <CanvasAsset key={artwork.id} name={artwork.name || "Added image"} artwork source={artwork.image} position={artwork} width={artwork.width} editable={Boolean(onUpdateAsset)} onGestureStart={() => setDraggingCanvas(true)} onGestureEnd={() => setDraggingCanvas(false)} onChange={(value) => onUpdateAsset?.(artwork.id, value)} onRemove={onRemoveArtwork ? () => onRemoveArtwork(artwork.id) : undefined} />)}
      {post.showNeptunLogo && post.logoLayout === "footer" && <div className="social-brand-footer" style={{ "--social-footer-logo-width": `${19 * (post.logoScale || 100) / 100}%`, height: `${3.5 * (post.logoScale || 100) / 100}%` }}>
        {post.neptunLogoUpload ? <img src={post.neptunLogoUpload} alt="NEPTUN" /> : <NeptunWordmark dark={!isLight} />}
        <span />
      </div>}
      {post.textHtml && (
        <div
          className="social-top-copy"
          dangerouslySetInnerHTML={{ __html: safeRichHtml(post.textHtml) }}
        />
      )}
      <div className="social-product-layer">
        {items.map((product: Product, index) => {
          const point = product.positioned
            ? { x: product.x ?? 50, y: product.y ?? 49 }
            : autoPoint(index, items.length);
          const width = product.positioned
            ? product.scale ?? 50
            : items.length === 1
              ? 70
              : items.length === 2
                ? 44
                : 31;
          const effectiveImage = previewCutouts[`${post.id}:${product.code}:${product.image}`] || imageSource(product.image);
          return (
            <div
              key={product.code}
              className={`social-product ${onMove ? "draggable" : ""}`}
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                width: `${width}%`,
              }}
              onPointerDown={(event) => beginDrag(event, product, "move", width, point)}
              onPointerMove={moveDrag}
              onPointerUp={() => {
                drag.current = null;
                setDraggingCanvas(false);
              }}
              onPointerCancel={() => { drag.current = null; setDraggingCanvas(false); }}
              onDragOver={onDropImage ? (event) => { if ([...event.dataTransfer.types].includes("Files")) { event.preventDefault(); event.stopPropagation(); } } : undefined}
              onDrop={onDropImage ? (event) => { const files = [...event.dataTransfer.files].filter((item) => item.type.startsWith("image/")); if (files.length === 1 && files[0]) { event.preventDefault(); event.stopPropagation(); onDropImage(product.code, files[0]); } } : undefined}
              onDoubleClick={() => onEditProduct?.(product.code)}
              title={onMove ? "Drag to move; double-click to edit" : undefined}
            >
              <SocialProductVisual product={product} image={effectiveImage} showImage={product.showImage !== false} showInches={post.showInches}
                  adjustImage={Boolean(onPlaceImage && imageAdjustCode === product.code)}
                  onPlaceImage={(placement) => onPlaceImage?.(product.code, placement)}
                  onChangeProduct={onChangeProduct ? (field, value) => onChangeProduct(product.code, field, value) : undefined}
                  details={defaultProductDetailPlacement(postPriceProduct(product), priceCampaign) === "left" ? detailsBlock(product, true) : null}
                  onGestureStart={() => setDraggingCanvas(true)} onGestureEnd={() => setDraggingCanvas(false)} />
              {product.cutoutStatus === "pending" && (
                <span className="social-cutout-pending">
                  ✦ Preparing cutout
                </span>
              )}
              {onMove && <div className="social-product-tools" data-export-hide="true">
                <button type="button" title="Change product image" aria-label={`Change product image: ${product.name}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onEditProduct?.(product.code)}>▧</button>
                <button type="button" className={imageAdjustCode === product.code ? "selected" : ""} title={imageAdjustCode === product.code ? "Finish photo positioning" : "Move photo within product area"} aria-label={imageAdjustCode === product.code ? `Finish photo positioning: ${product.name}` : `Move photo within product area: ${product.name}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onToggleImageAdjust?.(product.code)}>✥</button>
                {hasEditableScreen(product) && <button type="button" title="Change picture inside screen" aria-label={`Change picture inside screen: ${product.name}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onEditScreen?.(product.code)}>▣</button>}
                <button type="button" className="social-product-resize" title="Drag to resize product" aria-label={`Resize product: ${product.name}`} onPointerDown={(event) => beginDrag(event, product, "resize", width, point)} onPointerMove={(event) => { event.stopPropagation(); moveDrag(event); }} onPointerUp={(event) => { event.stopPropagation(); drag.current = null; setDraggingCanvas(false); }}>↘</button>
              </div>}
            </div>
          );
        })}
      </div>
      <div
        className="social-offer-grid"
        style={{
          gridTemplateColumns: `repeat(${Math.min(items.length || 1, 3)}, minmax(0, 1fr))`,
          ...(post.showNeptunLogo && post.logoLayout === "footer" ? { bottom: `${6 + 3 * (post.logoScale || 100) / 100}%` } : {}),
        }}
      >
        {items.map((product: Product) => {
          const hasSale = Number(product.sale) > 0;
          const hasRegular =
            Number(product.regular) > Number(product.sale) && hasSale;
          const savingMode = product.savingMode || post.savingMode;
          const saving =
            savingMode === "percentage"
              ? `${discount(product.regular, product.sale)}%`
              : `${money(Number(product.regular) - Number(product.sale))}€`;
          const priceStyle = normalizedPriceStyle(product.offerStyle || product.priceStyle || post.priceStyle);
          const redReferencePrice = usesRedReferencePrice(postPriceProduct(product), priceCampaign);
          const blueReferencePrice = usesBlueReferencePrice(postPriceProduct(product), priceCampaign);
          const offerBlock = (kind: string, className: string, children: React.ReactNode) => <EditableOfferBlock
            name={kind === "copy" ? "product name" : kind === "details" ? "product details" : kind === "savings" ? "savings badge" : "price"}
            className={className}
            placement={product.offerPlacements?.[kind]}
            editable={Boolean(onMoveOfferBlock)}
            onChange={(value) => onMoveOfferBlock?.(product.code, kind, value)}
            onEdit={() => onEditDetails?.(product.code)}
            onGestureStart={() => setDraggingCanvas(true)}
            onGestureEnd={() => setDraggingCanvas(false)}
          >{children}</EditableOfferBlock>;
          return (
            <SocialOfferFrame
              className={`${redReferencePrice ? "red-reference-offer" : ""} ${blueReferencePrice ? "blue-reference-offer" : ""}`}
              key={product.code}
              manualCopy={Boolean(product.offerPlacements?.copy)}
              onEdit={() => onEditDetails?.(product.code)}
              copy={post.showDetails && (
                offerBlock("copy", "social-product-copy brochure-product-copy", <>
                  {product.hideColors !== true && productColors(product).length > 0 && <ProductDetailBlock product={product} detailKey="__colors" className="social-product-colors" onChange={onChangeProduct ? (field, value) => onChangeProduct(product.code, field, value) : undefined} onRemove={onChangeProduct ? () => onChangeProduct(product.code, "hideColors", true) : undefined}>{productColors(product).map((color) => <i key={color.name} title={color.name} style={{background:color.hex}} />)}</ProductDetailBlock>}
                  <div className={`social-product-brand ${brandOnLight ? "on-light" : "on-dark"}`}>
                    <ProductBrandArtwork campaign={{id: post.id, name: post.name, products: [], offerStyle: post.priceStyle}} product={product}
                      onChange={onChangeProduct ? (field, value) => onChangeProduct(product.code, field, value) : undefined} />
                  </div>
                  <span data-product-name="true">{product.name}</span>
                  <small className="social-product-code brochure-product-code">{product.code}</small>
                  {product.postDetails && <div>{product.postDetails}</div>}
                  {blueReferencePrice && !product.hideWarranty && warrantyDuration(product.warranty) && <ProductDetailBlock product={product} detailKey="__warranty" className="social-warranty-line" onChange={onChangeProduct ? (field, value) => onChangeProduct(product.code, field, value) : undefined} onRemove={onChangeProduct ? () => onChangeProduct(product.code, "hideWarranty", true) : undefined}>{warrantyDuration(product.warranty)?.count} {warrantyDuration(product.warranty)?.unit} GARANCION</ProductDetailBlock>}
                </>)
              )}
              details={defaultProductDetailPlacement(postPriceProduct(product), priceCampaign) !== "left" && detailsBlock(product)}
              savings={redReferencePrice && post.showPrice && hasSale && post.showSaving && hasRegular && offerBlock("savings", "social-savings-block", <RedReferenceSavings product={product} savingMode={savingMode} className="social-red-reference-saving" />)}
              price={post.showPrice && hasSale && (
                redReferencePrice ? offerBlock("price", "social-price-stack brochure-price red-reference-price", <>
                  <RedReferencePrice product={product} installments={12} showRegular={post.showRegular && hasRegular} showInstallments={post.showInstallments} />
                </>) : blueReferencePrice ? offerBlock("price", "social-price-stack reference-price-card social-reference-blue-price", <ReferencePriceCard product={product} installments={12} savingMode={savingMode} showRegular={post.showRegular && hasRegular} showSaving={post.showSaving && hasRegular} showInstallments={post.showInstallments} />) : offerBlock("price", `social-price-stack price-${priceStyle}`, <>
                  {post.showSaving && hasRegular && (
                    <span className="social-saving">
                      {savingMode === "percentage" ? "ZBRITJE" : "KURSENI"}{" "}
                      <b>{saving}</b>
                    </span>
                  )}
                  {post.showRegular && hasRegular && <div className="social-regular">{priceStyle === "card" && <span>Çmimi i rregullt:</span>}<del>{money(product.regular)} €</del></div>}
                  <div className="social-sale">
                    {priceStyle !== "minimal" && <span className="social-sale-label">{priceStyle === "card" ? "Çmimi" : "ÇMIMI"}<img src="/api/assets/legacy/assets/happy-price-white.png" alt="haPPy" />{priceStyle === "card" && ":"}</span>}
                    <strong>{money(product.sale)}<span>€</span></strong>
                  </div>
                  {post.showInstallments && priceStyle !== "minimal" && (
                    <div className="social-installments">
                      {priceStyle === "card" ? `12 x muaj: ${money(Number(product.sale) / 12)} €` : `KËSTI 12×${money(Number(product.sale) / 12)} €`}
                    </div>
                  )}
                </>)
              )}
            />
          );
        })}
      </div>
      <SocialApplePhotoClearance />
      {!items.length && (
        <div className="social-empty-canvas">
          Add one or more products to start your post
        </div>
      )}
    </div>
  );
}

function ProductPicker({ catalog, campaigns, post, onAdd, onClose, canViewCatalog = true }: {catalog: Product[]; campaigns: Campaign[]; post: SocialPost; onAdd: (product: Product) => void; onClose: () => void; canViewCatalog?: boolean}) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState(post.sourceCampaignId || (canViewCatalog ? "catalog" : campaigns[0]?.id || ""));
  const [chosen, setChosen] = useState<string | null>(null);
  const [sale, setSale] = useState("");
  const campaign = campaigns.find((item) => item.id === source);
  const products = campaign?.products || (canViewCatalog ? catalog : []);
  const existing = new Set(
    (post.products || []).map((item) => String(item.code)),
  );
  const filtered = products
    .filter(
      (item) =>
        !existing.has(String(item.code)) &&
        `${item.code} ${item.name} ${item.brand} ${item.category} ${item.subcategory}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .slice(0, 80);
  return (
    <div
      className="social-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="social-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add products"
      >
        <header>
          <div>
            <small>PRODUCTS</small>
            <h2>Add to this post</h2>
            <p>{canViewCatalog ? "Use any brochure or choose directly from the catalog." : "Choose products from a shared brochure."}</p>
          </div>
          <button
            type="button"
            className="social-modal-close"
            onClick={onClose}
            aria-label="Close product picker"
          >
            <CloseIcon />
          </button>
        </header>
        <div className="social-picker-controls">
          <StudioSelect
            label="Product source"
            value={source}
            onChange={(next) => {
              setSource(next);
              setChosen(null);
            }}
            searchable
            options={[
              ...(canViewCatalog ? [{ value: "catalog", label: "Product catalog" }] : []),
              ...campaigns.map((item) => ({
                value: item.id,
                label: item.name,
                detail: "Brochure",
              })),
            ]}
          />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search code, name or brand"
          />
        </div>
        <div className="social-picker-list">
          {filtered.map((item) => (
            <div className="social-picker-item" key={item.code}>
              <button
                type="button"
                className="social-picker-product"
                onClick={() => {
                  setChosen(chosen === item.code ? null : item.code);
                  setSale(Number(item.sale) > 0 ? String(item.sale) : "");
                }}
                aria-expanded={chosen === item.code}
              >
                <img
                  src={imageSource(
                    item.image || item.localImage || item.imageUrl,
                  )}
                  alt=""
                />
                <span>
                  <b>{item.name}</b>
                  <small>
                    {item.brand} · {item.code}
                  </small>
                  {Number(item.regular) > 0 && (
                    <small>Regular {money(item.regular)} €</small>
                  )}
                </span>
                <strong>{chosen === item.code ? "⌄" : "＋"}</strong>
              </button>
              {chosen === item.code && (
                <div className="social-picker-price">
                  <label>
                    New sale price (€)
                    <input
                      autoFocus
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={sale}
                      onChange={(event) => setSale(event.target.value)}
                      placeholder="Enter sale price"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      !Number.isFinite(Number(sale)) || Number(sale) <= 0
                    }
                    onClick={() => {
                      onAdd({ ...item, sale: Number(sale) });
                      setChosen(null);
                      setSale("");
                    }}
                  >
                    Add to post →
                  </button>
                </div>
              )}
            </div>
          ))}
          {!filtered.length && (
            <p>No matching products. Try a different search.</p>
          )}
        </div>
        <footer>
          <span>{post.products.length} / 6 products selected</span>
          <button type="button" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}

function buildReviewItems(post: SocialPost) {
  const items: ReviewItem[] = [];
  const apply: Array<(draft: SocialPost, value: string) => void> = [];
  function add(key: string, label: string, text: string | null | undefined, handler: (draft: SocialPost, value: string) => void, brand = "") {
    if (!String(text || "").trim() || items.length >= 80) return;
    const id = `f${items.length}`;
    items.push({ id, key, label, text: String(text), brand });
    apply.push(handler);
  }
  add("post:name", "Post name", post.name, (draft: SocialPost, value) => {
    draft.name = value;
  });
  post.products.forEach((product: Product, index) => {
    add(
      `product:${product.code}:name`,
      `Product ${index + 1} name`,
      product.name,
      (draft: SocialPost, value) => {
        const target = draft.products[index];
        if (target) target.name = value;
      },
      product.brand,
    );
    add(
      `product:${product.code}:description`,
      `Product ${index + 1} description`,
      product.description,
      (draft: SocialPost, value) => {
        const target = draft.products[index];
        if (target) target.description = value;
      },
      product.brand,
    );
    add(
      `product:${product.code}:postDetails`,
      `Product ${index + 1} display copy`,
      product.postDetails,
      (draft: SocialPost, value) => {
        const target = draft.products[index];
        if (target) target.postDetails = value;
      },
      product.brand,
    );
    Object.entries(product.specs || {})
      .slice(0, 5)
      .forEach(([key, value]) =>
        add(
          `product:${product.code}:spec:${key}`,
          `Product ${index + 1} ${key}`,
          value,
          (draft: SocialPost, next) => {
            const target = draft.products[index];
            if (target) {
              target.specs ||= {};
              target.specs[key] = next;
            }
          },
          product.brand,
        ),
      );
  });
  const doc = new DOMParser().parseFromString(
    `<div id="copy">${safeRichHtml(post.textHtml)}</div>`,
    "text/html",
  );
  const nodes: Node[] = [];
  const copyRoot = doc.getElementById("copy");
  if (!copyRoot) return { items, apply };
  const walker = doc.createTreeWalker(
    copyRoot,
    NodeFilter.SHOW_TEXT,
  );
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node, index) =>
    add(
      `copy:${index}`,
      `Post copy ${index + 1}`,
      node.textContent,
      (draft: SocialPost, value) => {
        if (nodes[index]) nodes[index].textContent = value;
        draft.textHtml = safeRichHtml(copyRoot.innerHTML);
      },
    ),
  );
  return { items, apply };
}

export function SocialStudio({ catalog, campaigns, seed, onSeedUsed, settings, canManageDisabled = false, canViewCatalog = true }: SocialStudioProps) {
  const [, setBrandLogoRevision] = useState(0);
  useEffect(() => {
    loadPreparedBrandLogos().then(() => setBrandLogoRevision((value) => value + 1));
  }, []);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [postVisibility, setPostVisibility] = useState("active");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);
  const [picker, setPicker] = useState(false);
  const [rich, setRich] = useState(false);
  const [imageCode, setImageCode] = useState<string | null>(null);
  const [screenCode, setScreenCode] = useState<string | null>(null);
  const [imageAdjustCode, setImageAdjustCode] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [artworkUpload, setArtworkUpload] = useState<{ completed: number; total: number } | null>(null);
  const artworkUploadRef = useRef(false);
  const [exportNotice, setExportNotice] = useState<{kind: "error" | "working" | "success"; text: string} | null>(null);
  const [exportReady, setExportReady] = useState<{url: string; filename: string} | null>(null);
  const [review, setReview] = useState<ProofreadChange[]>([]);
  const [reviewApply, setReviewApply] = useState<Array<(draft: SocialPost, value: string) => void>>([]);
  const [reviewKey, setReviewKey] = useState<ReviewItem[]>([]);
  const [dirtyId, setDirtyId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [previewCutouts, setPreviewCutouts] = useState<Record<string, string>>({});
  const previewingRef = useRef(new Set<string>());
  const [viewportHeight, setViewportHeight] = useState(
    () => window.innerHeight,
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const exportUrlRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentPostRef = useRef<SocialPost | null>(null);
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const dirtyRef = useRef<string | null>(null);
  const post = posts.find((item) => item.id === activeId && !item.disabledAt) ?? null;
  const visiblePosts = posts.filter((item) => canManageDisabled ? postVisibility === "all" || (postVisibility === "disabled" ? Boolean(item.disabledAt) : !item.disabledAt) : !item.disabledAt);
  const preparationBackground = useMemo(() => post ? postImageBackgroundContext(post) : null, [post?.background, post?.backgroundPrompt]);
  useEffect(() => {
    setExportNotice(null);
    setExportReady(null);
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    exportUrlRef.current = null;
  }, [activeId]);
  useEffect(() => () => {
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
  }, []);
  useEffect(() => {
    const resize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!post) return;
    for (const product of post.products || []) {
      if (
        !product.image ||
        product.cutoutStatus === "done" ||
        product.skipAiCutout
      )
        continue;
      const key = `${post.id}:${product.code}:${product.image}`;
      if (previewingRef.current.has(key) || previewCutouts[key]) continue;
      previewingRef.current.add(key);
      plainBackgroundPreview(imageSource(product.image))
        .then((image) => {
          if (image) setPreviewCutouts((all) => ({ ...all, [key]: image }));
        })
        .catch(() => {})
        .finally(() => previewingRef.current.delete(key));
    }
  }, [post?.id, post?.products]);
  currentPostRef.current = post;
  dirtyRef.current = dirtyId;
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      if (
        currentPostRef.current?.id &&
        dirtyRef.current === currentPostRef.current.id
      )
        savePost(currentPostRef.current).catch(console.error);
    },
    [],
  );
  useEffect(() => {
    let alive = true;
    setLoadError("");
    setLoaded(false);
    getPosts()
      .then((saved) => {
        if (alive) {
          setPosts(canManageDisabled ? saved : saved.filter((item) => !item.disabledAt));
          setLoaded(true);
        }
      })
      .catch((error) => {
        if (alive) {
          setLoadError(errorMessage(error));
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [loadRevision, canManageDisabled]);
  useEffect(() => {
    if (!loaded || !seed) return;
    const campaign = campaigns.find((item) => item.id === seed.campaignId);
    const next = createPost(seed.products || [], campaign);
    setPosts((all) => [next, ...all]);
    setActiveId(next.id);
    setDirtyId(next.id);
    onSeedUsed?.();
  }, [loaded, seed, campaigns, onSeedUsed]);
  useEffect(() => {
    if (!post || dirtyId !== post.id) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePost(post)
        .then(() => {
          if (
            currentPostRef.current?.id === post.id &&
            currentPostRef.current?.revision === post.revision
          )
            setDirtyId((id) => (id === post.id ? null : id));
        })
        .catch((error: { message: React.SetStateAction<string>; }) => setMessage(error.message));
    }, 850);
    return () => clearTimeout(saveTimer.current);
  }, [post, dirtyId]);

  function update(mutator: PostMutator, targetId = activeId) {
    if (!targetId) return;
    const item = postsRef.current.find((entry) => entry.id === targetId);
    if (!item) return;
    const next = structuredClone(item);
    mutator(next);
    next.updatedAt = new Date().toISOString();
    next.revision = (item.revision || 0) + 1;
    const updated = postsRef.current.map((entry) => entry.id === targetId ? next : entry);
    postsRef.current = updated;
    setPosts(updated);
    if (currentPostRef.current?.id === targetId) setDirtyId(targetId);
    else {
      // An upload may finish after the editor was closed or another post opened.
      // Save to its original post rather than leaving that change outside autosave.
      void savePost(next).catch((cause: unknown) => setMessage(errorMessage(cause)));
    }
  }
  async function addArtworks(files: File[], point = { x: 20, y: 15 }) {
    const targetId = activeId;
    if (!targetId) return;
    if (artworkUploadRef.current) { setMessage("Images are still uploading. Add the next files when this batch finishes."); return; }
    const images = files.filter((file) => file.type.startsWith("image/") && file.size <= 12 * 1024 * 1024);
    if (!images.length) { setMessage("Choose image files under 12 MB."); return; }
    artworkUploadRef.current = true;
    setArtworkUpload({ completed: 0, total: images.length });
    let failed = files.length - images.length;
    let completed = 0;
    let added = 0;
    // Bounded uploads keep successful images even if a different file fails.
    for (let start = 0; start < images.length; start += 2) {
      await Promise.all(images.slice(start, start + 2).map(async (file, offset) => {
        try {
          const image = await readImage(file);
          const artwork = {
            id: crypto.randomUUID(), name: file.name, image,
            x: Math.max(3, Math.min(97, point.x + (start + offset) * 3)),
            y: Math.max(3, Math.min(97, point.y + (start + offset) * 3)), width: 20,
          };
          update((draft) => { (draft.artworks ??= []).push(artwork); }, targetId);
          added++;
        } catch { failed++; }
        finally {
          completed++;
          setArtworkUpload({ completed, total: images.length });
        }
      }));
    }
    artworkUploadRef.current = false;
    setArtworkUpload(null);
    if (failed) setMessage(`${added} images added. ${failed} files could not be uploaded; the other images are kept.`);
  }
  async function dropProductImage(code: string, file: File) {
    if (!file?.type.startsWith("image/") || file.size > 12 * 1024 * 1024) { setMessage("Choose an image under 12 MB."); return; }
    try {
      const image = await readImage(file);
      update((draft: SocialPost) => {
        const product = draft.products.find((item) => item.code === code);
        if (!product) return;
        product.image = image;
        clearPostImagePreparation(product);
        product.imageChoices = [...new Set([image, ...(product.imageChoices || [])])];
        product.cutoutStatus = "skipped";
        product.skipAiCutout = true;
        delete product.screenArtwork;
      });
    } catch { setMessage("Could not read the product image."); }
  }
  function updateAsset(id: string, value: AssetPlacement) {
    update((draft: SocialPost) => {
      const builtins: Record<string, {field: "logoScale" | "eventScale" | "customLogoScale"; base: number}> = { neptun: {field: "logoScale", base: 12}, event: {field: "eventScale", base: 19}, custom: {field: "customLogoScale", base: 15} };
      const builtin = builtins[id];
      if (builtin) {
        draft.logoCoords ||= {};
        draft.logoCoords[id] = { x: value.x, y: value.y };
        draft[builtin.field] = Math.round(value.width / builtin.base * 100);
      } else {
        const item = draft.artworks?.find((entry) => entry.id === id);
        if (item) Object.assign(item, value);
      }
    });
  }
  function reorderDetails(code: string, from: number, to: number) {
    update((draft: SocialPost) => {
      const product = draft.products.find((item) => item.code === code);
      if (product) Object.assign(product, reorderDisplayedDetails(product, socialProductDetailEntries(product), from, to));
    });
  }
  function create(products: Product[] = [], campaign: Campaign | null = null) {
    if (post && dirtyId === post.id) savePost(post).catch(console.error);
    const next = createPost(products, campaign);
    setPosts((all) => [next, ...all]);
    setActiveId(next.id);
    setDirtyId(next.id);
    setMessage("");
  }
  function addSavedArtwork(asset:LogoAsset,point?:{x:number;y:number}) {
    update(draft=>{draft.artworks ||= [];draft.artworks.push({id:crypto.randomUUID(),name:asset.name,image:asset.url,x:Math.max(0,Math.min(95,point?.x??12)),y:Math.max(0,Math.min(95,point?.y??12)),width:20});});
  }
  async function deleteActive() {
    if (!post) return;
    clearTimeout(saveTimer.current);
    setBusy("delete");
    try {
      if (dirtyRef.current === post.id) {
        const saved = await savePost(post);
        setPosts((all) => all.map((item) => item.id === saved.id ? saved : item));
      }
      dirtyRef.current = null;
      setDirtyId(null);
      await removePost(post.id, post.version);
      const disabled = canManageDisabled ? (await getPosts()).find((item) => item.id === post.id) : undefined;
      setPosts((all) => disabled ? all.map((item) => item.id === disabled.id ? disabled : item) : all.filter((item) => item.id !== post.id));
      setActiveId(null);
      setConfirmDelete(false);
      setMessage(t("Post disabled."));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function enablePost(item: SocialPost) {
    if (!canManageDisabled || busy) return;
    setBusy(`restore:${item.id}`);
    try {
      const restored = await restorePost(item);
      setPosts((all) => all.map((value) => value.id === restored.id ? restored : value));
      setMessage(t("Post enabled."));
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(""); }
  }
  async function aiBackground() {
    if (!post) return;
    setBusy("background");
    setMessage("");
    try {
      const dims = outputDimensions(post);
      const data=await requestAi('ai-generate-background',{
          context: "social",
          prompt: post.backgroundPrompt || "",
          products: post.products,
          orientation:
            dims.width > dims.height
              ? "landscape"
              : dims.height > dims.width
                ? "portrait"
                : "square",
        });
      update((draft: SocialPost) => {
        draft.background = {
          ...draft.background,
          type: "image",
          image: data.image,
        };
      });
      setMessage("Background ready. Move each product or use AI placement.");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function aiPlacement(product: Product) {
    if (!post?.background?.image) {
      setMessage("Upload or generate a background first.");
      return;
    }
    setBusy(`place-${product.code}`);
    setMessage("");
    try {
      const result=await requestAi('ai-suggest-placement',{image:post.background.image,name:product.name});
      update((draft: SocialPost) => {
        const item = draft.products.find(
          (entry) => entry.code === product.code,
        );
        if (!item) return;
        Object.assign(item, {
          x: result.x,
          y: result.y,
          scale: result.scale,
          positioned: true,
          showImage: !result.alreadyPresent,
        });
      });
      setMessage(
        result.alreadyPresent
          ? "AI found this product in the background. Its extra cutout is hidden; you can show it again."
          : `Placement suggested: ${result.reason}`,
      );
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy("");
    }
  }
  async function aiReview() {
    if (!post) return 0;
    const { items, apply } = buildReviewItems(post);
    const dirtyItems = items.filter(
      (item) => post.aiReviewedFields?.[item.key] !== item.text,
    );
    if (!dirtyItems.length) {
      setMessage(
        review.length
          ? "These suggestions are already shown below."
          : "Text is unchanged since the last check.",
      );
      return 0;
    }
    setBusy("review");
    setMessage("");
    try {
      const data=await requestAi('ai-proofread',{items:dirtyItems,context:{campaignName:post.name,campaignType:'social media post'}});
      update((draft: SocialPost) => {
        draft.aiReviewedFields ||= {};
        for (const item of dirtyItems)
          draft.aiReviewedFields[item.key] = item.text;
      });
      setReview(data.changes || []);
      setReviewApply(apply);
      setReviewKey(items);
      setMessage(
        data.changes?.length
          ? `${data.changes.length} suggestion(s) to review.`
          : "AI found no clear text corrections.",
      );
      return data.changes?.length || 0;
    } catch (error) {
      setMessage(errorMessage(error));
      return -1;
    } finally {
      setBusy("");
    }
  }
  function applyReview(changes: ProofreadChange[]) {
    update((draft: SocialPost) => {
      for (const item of changes) {
        const index = Number(item.id.slice(1));
        reviewApply[index]?.(draft, item.suggested);
        if (reviewKey[index]) {
          draft.aiReviewedFields ||= {};
          draft.aiReviewedFields[reviewKey[index].key] = item.suggested;
        }
      }
    });
    setReview((all) => all.filter((item) => !changes.includes(item)));
  }
  async function exportPost(format: string) {
    if (!post || !canvasRef.current) {
      setExportNotice({ kind: "error", text: "The post preview is not ready. Try again after it appears." });
      return;
    }
    setExportReady(null);
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    exportUrlRef.current = null;
    setBusy(`export-${format}`);
    setExportNotice({ kind: "working", text: `Preparing ${format.toUpperCase()} download…` });
    try {
      await document.fonts.ready;
      const { width, height } = outputDimensions(post);
      if (width * height > 67_000_000)
        throw new Error(
          "This size exceeds the browser canvas limit. Choose a smaller size or aspect ratio.",
        );
      // Render a live canvas at output size so text fitting and divider
      // measurements resolve in the same coordinate system as the download.
      const exportHost = document.createElement("div");
      exportHost.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:${height}px;pointer-events:none;`;
      document.body.appendChild(exportHost);
      const exportRoot = createRoot(exportHost);
      const exportRef = React.createRef<HTMLDivElement>();
      let canvas: HTMLCanvasElement;
      try {
        flushSync(() => exportRoot.render(<PostCanvas post={structuredClone(post)} previewCutouts={{...previewCutouts}} canvasRef={exportRef} />));
        if (!exportRef.current) throw new Error("Could not prepare the post preview.");
        exportRef.current.style.width = `${width}px`;
        exportRef.current.style.height = `${height}px`;
        exportRef.current.style.maxWidth = "none";
        exportRef.current.style.margin = "0";
        exportRef.current.style.boxShadow = "none";
        canvas = await captureSocialPost(exportRef.current, width, height);
      } finally {
        exportRoot.unmount();
        exportHost.remove();
      }
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("Could not render the image.")),
          format === "jpg" || format === "pdf"
            ? "image/jpeg"
            : format === "webp"
              ? "image/webp"
              : "image/png",
          0.96,
        ),
      );
      const base = String(post.name || "neptun-post")
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()
        .slice(0, 60);
      let output = blob;
      const extension = format;
      if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({
          orientation: width >= height ? "landscape" : "portrait",
          unit: "mm",
          format: [(width / 150) * 25.4, (height / 150) * 25.4],
          compress: true,
        });
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.96),
          "JPEG",
          0,
          0,
          (width / 150) * 25.4,
          (height / 150) * 25.4,
        );
        output = pdf.output("blob");
      }
      const url = URL.createObjectURL(output);
      exportUrlRef.current = url;
      const link = document.createElement("a");
      link.href = url;
      const filename = `${base || "neptun-post"}-${width}x${height}.${extension}`;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setExportReady({ url, filename });
      canvas.width = 0;
      canvas.height = 0;
      setExportNotice({ kind: "success", text: `Sent ${filename} to your browser downloads. If it does not appear, use the direct link below or allow downloads for this site.` });
    } catch (error) {
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
      setExportReady(null);
      setExportNotice({ kind: "error", text: errorMessage(error) || "Export failed. Please try again." });
    } finally {
      setBusy("");
    }
  }
  const imageProduct = post?.products.find((item) => item.code === imageCode);
  const screenProduct = post?.products.find((item) => item.code === screenCode);
  const dims = post ? outputDimensions(post) : { width: 1080, height: 1350 };
  return (
    <div className="social-studio">
      <div className="social-studio-head">
        <div>
          <small>NEPTUN / CONTENT STUDIO</small>
          <h1>{t("Social posts")}</h1>
          <p>
            Create a post from a brochure or any products in the catalog. Save
            it for both accounts and export the right size for each channel.
          </p>
        </div>
        <button
          className="social-primary"
          type="button"
          onClick={() => create()}
        >
          {t("＋ New post")}
        </button>
      </div>
      {message && (
        <div className="social-message" role="status">
          {message}
          <button type="button" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      {!loaded && <p role="status">{t("Loading posts…")}</p>}
      {loadError && <div className="social-message" role="alert">
        {t("Could not load social posts. Please try again.")}
        <button type="button" onClick={() => setLoadRevision((value) => value + 1)}>{t("Try again")}</button>
      </div>}
      {loaded && !loadError && !post && (
        <div className="social-library">
          <div className="social-library-toolbar">
            <h2>{t("Saved posts")}</h2>
            <span>{visiblePosts.length} posts</span>
            {canManageDisabled && <StudioSelect label={t("Post visibility")} value={postVisibility} onChange={setPostVisibility} options={[{value:"active",label:t("Active posts")},{value:"disabled",label:t("Disabled posts")},{value:"all",label:t("All posts")}]} />}
          </div>
          {!visiblePosts.length && (
            <div className="social-library-empty" role="status">
              {postVisibility === "disabled" ? t("No disabled posts.") : t("No social media posts.")}
            </div>
          )}
          <div className="social-post-cards">
            {visiblePosts.map((item) => item.disabledAt ? (
              <article className="social-disabled-card" key={item.id}>
                <span className="social-disabled-badge">{t("Disabled")}</span>
                <div className="social-card-preview" style={{background:cssBackground(item.background)}}><img src={imageSource(item.products?.[0]?.image)} alt="" /></div>
                <strong>{item.name}</strong>
                <small>{t("Only superadmins can see this disabled post.")}</small>
                <button className="social-restore" type="button" disabled={Boolean(busy)} onClick={() => enablePost(item)}><NavIcon name="refresh" size={17} />{t(busy === `restore:${item.id}` ? "Enabling…" : "Enable post")}</button>
              </article>
            ) : (
              <button
                type="button"
                key={item.id}
                onClick={() => setActiveId(item.id)}
              >
                <div
                  className="social-card-preview"
                  style={{ background: cssBackground(item.background) }}
                >
                  <img src={imageSource(item.products?.[0]?.image)} alt="" />
                </div>
                <strong>{item.name}</strong>
                <small>
                  {item.products?.length || 0} products ·{" "}
                  {
                    SOCIAL_PRESETS.find((preset) => preset.id === item.preset)
                      ?.label
                  }
                </small>
              </button>
            ))}
          </div>
        </div>
      )}
      {post && (
        <div className="social-editor">
          <div className="social-editor-top">
            <button
              type="button"
              onClick={() => {
                if (dirtyId === post.id) savePost(post).catch(console.error);
                setActiveId(null);
              }}
            >
              ← All posts
            </button>
            <input
              aria-label="Post name"
              value={post.name}
              onChange={(event) =>
                update((draft: SocialPost) => {
                  draft.name = event.target.value;
                })
              }
            />
            <span role="status">{artworkUpload ? `Uploading images ${artworkUpload.completed}/${artworkUpload.total}…` : dirtyId === post.id ? "Saving changes…" : "Saved for the team"}</span>
            <button
              type="button"
              className="social-danger"
              onClick={() => setConfirmDelete(true)}
              disabled={Boolean(busy)}
            >
              <NavIcon name="archive" size={17} />{t("Disable")}
            </button>
          </div>
          <div className="social-editor-grid">
            <aside className="social-panel social-settings">
              <section>
                <h3>1 · Products</h3>
                <p>
                  Choose 1–6. Drag to reorder; drag on the artwork to place each
                  product.
                </p>
                <button
                  className="social-add"
                  type="button"
                  onClick={() => setPicker(true)}
                  disabled={post.products.length >= 6}
                >
                  ＋ Add products
                </button>
                <div className="social-product-list">
                  {post.products.map((item) => (
                    <div
                      draggable
                      key={item.code}
                      onDragStart={(event) => {
                        setDragging(item.code);
                        event.dataTransfer.setData("text/plain", item.code);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        update((draft: SocialPost) => {
                          draft.products = reorderByCode(
                            draft.products,
                            dragging ||
                              event.dataTransfer.getData("text/plain"),
                            item.code,
                          );
                        });
                        setDragging(null);
                      }}
                    >
                      <span className="social-grip">⋮⋮</span>
                      <img src={imageSource(item.image)} alt="" />
                      <span>
                        <b>{item.name}</b>
                        <small>
                          {item.brand} · {item.code}
                        </small>
                      </span>
                      <button
                        type="button"
                        onClick={() => setImageCode(item.code)}
                        title="Change image"
                      >
                        ▣
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          update((draft: SocialPost) => {
                            draft.products = draft.products.filter(
                              (product: Product) => product.code !== item.code,
                            );
                          })
                        }
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h3>2 · Format &amp; design</h3>
                <div className="social-field">
                  <span>Channel / shape</span>
                  <StudioSelect
                    label="Channel and shape"
                    value={post.preset}
                    searchable
                    options={SOCIAL_PRESETS.map((item) => ({
                      value: item.id,
                      label: item.label,
                      detail: `${item.width} × ${item.height} px`,
                      group: item.channel,
                    }))}
                    onChange={(value) =>
                      update((draft: SocialPost) => {
                        draft.preset = value;
                      })
                    }
                  />
                </div>
                <p className="social-help">
                  {SOCIAL_PRESETS.find((item) => item.id === post.preset)?.note}{" "}
                  Platforms may still compress uploaded media.{" "}
                  {SOCIAL_PRESETS.find((item) => item.id === post.preset)
                    ?.source && (
                    <a
                      href={
                        SOCIAL_PRESETS.find((item) => item.id === post.preset)
                          ?.source
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Platform guidance ↗
                    </a>
                  )}
                </p>
                {post.preset === "custom" && (
                  <div className="social-inline">
                    <label>
                      Width{" "}
                      <input
                        type="number"
                        min="320"
                        max="8192"
                        value={post.customWidth}
                        onChange={(event) =>
                          update((draft: SocialPost) => {
                            draft.customWidth = Number(event.target.value);
                          })
                        }
                      />
                    </label>
                    <label>
                      Height{" "}
                      <input
                        type="number"
                        min="320"
                        max="8192"
                        value={post.customHeight}
                        onChange={(event) =>
                          update((draft: SocialPost) => {
                            draft.customHeight = Number(event.target.value);
                          })
                        }
                      />
                    </label>
                  </div>
                )}
                <div className="social-field">
                  <span>Export resolution</span>
                  <StudioSelect
                    label="Export resolution"
                    value={post.quality}
                    options={QUALITY_PRESETS.map((item) => ({
                      value: item.id,
                      label: item.label,
                      detail: `Up to ${item.longEdge.toLocaleString()} px on the long side`,
                    }))}
                    onChange={(value) =>
                      update((draft: SocialPost) => {
                        draft.quality = value;
                      })
                    }
                  />
                </div>
                <small className="social-dimensions">
                  Output: {dims.width} × {dims.height} px · Image sharpness also
                  depends on the source photos.
                </small>
                <div className="social-template-grid">
                  {TEMPLATES.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={post.template === item.id ? "selected" : ""}
                      aria-pressed={post.template === item.id}
                      onClick={() =>
                        update((draft: SocialPost) => {
                          draft.template = item.id;
                        })
                      }
                    >
                      <DesignPreview kind="template" id={item.id} image={post.products[0]?.image} />
                      <b>{item.label}</b>
                      <small>{item.detail}</small>
                    </button>
                  ))}
                </div>
                <div className="social-choice-heading"><strong>Price design</strong><small>Preview the regular price, saving and 12 month payment together.</small></div>
                <div className="social-template-grid social-price-choice-grid">
                  {PRICE_STYLES.map((item) => <button type="button" key={item.id} className={normalizedPriceStyle(post.priceStyle) === item.id ? "selected" : ""} aria-pressed={normalizedPriceStyle(post.priceStyle) === item.id} onClick={() => update((draft: SocialPost) => { draft.priceStyle = item.id; })}>
                    <DesignPreview kind="price" id={item.id} />
                    <b>{item.label}</b><small>{item.detail}</small>
                  </button>)}
                </div>
                <div className="social-choice-heading"><strong>Product details</strong><small>Choose how the brand, name and specifications appear.</small></div>
                <div className="social-template-grid social-detail-choice-grid">
                  {DETAIL_STYLES.map((item) => <button type="button" key={item.id} className={(post.detailStyle || "chips") === item.id ? "selected" : ""} aria-pressed={(post.detailStyle || "chips") === item.id} onClick={() => update((draft: SocialPost) => { draft.detailStyle = item.id; })}>
                    <DesignPreview kind="detail" id={item.id} />
                    <b>{item.label}</b><small>{item.detail}</small>
                  </button>)}
                </div>
              </section>
              <section>
                <h3>3 · Background</h3>
                <div className="social-segment">
                  {["solid", "gradient", "image"].map((type) => (
                    <button
                      type="button"
                      key={type}
                      className={
                        post.background.type === type ? "selected" : ""
                      }
                      onClick={() =>
                        update((draft: SocialPost) => {
                          draft.background.type = type;
                        })
                      }
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {post.background.type === "solid" && (
                  <div className="social-field">
                    <span>Background color</span>
                    <ColorField
                      label="Background color"
                      value={post.background.color}
                      onChange={(value) =>
                        update((draft: SocialPost) => {
                          draft.background.color = value;
                        })
                      }
                    />
                  </div>
                )}
                {post.background.type === "gradient" && (
                  <div className="social-gradient-controls">
                    <div className="social-field">
                      <span>From</span>
                      <ColorField
                        label="Gradient start"
                        value={post.background.from}
                        onChange={(value) =>
                          update((draft: SocialPost) => {
                            draft.background.from = value;
                          })
                        }
                      />
                    </div>
                    <div className="social-field">
                      <span>To</span>
                      <ColorField
                        label="Gradient end"
                        value={post.background.to}
                        onChange={(value) =>
                          update((draft: SocialPost) => {
                            draft.background.to = value;
                          })
                        }
                      />
                    </div>
                    <div className="social-gradient-directions">
                      <span>Direction</span>
                      <div>
                        {GRADIENT_DIRECTIONS.map((direction) => (
                          <button
                            type="button"
                            key={direction.angle}
                            className={
                              Number(post.background.angle) === direction.angle
                                ? "selected"
                                : ""
                            }
                            aria-pressed={
                              Number(post.background.angle) === direction.angle
                            }
                            title={direction.label}
                            onClick={() =>
                              update((draft: SocialPost) => {
                                draft.background.angle = direction.angle;
                              })
                            }
                          >
                            <i
                              style={{
                                background: `linear-gradient(${direction.angle}deg, ${post.background.from}, ${post.background.to})`,
                              }}
                            />
                            <b>{direction.icon}</b>
                            <small>{direction.label}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {post.background.type === "image" && (
                  <ImageUploadButton
                    label="Background image"
                    hint="JPG, PNG or WebP"
                    value={post.background.image}
                    onFile={async (file) => {
                      try {
                        const image = await readImage(file);
                        update((draft: SocialPost) => {
                          draft.background.image = image;
                        });
                      } catch {
                        setMessage("Could not read the background image.");
                      }
                    }}
                    onRemove={() =>
                      update((draft: SocialPost) => {
                        draft.background.image = "";
                      })
                    }
                  />
                )}
                <label>
                  AI background idea
                  <textarea
                    value={post.backgroundPrompt || ""}
                    onChange={(event) =>
                      update((draft: SocialPost) => {
                        draft.backgroundPrompt = event.target.value;
                      })
                    }
                    placeholder="e.g. warm living room with clear wall space for an air conditioner"
                  />
                </label>
                <button
                  type="button"
                  className="social-ai-button"
                  onClick={aiBackground}
                  disabled={Boolean(busy)}
                >
                  {busy === "background"
                    ? "Generating…"
                    : "✦ Generate background with AI"}
                </button>
                <p className="social-help">
                  AI creates only the scene. Product cutouts, logos and prices
                  remain editable layers.
                </p>
              </section>
              <section>
                <h3>4 · Copy &amp; overlays</h3>
                <button
                  type="button"
                  className="social-add"
                  onClick={() => setRich(true)}
                >
                  ✎ Edit formatted top text
                </button>
                <button
                  type="button"
                  className="social-ai-button"
                  onClick={aiReview}
                  disabled={Boolean(busy)}
                >
                  {busy === "review" ? "Checking…" : "✦ Check all text with AI"}
                </button>
                {review.length > 0 && (
                  <div className="social-review">
                    <b>Suggested corrections</b>
                    {review.map((change) => (
                      <div key={change.id}>
                        <del>{change.original}</del>
                        <strong>{change.suggested}</strong>
                        <small>{change.reason}</small>
                        <button
                          type="button"
                          onClick={() => applyReview([change])}
                        >
                          Apply
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => applyReview(review)}>
                      Apply all
                    </button>
                    <button type="button" onClick={() => setReview([])}>
                      Dismiss
                    </button>
                  </div>
                )}
                {POST_VISIBILITY.map(([key, label]) => (
                  <label className="social-check" key={key}>
                    <input
                      type="checkbox"
                      checked={post[key] !== false}
                      disabled={["showRegular", "showSaving", "showInstallments"].includes(key) && !post.showPrice}
                      onChange={(event) =>
                        update((draft: SocialPost) => {
                          draft[key] = event.target.checked;
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
                <div className="social-field">
                  <span>Saving display</span>
                  <StudioSelect
                    label="Saving display"
                    disabled={!post.showPrice || !post.showSaving}
                    value={post.savingMode}
                    options={[
                      { value: "money", label: "Money off (€)" },
                      { value: "percentage", label: "Percentage off (%)" },
                    ]}
                    onChange={(value) =>
                      update((draft: SocialPost) => {
                        draft.savingMode = value;
                      })
                    }
                  />
                </div>
              </section>
              <section>
                <h3>5 · Logos &amp; badges</h3>
                <label className="social-check">
                  <input
                    type="checkbox"
                    checked={post.showNeptunLogo}
                    onChange={(event) =>
                      update((draft: SocialPost) => {
                        draft.showNeptunLogo = event.target.checked;
                      })
                    }
                  />
                  NEPTUN logo
                </label>
                <fieldset className="social-dependent-controls" disabled={!post.showNeptunLogo}>
                <div className="social-logo-choices" role="group" aria-label="NEPTUN logo design">
                  {[
                    { id: "white", label: "White N", image: "/api/assets/legacy/assets/social/neptun-white.png" },
                    { id: "blue", label: "Blue N", image: "/api/assets/legacy/assets/social/neptun-blue.png" },
                    { id: "footer", label: "Bottom logo + line", image: "/api/assets/app/logo" },
                  ].map((choice) => <button type="button" key={choice.id} className={(choice.id === "footer" ? post.logoLayout === "footer" : post.logoLayout !== "footer" && post.logoVariant === choice.id) ? "selected" : ""} aria-pressed={choice.id === "footer" ? post.logoLayout === "footer" : post.logoLayout !== "footer" && post.logoVariant === choice.id} onClick={() => update((draft: SocialPost) => { if (choice.id === "footer") draft.logoLayout = "footer"; else { draft.logoLayout = "corner"; draft.logoVariant = choice.id; } })}>
                    <span className={`social-logo-choice-art ${choice.id}`}><img src={choice.image} alt="" />{choice.id === "footer" && <i />}</span><b>{choice.label}</b>
                  </button>)}
                </div>
                {post.logoLayout !== "footer" &&
                <div className="social-inline">
                  <div className="social-field">
                    <span>Position</span>
                    <StudioSelect
                      label="NEPTUN logo position"
                      disabled={!post.showNeptunLogo}
                      value={post.logoPosition}
                      options={POSITIONS.map((value) => ({
                        value,
                        label: value.replace("-", " "),
                      }))}
                      onChange={(value) =>
                        update((draft: SocialPost) => {
                          draft.logoPosition = value;
                          if (draft.logoCoords) delete draft.logoCoords.neptun;
                        })
                      }
                    />
                  </div>
                </div>}
                <LogoSize label="NEPTUN logo size" value={post.logoScale} onChange={(value) => update((draft: SocialPost) => { draft.logoScale = value; })} />
                <ImageUploadButton
                  label="Upload NEPTUN logo"
                  hint="Overrides the built-in logo"
                  value={post.neptunLogoUpload}
                  onFile={async (file) => {
                    try {
                      const image = await readImage(file);
                      update((draft: SocialPost) => {
                        draft.neptunLogoUpload = image;
                        draft.showNeptunLogo = true;
                      });
                    } catch {
                      setMessage("Could not read the logo image.");
                    }
                  }}
                  onRemove={() =>
                    update((draft: SocialPost) => {
                      draft.neptunLogoUpload = "";
                    })
                  }
                />
                </fieldset>
                <label className="social-check">
                  <input
                    type="checkbox"
                    checked={post.showEventLogo}
                    onChange={(event) =>
                      update((draft: SocialPost) => {
                        draft.showEventLogo = event.target.checked;
                      })
                    }
                  />
                  Event badge
                </label>
                <fieldset className="social-dependent-controls" disabled={!post.showEventLogo}>
                <div className="social-inline">
                  <div className="social-field">
                    <span>Badge</span>
                    <StudioSelect
                      label="Event badge"
                      disabled={!post.showEventLogo}
                      value={post.eventLogo}
                      options={EVENT_LOGOS.map((item) => ({
                        value: item.id,
                        label: item.label,
                      }))}
                      onChange={(value) =>
                        update((draft: SocialPost) => {
                          draft.eventLogo = value;
                        })
                      }
                    />
                  </div>
                  <div className="social-field">
                    <span>Position</span>
                    <StudioSelect
                      label="Event badge position"
                      disabled={!post.showEventLogo}
                      value={post.eventPosition}
                      options={POSITIONS.map((value) => ({
                        value,
                        label: value.replace("-", " "),
                      }))}
                      onChange={(value) =>
                        update((draft: SocialPost) => {
                          draft.eventPosition = value;
                          if (draft.logoCoords) delete draft.logoCoords.event;
                        })
                      }
                    />
                  </div>
                </div>
                <LogoSize label="Event badge size" value={post.eventScale} onChange={(value) => update((draft: SocialPost) => { draft.eventScale = value; })} />
                <ImageUploadButton
                  label="Upload event badge"
                  hint="Overrides the selected badge"
                  value={post.eventLogoUpload}
                  onFile={async (file) => {
                    try {
                      const image = await readImage(file);
                      update((draft: SocialPost) => {
                        draft.eventLogoUpload = image;
                        draft.showEventLogo = true;
                      });
                    } catch {
                      setMessage("Could not read the badge image.");
                    }
                  }}
                  onRemove={() =>
                    update((draft: SocialPost) => {
                      draft.eventLogoUpload = "";
                    })
                  }
                />
                </fieldset>
                <ImageUploadButton
                  label="Extra campaign logo"
                  hint="Optional additional mark"
                  value={post.customLogo}
                  onFile={async (file) => {
                    try {
                      const image = await readImage(file);
                      update((draft: SocialPost) => {
                        draft.customLogo = image;
                        draft.showCustomLogo = true;
                      });
                    } catch {
                      setMessage("Could not read the campaign logo.");
                    }
                  }}
                  onRemove={() =>
                    update((draft: SocialPost) => {
                      draft.customLogo = "";
                      draft.showCustomLogo = false;
                    })
                  }
                />
                {post.customLogo && (
                  <div className="social-custom-logo-controls">
                    <label className="social-check">
                      <input
                        type="checkbox"
                        checked={post.showCustomLogo}
                        onChange={(event) =>
                          update((draft: SocialPost) => {
                            draft.showCustomLogo = event.target.checked;
                          })
                        }
                      />
                      Show upload
                    </label>
                    <fieldset className="social-dependent-controls" disabled={!post.showCustomLogo}>
                    <div className="social-field">
                      <span>Position</span>
                      <StudioSelect
                        label="Extra logo position"
                        disabled={!post.showCustomLogo}
                        value={post.customLogoPosition}
                        options={POSITIONS.map((value) => ({
                          value,
                          label: value.replace("-", " "),
                        }))}
                        onChange={(value) =>
                          update((draft: SocialPost) => {
                            draft.customLogoPosition = value;
                            if (draft.logoCoords) delete draft.logoCoords.custom;
                          })
                        }
                      />
                    </div>
                    <LogoSize label="Extra logo size" value={post.customLogoScale} onChange={(value) => update((draft: SocialPost) => { draft.customLogoScale = value; })} />
                    </fieldset>
                  </div>
                )}
                <BrandLogoManager campaign={post} onUpdate={update} />
                <div className="social-artwork-settings">
                  <strong>Images on this post</strong>
                  <ReusableImages settings={settings} onAdd={addSavedArtwork} />
                  <p>Add campaign marks or other images. Drag them on the post to move; drag the corner to resize. You can also drop image files directly onto the canvas.</p>
                  <FileUpload
                    aria-label="Add images to post"
                    accept="image/*"
                    multiple
                    disabled={Boolean(artworkUpload)}
                    onChange={(event) => {
                      const files = [...(event.target.files || [])];
                      event.target.value = "";
                      void addArtworks(files);
                    }}
                  >
                    {artworkUpload
                      ? `Uploading ${artworkUpload.completed}/${artworkUpload.total}…`
                      : "Add images"}
                  </FileUpload>
                  {(post.artworks || []).map((artwork) => <div className="social-artwork-row" key={artwork.id}><img src={artwork.image} alt="" /><span>{artwork.name}</span><input type="range" min="4" max="70" value={artwork.width} aria-label={`Size: ${artwork.name}`} onChange={(event) => updateAsset(artwork.id, { x: artwork.x, y: artwork.y, width: Number(event.target.value) })} /><button type="button" aria-label={`Remove ${artwork.name}`} onClick={() => update((draft: SocialPost) => { draft.artworks = (draft.artworks || []).filter((item) => item.id !== artwork.id); })}>×</button></div>)}
                </div>
              </section>
            </aside>
            <div className="social-preview-column">
              <div className="social-preview-heading">
                <div>
                  <small>LIVE PREVIEW</small>
                  <h2>
                    {
                      SOCIAL_PRESETS.find((item) => item.id === post.preset)
                        ?.label
                    }
                  </h2>
                </div>
                <span>
                  {dims.width} × {dims.height}
                </span>
              </div>
              <div className="social-canvas-toolbar" role="group" aria-label="Post canvas controls">
                <button type="button" className={!previewMode ? "selected" : ""} onClick={() => setPreviewMode(false)}>Edit</button>
                <button type="button" className={previewMode ? "selected" : ""} onClick={() => setPreviewMode(true)}>Preview</button>
                {!previewMode && <button type="button" className={post.showGrid ? "selected" : ""} aria-pressed={Boolean(post.showGrid)} onClick={() => update((draft) => { draft.showGrid = !draft.showGrid; })}>{post.showGrid ? "Hide grid" : "Show grid"}</button>}
              </div>
              {!previewMode && <div className="social-layout-controls" aria-label="Post size and grid">
                <label>Post size<SearchableSelect aria-label="Post size" value={post.preset} onChange={(event) => update((draft) => { draft.preset = event.target.value; })}>{SOCIAL_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SearchableSelect></label>
                {post.preset === "custom" && <>
                  <label>Width (px)<input aria-label="Post width in pixels" type="number" min="320" max="8192" value={post.customWidth} onChange={(event) => update((draft) => { draft.customWidth = Number(event.target.value); })} /></label>
                  <label>Height (px)<input aria-label="Post height in pixels" type="number" min="320" max="8192" value={post.customHeight} onChange={(event) => update((draft) => { draft.customHeight = Number(event.target.value); })} /></label>
                </>}
                {([['Rows', 'rows', 1, 6], ['Columns', 'columns', 1, 6], ['Spacing (%)', 'gap', 0, 20]] as const).map(([label, key, min, max]) => <label key={key}>{label}<input aria-label={`Product grid ${label.toLowerCase()}`} type="number" min={min} max={max} value={post.productGrid?.[key] ?? (key === 'gap' ? 4 : key === 'columns' ? Math.min(3, post.products.length || 1) : Math.ceil((post.products.length || 1) / 3))} onChange={(event) => update((draft) => { draft.productGrid = { rows: Math.ceil((draft.products.length || 1) / 3), columns: Math.min(3, draft.products.length || 1), gap: 4, ...draft.productGrid, [key]: Math.max(min, Math.min(max, Number(event.target.value) || min)) }; })} /></label>)}
                <button type="button" onClick={() => update((draft) => { const grid = { rows: Math.ceil((draft.products.length || 1) / 3), columns: Math.min(3, draft.products.length || 1), gap: 4, ...draft.productGrid }; draft.productGrid = { ...grid, rows: Math.max(grid.rows, Math.ceil(draft.products.length / grid.columns)) }; draft.products = layoutSocialProducts(draft.products, draft.productGrid); })}>Apply product grid</button>
                <small>Grid layout moves products. Your separate images keep their positions and proportions.</small>
              </div>}
              <PostCanvas
                post={post}
                previewCutouts={previewCutouts}
                maxWidth={Math.max(
                  260,
                  Math.min(
                    750,
                    ((viewportHeight - 390) * dims.width) / dims.height,
                  ),
                )}
                canvasRef={canvasRef}
                showGuides={!previewMode && post.showGrid}
                onMove={previewMode ? undefined : (code, x, y) =>
                  update((draft: SocialPost) => {
                    const item = draft.products.find(
                      (product: Product) => product.code === code,
                    );
                    if (item) Object.assign(item, { x, y, positioned: true });
                  })
                }
                onResize={previewMode ? undefined : (code, scale, point) => update((draft: SocialPost) => { const item = draft.products.find((product: Product) => product.code === code); if (item) Object.assign(item, { scale, x: point.x, y: point.y, positioned: true }); })}
                onEditProduct={previewMode ? undefined : (code: string) => setImageCode(code)}
                onEditScreen={previewMode ? undefined : (code: string) => setScreenCode(code)}
                imageAdjustCode={!previewMode ? imageAdjustCode : null}
                onToggleImageAdjust={previewMode ? undefined : (code: string) => setImageAdjustCode((current) => current === code ? null : code)}
                onPlaceImage={previewMode ? undefined : (code, placement) => update((draft: SocialPost) => {
                  const product = draft.products.find((item) => item.code === code);
                  if (product) product.postImagePlacement = placement;
                })}
                onDropImage={previewMode ? undefined : dropProductImage}
                onAddArtwork={previewMode ? undefined : addArtworks}
                onAddSavedArtwork={previewMode ? undefined : addSavedArtwork}
                onUpdateAsset={previewMode ? undefined : updateAsset}
                onRemoveArtwork={previewMode ? undefined : (id) => update((draft: SocialPost) => { draft.artworks = (draft.artworks || []).filter((item) => item.id !== id); })}
                onReorderDetails={previewMode ? undefined : reorderDetails}
                onChangeProduct={previewMode ? undefined : (code, field, value) => update((draft: SocialPost) => {
                  const product = draft.products.find((item) => item.code === code);
                  if (product) Object.assign(product, typeof field === "object" ? field : { [field]: value });
                })}
                onMoveOfferBlock={previewMode ? undefined : (code, kind, placement) => update((draft: SocialPost) => {
                  const product = draft.products.find((item) => item.code === code);
                  if (product) {
                    product.offerPlacements ||= {};
                    product.offerPlacements[kind] = placement;
                  }
                })}
                onEditDetails={previewMode ? undefined : (code) =>
                  document
                    .getElementById(`social-product-${code}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
              />
              <p className="social-preview-hint">
                Drag a product, logo, detail or price to move it; drag a corner to resize. Use the photo positioning tool to move the photo inside its area. Drop a new image on a product to replace its photo. Double-click a detail to change its fill; use its pencil to edit the text. Preview hides the editing controls.
              </p>
              <div className="social-export-bar">
                <span>Download</span>
                {["png", "jpg", "webp", "pdf"].map((format) => (
                  <button
                    type="button"
                    key={format}
                    disabled={Boolean(busy)}
                    onClick={() => exportPost(format)}
                  >
                    {busy === `export-${format}`
                      ? "Rendering…"
                      : `↓ ${format.toUpperCase()}`}
                  </button>
                ))}
                <small>
                  Use PNG or JPG for direct social uploads; WebP and PDF are
                  extra delivery formats. Platforms may resize or compress.
                </small>
                {exportNotice && (
                  <p className={`social-export-notice social-export-notice-${exportNotice.kind}`} role="status" aria-live="polite">
                    {exportNotice.text}
                  </p>
                )}
                {exportReady && (
                  <a className="social-export-direct" href={exportReady.url} download={exportReady.filename}>
                    ↓ Download {exportReady.filename} directly
                  </a>
                )}
              </div>
              <div className="social-product-editors">
                {post.products.map((item: Product) => (
                  <div id={`social-product-${item.code}`} key={item.code}>
                    <div className="social-edit-heading">
                      <h3>{item.name}</h3>
                      <button
                        type="button"
                        onClick={() => setImageCode(item.code)}
                      >
                        Change image
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busy) || !post.background?.image}
                        onClick={() => aiPlacement(item)}
                      >
                        {busy === `place-${item.code}`
                          ? "Analyzing…"
                          : "✦ AI place on background"}
                      </button>
                    </div>
                    <div className="social-edit-fields">
                      <label>
                        Name
                        <input
                          value={item.name}
                          onChange={(event) =>
                            update((draft: SocialPost) => {
                              const product = draft.products.find((entry) => entry.code === item.code);
                              if (product) product.name = event.target.value;
                            })
                          }
                        />
                      </label>
                      <label>
                        Brand
                        <input
                          value={item.brand}
                          onChange={(event) =>
                            update((draft: SocialPost) => {
                              const product = draft.products.find((entry) => entry.code === item.code);
                              if (product) product.brand = event.target.value;
                            })
                          }
                        />
                      </label>
                      <label>
                        Regular €
                        <input
                          type="number"
                          min="0"
                          step=".01"
                          value={item.regular ?? ""}
                          onChange={(event) =>
                            update((draft: SocialPost) => {
                              const product = draft.products.find((entry) => entry.code === item.code);
                              if (product) product.regular = Number(event.target.value);
                            })
                          }
                        />
                      </label>
                      <label>
                        Sale €
                        <input
                          type="number"
                          min="0"
                          step=".01"
                          value={item.sale}
                          onChange={(event) =>
                            update((draft: SocialPost) => {
                              const product = draft.products.find((entry) => entry.code === item.code);
                              if (product) product.sale = Number(event.target.value);
                            })
                          }
                        />
                      </label>
                      <div className="social-field">
                        <span>Price design for this product</span>
                        <StudioSelect label={`Price design for ${item.name}`} value={item.offerStyle || item.priceStyle ? normalizedPriceStyle(item.offerStyle || item.priceStyle) : "default"} options={[{ value: "default", label: `Use post design · ${PRICE_STYLES.find((style) => style.id === normalizedPriceStyle(post.priceStyle))?.label}` }, ...PRICE_STYLES.map((style) => ({ value: style.id, label: style.label, detail: style.detail }))]} onChange={(value: string) => update((draft: SocialPost) => { const product = draft.products.find((entry) => entry.code === item.code); if (!product) return; if (value === "default") { delete product.priceStyle; delete product.offerStyle; } else { product.priceStyle = value; product.offerStyle = value; } })} />
                      </div>
                      <div className="social-field">
                        <span>Savings badge for this product</span>
                        <StudioSelect label={`Savings badge for ${item.name}`} value={item.savingMode || "default"} options={[{ value: "default", label: `Use post setting · ${post.savingMode === "percentage" ? "Zbritje" : "Kurseni"}` }, { value: "money", label: "Kurseni · amount saved" }, { value: "percentage", label: "Zbritje · percentage off" }]} onChange={(value: string) => update((draft: SocialPost) => { const product = draft.products.find((entry) => entry.code === item.code); if (!product) return; if (value === "default") delete product.savingMode; else product.savingMode = value; })} />
                      </div>
                      <div className="social-field">
                        <span>{t("Product details position")}</span>
                        <StudioSelect label={`${t("Product details position")}: ${item.name}`} value={defaultProductDetailPlacement(postPriceProduct(item), postPriceCampaign(post))} options={[{ value: "left", label: t("Left of image") }, { value: "bottom", label: t("Below image") }]} onChange={(value) => update((draft: SocialPost) => {
                          const product = draft.products.find((entry) => entry.code === item.code);
                          if (product) product.detailPlacement = value;
                        })} />
                      </div>
                      <label>
                        Size{" "}
                        <input
                          type="range"
                          min="15"
                          max="85"
                          value={item.scale ?? (post.products.length === 1 ? 70 : post.products.length === 2 ? 44 : 31)}
                          onChange={(event) =>
                            update((draft: SocialPost) => {
                              const product = draft.products.find(
                                (entry) => entry.code === item.code,
                              );
                              if (!product) return;
                              product.scale = Number(event.target.value);
                              product.positioned = true;
                            })
                          }
                        />
                      </label>
                      <label className="social-check">
                        <input
                          type="checkbox"
                          checked={item.showImage !== false}
                          onChange={(event) =>
                            update((draft: SocialPost) => {
                              const product = draft.products.find((entry) => entry.code === item.code);
                              if (product) product.showImage = event.target.checked;
                            })
                          }
                        />
                        Show separate cutout
                      </label>
                      <label className="social-wide">
                        Short details shown on post
                        <input
                          value={item.postDetails || ""}
                          onChange={(event) =>
                            update((draft: SocialPost) => {
                              const product = draft.products.find((entry) => entry.code === item.code);
                              if (product) product.postDetails = event.target.value;
                            })
                          }
                        />
                      </label>
                      <label className="social-wide">
                        Description
                        <textarea
                          value={item.description}
                          onChange={(event) =>
                            update((draft: SocialPost) => {
                              const product = draft.products.find((entry) => entry.code === item.code);
                              if (product) product.description = event.target.value;
                            })
                          }
                        />
                      </label>
                      <label className="social-wide">
                        {Array.isArray(item.brochureDetails) || (isMobilePhone(item) && !isAppleProduct(item)) || isAirConditioner(item) ? t("Product details · one per line, in order") : "Specifications for new catalog products (one per line: label: value)"}
                        <textarea
                          value={Array.isArray(item.brochureDetails) ? item.brochureDetails.map(row => typeof row === "string" ? row : row.text).join("\n") : socialProductDetailEntries(item)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join("\n")}
                          onChange={(event) =>
                            update((draft: SocialPost) => {
                              const product = draft.products.find((entry) => entry.code === item.code);
                              if (!product) return;
                              if (Array.isArray(product.brochureDetails) || (isMobilePhone(product) && !isAppleProduct(product)) || isAirConditioner(product)) product.brochureDetails = event.target.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
                              else product.specs = Object.fromEntries(event.target.value.split(/\r?\n/).map((line) => line.split(/:(.+)/).map((piece) => piece?.trim())).filter(([key, value]) => key && value));
                            })
                          }
                        />
                      </label>
                      <div className="social-wide cs-detail-fill-list">
                        {socialProductDetailEntries(item).filter(([, value]) => value != null && String(value).trim()).map(([key, value]) => <label className="cs-detail-fill-choice" key={key}><span>{String(value)}</span><SearchableSelect aria-label={`${t("Block style")}: ${key}`} value={typeof item.detailBlockStyles?.[key] === "string" ? item.detailBlockStyles[key] : "auto"} onChange={(event) => update((draft: SocialPost) => {
                          const product = draft.products.find((entry) => entry.code === item.code);
                          const style = event.target.value;
                          if (product && (style === "auto" || style === "filled" || style === "outline")) product.detailBlockStyles = { ...product.detailBlockStyles, [key]: style };
                        })}><option value="auto">{t("Automatic")}</option><option value="filled">{t("White block")}</option><option value="outline">{t("Outlined block")}</option></SearchableSelect></label>)}
                      </div>
                    </div>
                    <SocialScreenAnnotationControls product={item} onChange={(field, value) => update((draft: SocialPost) => {
                      const product = draft.products.find((entry) => entry.code === item.code);
                      if (product) Object.assign(product, typeof field === "object" ? field : { [field]: value });
                    })} />
                    <ProductArtworkControls product={item} onChange={(field, value) => update((draft: SocialPost) => {
                      const product = draft.products.find((entry) => entry.code === item.code);
                      if (product) Object.assign(product, typeof field === "object" ? field : { [field]: value });
                    })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && post && (
        <div
          className="social-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy)
              setConfirmDelete(false);
          }}
        >
          <section
            className="social-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t("Disable social post")}
          >
            <div className="social-confirm-icon"><NavIcon name="archive" size={28} /></div>
            <h2>{t("Disable this post?")}</h2>
            <p>
              <strong>{post.name}</strong><br />{t("The post is kept and can only be viewed and enabled by a superadmin.")}
            </p>
            <div>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={Boolean(busy)}
              >
                Keep post
              </button>
              <button
                type="button"
                className="danger"
                onClick={deleteActive}
                disabled={Boolean(busy)}
              >
                {t(busy === "delete" ? "Disabling…" : "Disable post")}
              </button>
            </div>
          </section>
        </div>
      )}
      {picker && post && (
        <ProductPicker
          key={String(canViewCatalog)}
          canViewCatalog={canViewCatalog}
          catalog={catalog}
          campaigns={campaigns}
          post={post}
          onAdd={(item) => {
            if (post.products.length >= 6) return;
            update((draft: SocialPost) => {
              draft.products.push(productForPost(item));
            });
          }}
          onClose={() => setPicker(false)}
        />
      )}
      {rich && post && (
        <RichTextModal
          html={post.textHtml}
          onSave={(html) => {
            update((draft: SocialPost) => {
              draft.textHtml = html;
            });
            setRich(false);
          }}
          onClose={() => setRich(false)}
        />
      )}
      {imageProduct && (
        <ProductImageEditor
          product={imageProduct}
          backgroundContext={preparationBackground}
          catalogProduct={catalog.find(
            (item) => String(item.code) === String(imageProduct.code),
          )}
          onSave={({ image, aiOriginalImage, skipAiCutout, ...preparationMetadata }) =>
            update((draft: SocialPost) => {
              const item = draft.products.find(
                (product: Product) => product.code === imageCode,
              );
              if (!item) return;
              clearPostImagePreparation(item);
              item.image = image;
              item.aiOriginalImage = aiOriginalImage;
              Object.assign(item, preparationMetadata);
              item.skipAiCutout = skipAiCutout;
              item.cutoutStatus = skipAiCutout ? "skipped" : "done";
              item.imageChoices = [...new Set([image, ...(item.imageChoices || [])].filter((url): url is string => typeof url === "string"))];
              delete item.screenArtwork;
            })
          }
          onClose={() => setImageCode(null)}
        />
      )}
      {screenProduct && <ScreenImageEditor product={screenProduct} onSave={(screenArtwork) => update((draft: SocialPost) => { const item = draft.products.find((product: Product) => product.code === screenCode); if (!item) return; if (screenArtwork) item.screenArtwork = screenArtwork; else delete item.screenArtwork; })} onClose={() => setScreenCode(null)} />}
    </div>
  );
}
