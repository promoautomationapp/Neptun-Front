import { COVER_OPTIONS } from "../settings/options";
import { stableMeasurement } from "./layoutObservation";
import { logoForBackground } from "../settings/logo-rules";
import {
  defaultPhotoPlacement,
  defaultDetailFill,
  defaultRegionScale,
  productDesignFor,
  productGridStyle,
  productTypographyStyle,
} from "../settings/product-design-defaults";
import "../../styles/product-design-defaults.css";
import type { CampaignAssetChange } from "./CampaignAssetArtwork";
import { CampaignAssetArtwork } from "./CampaignAssetArtwork";
import { ProductBrandArtwork } from "./ProductBrandArtwork";
import {
  coverTextColor,
  coverMessageVisible,
  isFeaturedCoverProduct,
} from "./coverPresentation";
import {
  visibleContact,
  visibleStoreLines,
  iconVisible,
  iconSource,
} from "../settings/brochure-display";
import type {
  Campaign,
  Product,
  Placement,
  Settings,
  Box,
} from "../../domain/models";
import type { BrochurePage } from "./campaignPages";
import type { CoverElementProps } from "./CoverElement";
import type { PageArtworkProps } from "./PageArtwork";
import type { CompactStoresFooterProps } from "./CompactStoresFooter";
import type { StoresElementProps } from "./StoresElement";
import React from "react";
import { coverProducts, splitPages } from "./campaignPages";
import {
  displaySpecs,
  hasEditableScreen,
  otherScreenInches,
  tvScreenInches,
} from "./tvSpecs";
import { warrantyDuration } from "./warranty";
import { productColors } from "./colors";
import { offerStyleFor, savingModeFor } from "./offerStyles";
import { t } from "./i18n";
import { MissingCatalogNotice } from "./MissingCatalogNotice";
import { hasExcelOfferPrice, hasRegularPrice } from "./missingCatalog";
import { brandLogoFor } from "./brandLogos";
import {
  pageBackgroundColor,
  pageBackgroundFill,
  pageBackgroundImage,
  pageBackgroundContrastColor,
  pageBackgroundReadability,
} from "./pageBackground";
import {
  backgroundReadability,
  backgroundReadabilityStyle,
} from "./backgroundContrast";
import { NeptunWordmark } from "./NeptunWordmark";
import { PageArtwork } from "./PageArtwork";
import { CoverElement } from "./CoverElement";
import { coverGradientFill, coverProductPlacement } from "./coverElements";
import {
  cardSize,
  occupiedProductRows,
  layoutGrid,
  BROCHURE_LAYOUTS,
} from "./brochureLayout";
import { ReferencePriceCard } from "./ReferencePriceCard";
import { RedReferencePrice, RedReferenceSavings } from "./RedReferencePrice";
import {
  usesRedReferencePrice,
  usesBlueReferencePrice,
  isAppleProduct,
} from "./priceDesign";
import { EditableScreenAnnotation } from "./EditableScreenAnnotation";
import { ProductArtworkLayer } from "./ProductArtworkLayer";
import { ApplePhotoClearance } from "./ApplePhotoClearance";
import { DefaultSavingsClearance } from "./DefaultSavingsClearance";
import {
  ProductNameDivider,
  materializeProductNameAlignment,
} from "./ProductNameDivider";
import { isBundleOffer } from "./productBundles";
import { LargeBundleOffer } from "./LargeBundleOffer";
import { isLargeBundleOffer } from "./largeBundleLayout";
import { bundleMemberText } from "./bundleMemberCopy";
import { savedDetailEntries } from "./detailFacts";
import { hasApplePhotos } from "./productTypes";
import { DetailContent, FittedDetailValue } from "./DetailContent";
import { ProductDetailBlock } from "./ProductDetailBlock";
import {
  defaultProductDetailPlacement,
  isMemoryDetail,
  isMobilePhone,
  mobileDetailEntries,
} from "./mobileDetails";
import {
  deleteDisplayedDetail,
  brochureVisibleDetailEntries,
  brochureDefaultDetailEntries,
  editDisplayedDetail,
} from "./detailRows";
import { useProductImageFit } from "./useProductImageFit";
import {
  conditionerDetailEntries,
  defaultFilledDetail,
} from "./conditionerDetails";
import { applianceDetailEntries, isWashingMachine } from "./applianceDetails";
import { isAirConditioner } from "./productArtwork";
import { tvInchesEmbedded } from "./imageReview";
import { StoresElement } from "./StoresElement";
import { CompactStoresFooter } from "./CompactStoresFooter";
import {
  storePageEntries,
  storePlacement,
  storesPageIsLight,
} from "./storesDesign";
import {
  compactStoresFooterScale,
  hasCompactStoresFooter,
} from "./storesSelection";
import defaultStores from "../../config/stores.defaults.json";
import "../../styles/mobile-details.css";
import "../../styles/brochure-detail-strip.css";
import "../../styles/background-readability.css";
import { visibleImageBounds, televisionScreenBox } from "./screenGeometry";
import {
  televisionAnnotationBaseBox,
  phoneAnnotationBaseBox,
  usesPhoneCornerAnnotation,
} from "./screenAnnotationGeometry";
import { brochureFormatStyle } from "./brochureFormat";
import { BrochureFormatFrame } from "./BrochureFormatFrame";

export const LAYOUTS = BROCHURE_LAYOUTS;

export const money = (value: Product["sale"] | Product["regular"]) =>
  Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: Number(value || 0) % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  });
export const discount = (regular: Product["regular"], sale: Product["sale"]) =>
  Number(regular) > 0 && Number(sale) > 0 && Number(sale) < Number(regular)
    ? Math.round((1 - Number(sale) / Number(regular)) * 100)
    : 0;
export const validSale = (item: Partial<Product>) =>
  Number(item.sale) > 0 && Number(item.regular) > Number(item.sale);
export const confirmedHigherPrice = (item: Partial<Product>) =>
  Number(item.regular) > 0 &&
  Number(item.sale) > Number(item.regular) &&
  item.confirmedAboveRegular === true;
export const validOffer = (item: Partial<Product>) =>
  item.excelSource?.placeholderName &&
  item.excelSource.placeholderName === item.name
    ? false
    : validSale(item) || confirmedHigherPrice(item) || hasExcelOfferPrice(item);
export const DEFAULT_PAYMENT_TEXT = "Paguan deri në 12 këste me 0% interes.";
export const installmentCount = (campaign: Pick<Campaign, "installments">) =>
  Math.min(
    60,
    Math.max(1, Number.parseInt(String(campaign.installments), 10) || 12),
  );
export const paymentTextFor = (
  campaign: Pick<Campaign, "paymentText" | "installments">,
) =>
  campaign.paymentText?.trim() &&
  campaign.paymentText.trim() !== DEFAULT_PAYMENT_TEXT
    ? campaign.paymentText.trim()
    : `Paguan deri në ${installmentCount(campaign)} këste me 0% interes.`;
/** Selectable styles contain only logo-free artwork. Legacy photo remains render-only. */
export const COVER_TEMPLATES = COVER_OPTIONS.map(({ image, ...option }) => ({
  ...option,
  preview: image,
}));
export const PRICE_LOGOS = [
  {
    id: "wordmark",
    label: "haPPy wordmark",
    src: "/api/assets/legacy/assets/happy-price-wordmark.png",
  },
  {
    id: "symbol",
    label: "haPPy with symbol",
    src: "/api/assets/legacy/assets/happy-price-symbol.png",
  },
];

export function priceLogoSource(campaign: Campaign) {
  if (campaign.priceLogo === "custom" && campaign.customPriceLogo)
    return campaign.customPriceLogo;
  return (
    PRICE_LOGOS.find((item) => item.id === campaign.priceLogo)?.src ||
    "/api/assets/legacy/assets/happy-price-symbol.png"
  );
}
export const BROCHURE_ASSETS = [
  { id: "neptun", label: "NEPTUN logo", src: "/api/assets/app/logo" },
  {
    id: "coverBand",
    label: "UUU / hajde! band",
    src: "/api/assets/legacy/assets/uuu-hajde-band.png",
  },
  {
    id: "bestbuy",
    label: "BestBuy Award",
    src: "/api/assets/legacy/assets/bestbuy-qudal-badges.png",
    crop: "left",
  },
  {
    id: "qudal",
    label: "QUDAL medal",
    src: "/api/assets/legacy/assets/bestbuy-qudal-badges.png",
    crop: "right",
  },
  {
    id: "service",
    label: "Elektro-Servis",
    src: "/api/assets/legacy/assets/elektro-servis-kosova.png",
    lightSrc: "/api/assets/legacy/assets/elektro-servis-color.svg",
  },
  {
    id: "balfin",
    label: "BALFIN Group",
    src: "/api/assets/legacy/assets/part-of-balfin-group.png",
    lightSrc: "/api/assets/legacy/assets/part-of-balfin-color.png",
  },
  {
    id: "storesHajde",
    label: "Stores page hajde!",
    src: "/api/assets/legacy/assets/stores-hajde-logo.png",
    lightSrc: "/api/assets/legacy/assets/stores-hajde-color.png",
  },
];

export function brochureAssetSource(
  campaign: Campaign,
  id: string,
  light = storesPageIsLight(campaign),
) {
  const asset = BROCHURE_ASSETS.find((item) => item.id === id);
  const fallback =
    campaign.brandAssets?.[id] ||
    (id === "neptun" && campaign.neptunLogoOption === "framed"
      ? "/api/assets/legacy/assets/neptun-logo-framed.png"
      : "") ||
    (light && asset?.lightSrc) ||
    asset?.src ||
    "";
  return id === "neptun"
    ? logoForBackground(
        campaign,
        "stores",
        pageBackgroundColor(campaign, "stores"),
        fallback,
        light,
      )
    : fallback;
}

export { coverProducts, splitPages } from "./campaignPages";

function Mark({
  campaign,
  dark = false,
}: {
  campaign: Campaign;
  dark?: boolean;
}) {
  const framed =
    campaign.neptunLogoOption === "framed" && !campaign.brandAssets?.neptun;
  return (
    <div
      className={`brochure-mark ${dark ? "dark" : ""} ${framed ? "framed" : ""}`}
    >
      {framed ? (
        <div className="brochure-framed-logo">
          <img
            src={brochureAssetSource(campaign, "neptun")}
            alt="NEPTUN — Jeto më mirë, çdo ditë."
          />
        </div>
      ) : (
        <>
          <img src={brochureAssetSource(campaign, "neptun")} alt="NEPTUN" />
          <em>Jeto më mirë, çdo ditë.</em>
        </>
      )}
    </div>
  );
}

function regionStyle(placement?: Placement): React.CSSProperties | undefined {
  if (!placement) return undefined;
  return {
    transform: `translate(${placement.x || 0}cqw, ${placement.y || 0}cqw)`,
    ...(placement.width ? { width: `${placement.width}%`, flex: "none" } : {}),
    ...(placement.height ? { minHeight: `${placement.height}cqw` } : {}),
  };
}

interface LayoutHandlesProps {
  product: Product;
  kind: string;
  placement?: Placement;
  onChange: NonNullable<ProductEditingProps["onLayoutRegion"]>;
  baseWidth: number;
  widthScope?: "card" | "parent";
  minimumWidth?: number;
  targetSelector?: string;
  toolbar?: boolean;
}
interface LayoutGesture {
  type: string;
  element: HTMLElement;
  card: DOMRect;
  page: DOMRect;
  widthReference: number;
  originalStyle: string;
  originalManual?: string;
  x: number;
  y: number;
  initial: { x: number; y: number; width: number; height: number };
  next?: { x: number; y: number; width: number; height: number };
  limits?: { left: number; right: number; top: number; bottom: number };
}
function LayoutHandles({
  product,
  kind,
  placement,
  onChange,
  baseWidth,
  widthScope = "card",
  minimumWidth = kind === "saving" || kind === "brand" ? 2 : 20,
  targetSelector,
  toolbar = false,
}: LayoutHandlesProps) {
  const gesture = React.useRef<LayoutGesture | null>(null);
  const directRef = React.useRef<HTMLElement | null>(null);
  const suppressClick = React.useRef(false);
  const [dimensions, setDimensions] = React.useState<string | null>(null);
  function begin(
    event: React.PointerEvent<HTMLElement> | PointerEvent,
    type: string,
    directElement?: HTMLElement,
  ) {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    const element =
      directElement ||
      (targetSelector
        ? handle
            .closest(".brochure-product")
            ?.querySelector<HTMLElement>(targetSelector)
        : handle.closest(".cs-region-handles")?.parentElement);
    if (!element) return;
    const cardElement = element.closest(".brochure-product");
    const pageElement = element.closest(".brochure-page");
    if (!cardElement || !pageElement || !element.parentElement) return;
    const card = (
      targetSelector ? element.parentElement : cardElement
    ).getBoundingClientRect();
    const page = pageElement.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const widthReference =
      widthScope === "parent"
        ? element.parentElement.getBoundingClientRect().width
        : card.width;
    const originalStyle = element.style.cssText;
    const originalManual = element.dataset.nameDividerManual;
    const aligned =
      (kind === "details" || kind === "saving") && !placement
        ? materializeProductNameAlignment(
            element,
            page.width,
            rect.width / (element.offsetWidth || rect.width),
          )
        : { x: 0, y: 0 };
    const initial = {
      x: aligned.x,
      y: aligned.y,
      width: (rect.width / widthReference) * 100 || baseWidth,
      height: (rect.height / page.width) * 100,
      ...placement,
    };
    const limits = targetSelector
      ? {
          left: initial.x + ((card.left - rect.left) / page.width) * 100,
          right: initial.x + ((card.right - rect.right) / page.width) * 100,
          top: initial.y + ((card.top - rect.top) / page.width) * 100,
          bottom: initial.y + ((card.bottom - rect.bottom) / page.width) * 100,
        }
      : undefined;
    if ((kind === "details" || kind === "saving") && !placement)
      Object.assign(element.style, regionStyle(initial));
    gesture.current = {
      type,
      element,
      card,
      page,
      widthReference,
      originalStyle,
      originalManual,
      x: event.clientX,
      y: event.clientY,
      initial,
      limits,
    };
    element.closest(".cs-page-preview")?.classList.add("dragging-guides");
  }
  function move(event: { clientX: number; clientY: number }) {
    const action = gesture.current;
    if (!action) return;
    const dx = event.clientX - action.x;
    const dy = event.clientY - action.y;
    if (action.type === "move" && !action.next && Math.hypot(dx, dy) < 3)
      return;
    suppressClick.current = true;
    const next =
      action.type === "move"
        ? {
            ...action.initial,
            x: Math.max(
              action.limits?.left ?? -15,
              Math.min(
                action.limits?.right ?? 15,
                action.initial.x + (dx / action.page.width) * 100,
              ),
            ),
            y: Math.max(
              action.limits?.top ?? -20,
              Math.min(
                action.limits?.bottom ?? 20,
                action.initial.y + (dy / action.page.width) * 100,
              ),
            ),
          }
        : {
            ...action.initial,
            width: Math.max(
              minimumWidth,
              Math.min(
                100,
                action.initial.width + (dx / action.widthReference) * 100,
              ),
            ),
            height: Math.max(
              2,
              Math.min(
                30,
                action.initial.height + (dy / action.page.width) * 100,
              ),
            ),
          };
    action.next = next;
    Object.assign(action.element.style, regionStyle(next));
    setDimensions(
      `${Math.round(next.width)}% × ${Math.round((next.height * action.page.width) / 100)} px`,
    );
  }
  function end(event: { stopPropagation: () => void }, cancelled = false) {
    const action = gesture.current;
    if (!action) return;
    event.stopPropagation();
    action.element
      .closest(".cs-page-preview")
      ?.classList.remove("dragging-guides");
    gesture.current = null;
    setDimensions(null);
    if (cancelled || !action.next) {
      action.element.style.cssText = action.originalStyle;
      if (action.originalManual === undefined)
        delete action.element.dataset.nameDividerManual;
      else action.element.dataset.nameDividerManual = action.originalManual;
    } else if (action.next) onChange(product, kind, action.next);
  }
  React.useEffect(() => {
    const anchor = directRef.current;
    const element = targetSelector
      ? anchor
          ?.closest(".brochure-product")
          ?.querySelector<HTMLElement>(targetSelector)
      : anchor?.closest(".cs-region-handles")?.parentElement;
    if (!element || !onChange) return;
    const down = (event: PointerEvent) => {
      const blocked = (event.target as Element).closest(
        "button,input,textarea,select,.product-detail-block,.cs-region-handles",
      );
      if (event.button !== 0 || (blocked && blocked !== element)) return;
      suppressClick.current = false;
      begin(event, "move", element);
    };
    const up = (event: PointerEvent) => end(event);
    const cancel = (event: PointerEvent) => end(event, true);
    const click = (event: PointerEvent) => {
      if (suppressClick.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }
    };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", cancel);
    element.addEventListener("lostpointercapture", cancel);
    element.addEventListener("click", click, true);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", cancel);
      element.removeEventListener("lostpointercapture", cancel);
      element.removeEventListener("click", click, true);
    };
  });
  if (toolbar)
    return (
      <button
        ref={directRef as React.Ref<HTMLButtonElement>}
        type="button"
        title={t("Move savings badge")}
        aria-label={`${t("Move savings badge")}: ${product.name}`}
        onPointerDown={(event) => begin(event, "move")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={(event) => end(event, true)}
        onLostPointerCapture={(event) => end(event, true)}
        onClick={(event) => event.stopPropagation()}
      >
        ◉
      </button>
    );
  return (
    <span
      className="cs-region-handles"
      ref={directRef as React.Ref<HTMLSpanElement>}
    >
      {dimensions && <span className="cs-region-dimensions">{dimensions}</span>}
      <button
        type="button"
        className="cs-region-handle move"
        title={t("Move within product block")}
        aria-label={`${t("Move")} ${kind}: ${product.name}`}
        onPointerDown={(event) => begin(event, "move")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={(event) => end(event, true)}
        onLostPointerCapture={(event) => end(event, true)}
        onClick={(event) => event.stopPropagation()}
      >
        ✥
      </button>
      <button
        type="button"
        className="cs-region-handle resize"
        title={t("Resize width and height")}
        aria-label={`${t("Resize")} ${kind}: ${product.name}`}
        onPointerDown={(event) => begin(event, "resize")}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={(event) => end(event, true)}
        onLostPointerCapture={(event) => end(event, true)}
        onClick={(event) => event.stopPropagation()}
      >
        ↘
      </button>
    </span>
  );
}

interface PriceProps {
  campaign: Campaign;
  product: Product;
  light?: boolean;
  priceLogo: string;
  installments: number;
  style?: string;
  savingMode: string;
  placement?: Placement;
  onLayoutRegion?: (
    product: Product,
    kind: string,
    placement: Placement,
  ) => void;
  onEditPrice?: (product: Product) => void;
  onEditSavings?: (product: Product) => void;
  layoutBaseWidth?: number;
}

function Price({
  campaign,
  product,
  light,
  priceLogo,
  installments,
  style,
  savingMode,
  placement,
  onLayoutRegion,
  onEditPrice,
  onEditSavings,
  layoutBaseWidth,
}: PriceProps) {
  if (!validOffer(product))
    return (
      <div
        className="brochure-price missing"
        role={onEditPrice ? "button" : undefined}
        tabIndex={onEditPrice ? 0 : undefined}
        onClick={onEditPrice ? () => onEditPrice(product) : undefined}
        onKeyDown={
          onEditPrice
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onEditPrice(product);
                }
              }
            : undefined
        }
      >
        Vendos çmimin e ofertës
      </div>
    );
  const saleText = money(product.sale);
  const redCard = usesRedReferencePrice(product, campaign);
  const blueCard =
    usesBlueReferencePrice(product, campaign) ||
    (!redCard && (style === "card" || style === "compact"));
  const priceSize =
    saleText.length > 5
      ? "extra-compact"
      : saleText.length > 3
        ? "compact"
        : "";
  return (
    <div
      className={`brochure-price ${light ? "light" : ""} ${confirmedHigherPrice(product) ? "higher" : ""} ${priceSize} style-${style} ${redCard ? "red-reference-price" : blueCard ? "reference-price-card" : ""}`}
      style={{
        ...regionStyle(placement),
        ...defaultRegionScale(campaign, "price", placement),
      }}
      role={onEditPrice ? "button" : undefined}
      tabIndex={onEditPrice ? 0 : undefined}
      onClick={onEditPrice ? () => onEditPrice(product) : undefined}
      onKeyDown={
        onEditPrice
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEditPrice(product);
              }
            }
          : undefined
      }
    >
      {redCard ? (
        <RedReferencePrice
          product={product}
          installments={installments}
          showRegular={hasRegularPrice(product)}
          logo={
            campaign.priceLogo && campaign.priceLogo !== "symbol"
              ? priceLogo
              : ""
          }
        />
      ) : blueCard ? (
        <>
          <ReferencePriceCard
            logo={
              campaign.priceLogo && campaign.priceLogo !== "symbol"
                ? priceLogo
                : ""
            }
            product={product}
            installments={installments}
            showRegular={hasRegularPrice(product)}
            savingMode={savingMode}
            onEditSavings={onEditSavings}
            savingStyle={defaultRegionScale(
              campaign,
              "saving",
              product.brochureContentPlacement?.saving,
            )}
          />
          {confirmedHigherPrice(product) && (
            <span className="brochure-price-warning reference-price-increase">
              −
              {Math.round(
                (Number(product.sale) / Number(product.regular) - 1) * 100,
              )}
              %
            </span>
          )}
        </>
      ) : (
        <>
          <div className="brochure-price-top">
            {hasRegularPrice(product) && <del>{money(product.regular)} €</del>}
            {confirmedHigherPrice(product) && (
              <span className="brochure-price-warning">
                −
                {Math.round(
                  (Number(product.sale) / Number(product.regular) - 1) * 100,
                )}
                %
              </span>
            )}
          </div>
          <div className="brochure-price-sale">
            {style !== "minimal" && (
              <span className="brochure-happy-mark">
                <img src={priceLogo} alt="Çmimi haPPy" />
              </span>
            )}
            <strong>
              <span>{saleText}</span>
              <small>€</small>
            </strong>
          </div>
          {style !== "minimal" && (
            <div className="brochure-price-month">
              <span>KËSTI </span>
              {installments} × {money(Number(product.sale) / installments)} €
            </div>
          )}
        </>
      )}
      {onLayoutRegion && (
        <LayoutHandles
          product={product}
          kind="price"
          placement={placement}
          onChange={onLayoutRegion}
          baseWidth={layoutBaseWidth ?? (redCard ? 50 : blueCard ? 56 : 44)}
        />
      )}
    </div>
  );
}

export interface ProductEditingProps {
  onEditImage?: (product: Product) => void;
  onEditDetails?: (product: Product) => void;
  onEditPrice?: (product: Product) => void;
  onEditSavings?: (product: Product) => void;
  onEditScreen?: (product: Product) => void;
  onDropImage?: (product: Product, file: File) => void;
  onMove?: (product: Product) => void;
  onPlaceImage?: (product: Product, placement: Placement) => void;
  onResizeCard?: (
    product: Product,
    size: { width: number; height: number },
  ) => void;
  onLayoutRegion?: (
    product: Product,
    kind: string,
    placement: Placement,
  ) => void;
  onReorderDetails?: (
    product: Product,
    from: number,
    to: number,
    entries: Array<[string, string]>,
  ) => void;
  onProductChange?: (
    product: Product,
    field: keyof Product | Partial<Product>,
    value?: Product[keyof Product],
  ) => void;
  onProductDragStart?: (
    product: Product,
    event: React.DragEvent<HTMLElement>,
  ) => void;
  onProductDragEnd?: React.DragEventHandler<HTMLElement>;
  onProductDragOver?: (
    product: Product,
    event: React.DragEvent<HTMLElement>,
  ) => void;
  onProductDrop?: (
    product: Product,
    event: React.DragEvent<HTMLElement>,
  ) => void;
  draggingCode?: string | null;
  dropCode?: string | null;
}
interface ProductCardProps extends ProductEditingProps {
  campaign: Campaign;
  product: Product;
  light?: boolean;
  hero?: boolean;
  priceLogo: string;
  installments: number;
  layout?: string;
  pageColor?: string;
}
export interface BrochurePageProps extends ProductEditingProps {
  onCampaignAssetChange?: CampaignAssetChange;
  campaign: Campaign;
  settings?: Settings;
  onArtworkChange?: PageArtworkProps["onChange"];
  onArtworkRemove?: PageArtworkProps["onRemove"];
  onCoverElementChange?: CoverElementProps["onChange"];
  onCoverElementHide?: CoverElementProps["onHide"];
  onStoresFooterChange?: CompactStoresFooterProps["onChange"];
  onStoresFooterHide?: CompactStoresFooterProps["onHide"];
  onHideStore?: CompactStoresFooterProps["onHideStore"];
  onStoreChange?: CompactStoresFooterProps["onStoreChange"];
  onContactChange?: CompactStoresFooterProps["onContactChange"];
}
export interface ProductPageProps extends BrochurePageProps {
  page: BrochurePage;
}
interface ImageGesture {
  type: "move" | "scale";
  x: number;
  y: number;
  rect: DOMRect;
  initial: { x: number; y: number; scale: number };
  next?: Placement;
  moved?: boolean;
}
interface CardGesture {
  type: "card";
  x: number;
  y: number;
  width: number;
  height: number;
  initial: { width: number; height: number };
  config: ReturnType<typeof layoutGrid>;
  next?: { width: number; height: number };
}
function ProductCard(props: ProductCardProps) {
  return isLargeBundleOffer(props.product) ? (
    <LargeBundleProductCard {...props} />
  ) : (
    <StandardProductCard {...props} />
  );
}
function LargeBundleProductCard(props: ProductCardProps) {
  const {
    campaign,
    product,
    light,
    priceLogo,
    installments,
    onEditImage,
    onEditDetails,
    onEditPrice,
    onEditSavings,
    onMove,
    onLayoutRegion,
    onProductChange,
    layout,
    onProductDragStart,
    onProductDragEnd,
    onProductDragOver,
    onProductDrop,
    draggingCode,
    dropCode,
    pageColor,
  } = props;
  const photoAreaRef = React.useRef<HTMLDivElement>(null);
  const contentPlacement = product.brochureContentPlacement || {};
  const size = cardSize(product, layout || "classic8");
  const brandLogo = product.brandLogo || brandLogoFor(campaign, product.brand);
  const style = offerStyleFor(campaign, product);
  const savingMode = savingModeFor(campaign, product);
  const changeProduct = onProductChange
    ? (
        field: keyof Product | Partial<Product>,
        value?: Product[keyof Product],
      ) => onProductChange(product, field, value)
    : undefined;
  const savings =
    validSale(product) && !usesBlueReferencePrice(product, campaign) ? (
      <RedReferenceSavings
        product={product}
        savingMode={savingMode}
        className="brochure-red-reference-saving"
        onEditSavings={onEditSavings}
        style={{
          ...regionStyle(contentPlacement.saving),
          ...defaultRegionScale(campaign, "saving", contentPlacement.saving),
        }}
      >
        {onLayoutRegion && (
          <LayoutHandles
            product={product}
            kind="saving"
            placement={contentPlacement.saving}
            onChange={onLayoutRegion}
            baseWidth={8.7}
          />
        )}
      </RedReferenceSavings>
    ) : null;
  return (
    <article
      data-custom-product-font={
        productDesignFor(campaign).typography.font !== "automatic"
          ? "true"
          : undefined
      }
      className={`brochure-product large-bundle-product style-${style} ${draggingCode === String(product.code) ? "cs-product-dragging" : ""} ${dropCode === String(product.code) ? "cs-product-drop-target" : ""}`}
      style={{
        ...productTypographyStyle(campaign),
        gridColumn: `span ${size.width}`,
        gridRow: `span ${size.height}`,
      }}
      onDragOver={(event) => onProductDragOver?.(product, event)}
      onDrop={(event) => onProductDrop?.(product, event)}
      onDragEnd={onProductDragEnd}
    >
      <LargeBundleOffer
        product={product}
        editable={Boolean(onEditImage || onProductChange)}
        onEditMemberImage={
          onEditImage
            ? () => (onEditDetails || onEditImage)(product)
            : undefined
        }
        pageColor={
          pageColor ||
          campaign.productBackgroundColor ||
          (light ? "#f1f2f4" : undefined)
        }
        photoAreaRef={photoAreaRef}
        artwork={
          <ProductArtworkLayer
            campaign={campaign}
            product={product}
            photoAreaRef={photoAreaRef}
            onChange={changeProduct}
            editable={Boolean(changeProduct)}
          />
        }
        brand={
          product.hideBrandLogo ? null : (
            <strong
              className="large-bundle-brand-artwork brochure-brand-mark"
              style={regionStyle(contentPlacement.brand)}
            >
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={product.brand || "NEPTUN"}
                  loading="eager"
                />
              ) : (
                product.brand || "NEPTUN"
              )}
              {onLayoutRegion && (
                <LayoutHandles
                  product={product}
                  kind="brand"
                  placement={contentPlacement.brand}
                  onChange={onLayoutRegion}
                  baseWidth={11}
                  minimumWidth={2}
                />
              )}
            </strong>
          )
        }
        savings={savings}
        price={
          <Price
            campaign={campaign}
            product={product}
            light={light}
            priceLogo={priceLogo}
            installments={installments}
            style={style}
            savingMode={savingMode}
            placement={contentPlacement.price}
            onLayoutRegion={onLayoutRegion}
            onEditPrice={onEditPrice}
            onEditSavings={onEditSavings}
            layoutBaseWidth={20.5}
          />
        }
        renderMember={(member) => {
          const key = `bundle-detail-${member.code}`;
          const lines = bundleMemberText(product, member).split("\n");
          return (
            <div
              className="large-bundle-member-details"
              style={{
                ...regionStyle(contentPlacement[key]),
                fontSize: `calc(1.05cqw * var(--large-bundle-member-font-scale, 1) * ${Math.min(1, 5 / Math.max(1, lines.length))})`,
              }}
            >
              {lines.map((line, index) => (
                <span
                  key={index}
                  className={
                    index === 0
                      ? "large-bundle-member-name"
                      : /garanc|warrant/i.test(line)
                        ? "large-bundle-member-warranty"
                        : "large-bundle-member-line"
                  }
                >
                  {line}
                </span>
              ))}
              {onEditDetails && (
                <button
                  type="button"
                  data-export-hide="true"
                  className="cs-brochure-edit-specs"
                  aria-label={`Edit set member details: ${member.name}`}
                  onClick={() => onEditDetails(product)}
                >
                  ✎
                </button>
              )}
              {onLayoutRegion && (
                <LayoutHandles
                  product={product}
                  kind={String(key)}
                  placement={contentPlacement[key]}
                  onChange={onLayoutRegion}
                  baseWidth={100}
                  widthScope="parent"
                />
              )}
            </div>
          );
        }}
        controls={
          <div className="large-bundle-edit-controls" data-export-hide="true">
            {onEditDetails && (
              <button type="button" onClick={() => onEditDetails(product)}>
                Edit set
              </button>
            )}
            {onEditImage && (
              <button
                type="button"
                onClick={() => (onEditDetails || onEditImage)(product)}
              >
                Replace images
              </button>
            )}
            {onMove && (
              <button type="button" onClick={() => onMove(product)}>
                Move offer
              </button>
            )}
            {onProductDragStart && (
              <button
                type="button"
                draggable
                aria-label={`Drag set: ${product.name}`}
                onDragStart={(event) => onProductDragStart(product, event)}
              >
                ⠿
              </button>
            )}
          </div>
        }
      />
      <ApplePhotoClearance photoAreaRef={photoAreaRef} />
    </article>
  );
}

function StandardProductCard({
  campaign,
  product,
  light = false,
  hero = false,
  priceLogo,
  installments,
  onEditImage,
  onEditDetails,
  onEditPrice,
  onEditSavings,
  onEditScreen,
  onDropImage,
  onMove,
  onPlaceImage,
  onResizeCard,
  onLayoutRegion,
  onReorderDetails,
  onProductChange,
  layout,
  onProductDragStart,
  onProductDragEnd,
  onProductDragOver,
  onProductDrop,
  draggingCode,
  dropCode,
}: ProductCardProps) {
  const style = offerStyleFor(campaign, product);
  const savingMode = savingModeFor(campaign, product);
  const colors = productColors(product);
  const importedSpecs = Array.isArray(product.brochureDetails);
  const allSpecs = importedSpecs
    ? savedDetailEntries(product) || []
    : (isMobilePhone(product) && !isAppleProduct(product)
        ? mobileDetailEntries(product, { includeFallback: false })
        : isAirConditioner(product)
          ? conditionerDetailEntries(product)
          : isWashingMachine(product)
            ? applianceDetailEntries(product)
            : Object.entries(displaySpecs(product))
      ).filter(
        ([key, value]) => value && !/garanc|warrant|ngjyr|colou?r/i.test(key),
      );
  const warranty = product.hideWarranty
    ? null
    : warrantyDuration(product.warranty);
  const redReference = usesRedReferencePrice(product, campaign);
  const blueReference = usesBlueReferencePrice(product, campaign);
  const screenInches = tvScreenInches(product);
  const otherInches = otherScreenInches(product);
  const phoneCorner = usesPhoneCornerAnnotation(product);
  const inches = screenInches || otherInches;
  const detailPlacement = defaultProductDetailPlacement(product, campaign);
  const productDesign = productDesignFor(campaign);
  const photoBase = defaultPhotoPlacement(
    product,
    campaign,
    detailPlacement,
    hero,
  );
  // Apple's orange price uses HTML, but its current design still uses the
  // same compact warranty/detail row shown in the brochure reference.
  const referenceStrip = redReference || style === "current";
  const warrantyInStrip = referenceStrip && detailPlacement !== "left";
  const preferredSpecs = importedSpecs
    ? allSpecs
    : brochureDefaultDetailEntries(product, allSpecs);
  const specs =
    detailPlacement === "left"
      ? allSpecs
      : brochureVisibleDetailEntries(preferredSpecs, {
          columns: layoutGrid(layout || "grid6portrait").columns,
          warrantyInStrip: Boolean(warranty && warrantyInStrip),
        });
  const changeProduct = onProductChange
    ? (
        field: keyof Product | Partial<Product>,
        value?: Product[keyof Product],
      ) => onProductChange(product, field, value)
    : undefined;
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const imageRef = React.useRef<HTMLImageElement>(null);
  const priceRowRef = React.useRef<HTMLDivElement>(null);
  const contentPlacement = product.brochureContentPlacement || {};
  const gesture = React.useRef<ImageGesture | CardGesture | null>(null);
  const [imageReady, setImageReady] = React.useState(0);
  const [placement, setPlacement] = React.useState(
    product.brochureImagePlacement || null,
  );
  const [size, setSize] = React.useState(
    cardSize(product, layout || "classic8"),
  );
  React.useEffect(
    () => setPlacement(product.brochureImagePlacement || null),
    [product.brochureImagePlacement],
  );
  React.useEffect(
    () => setSize(cardSize(product, layout || "classic8")),
    [product.brochureCardSize, layout],
  );
  const fittedImagePlacement = useProductImageFit({
    imageRef,
    wrapRef,
    source: product.image,
    ready: imageReady,
    placement: placement
      ? { ...photoBase, ...placement }
      : productDesign.photo.mode === "custom"
        ? photoBase
        : null,
    base: photoBase,
  });
  function beginImageGesture(
    event:
      | React.PointerEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLImageElement>,
    type: "move" | "scale",
  ) {
    if (!onPlaceImage) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    gesture.current = {
      type,
      x: event.clientX,
      y: event.clientY,
      rect,
      initial: {
        x: fittedImagePlacement.x ?? 50,
        y: fittedImagePlacement.y ?? 50,
        scale: fittedImagePlacement.scale ?? 1,
      },
    };
    event.currentTarget
      .closest(".cs-page-preview")
      ?.classList.add("dragging-guides");
  }
  function moveImageGesture(event: { clientX: number; clientY: number }) {
    const action = gesture.current;
    if (!action || action.type === "card") return;
    const dx = event.clientX - action.x;
    const dy = event.clientY - action.y;
    if (Math.hypot(dx, dy) < 4 && !action.moved) return;
    action.moved = true;
    action.next =
      action.type === "move"
        ? {
            ...action.initial,
            x: Math.max(
              0,
              Math.min(100, action.initial.x + (dx / action.rect.width) * 100),
            ),
            y: Math.max(
              0,
              Math.min(100, action.initial.y + (dy / action.rect.height) * 100),
            ),
          }
        : {
            ...action.initial,
            scale: Math.max(
              0.2,
              Math.min(
                2.5,
                action.initial.scale +
                  (dx + dy) / Math.max(action.rect.width, action.rect.height),
              ),
            ),
          };
    setPlacement(action.next);
  }
  function endImageGesture(
    event:
      | React.PointerEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLImageElement>,
    cancelled = false,
  ) {
    if (!gesture.current || gesture.current.type === "card") return;
    const next = gesture.current.next;
    const type = gesture.current.type;
    event.stopPropagation();
    event.currentTarget
      .closest(".cs-page-preview")
      ?.classList.remove("dragging-guides");
    gesture.current = null;
    if (cancelled) setPlacement(product.brochureImagePlacement || null);
    else if (next) onPlaceImage?.(product, next);
    else if (type === "move" && onEditImage) onEditImage(product);
  }
  function beginCardGesture(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const grid = event.currentTarget.closest(".brochure-products");
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const config = layoutGrid(layout || "classic8");
    gesture.current = {
      type: "card",
      x: event.clientX,
      y: event.clientY,
      width: rect.width / config.columns,
      height: rect.height / config.rows,
      initial: size,
      config,
    };
    event.currentTarget
      .closest(".cs-page-preview")
      ?.classList.add("dragging-guides");
  }
  function moveCardGesture(event: { clientX: number; clientY: number }) {
    const action = gesture.current;
    if (action?.type !== "card") return;
    action.next = {
      width: Math.max(
        1,
        Math.min(
          action.config.columns,
          action.initial.width +
            Math.round((event.clientX - action.x) / action.width),
        ),
      ),
      height: Math.max(
        1,
        Math.min(
          action.config.rows,
          action.initial.height +
            Math.round((event.clientY - action.y) / action.height),
        ),
      ),
    };
    setSize(action.next);
  }
  function endCardGesture(
    event: React.PointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) {
    if (gesture.current?.type !== "card") return;
    const next = gesture.current.next;
    event.stopPropagation();
    gesture.current = null;
    event.currentTarget
      .closest(".cs-page-preview")
      ?.classList.remove("dragging-guides");
    if (cancelled) setSize(cardSize(product, layout || "classic8"));
    else if (next) onResizeCard?.(product, next);
  }
  const [screenCorner, writeScreenCorner] = React.useState<{
    top: number;
    left?: number;
    right?: number;
    width?: number;
    height?: number;
    guides?: boolean;
  } | null>(null);
  const [screenOverlay, writeScreenOverlay] =
    React.useState<React.CSSProperties | null>(null);
  const setScreenCorner = React.useCallback((next: typeof screenCorner) =>
    writeScreenCorner((current) => stableMeasurement(current, next)), []);
  const setScreenOverlay = React.useCallback((next: React.CSSProperties | null) =>
    writeScreenOverlay((current) => stableMeasurement(current, next)), []);
  React.useLayoutEffect(() => {
    if (
      !product.screenArtwork?.image ||
      !wrapRef.current ||
      !imageRef.current
    ) {
      setScreenOverlay(null);
      return;
    }
    const update = () => {
      const area = wrapRef.current;
      const wrap = area?.getBoundingClientRect();
      const image = imageRef.current;
      if (!area || !wrap || !image?.naturalWidth || !image?.naturalHeight)
        return;
      const visualScale = wrap.width / (area.offsetWidth || wrap.width) || 1;
      const rect = image.getBoundingClientRect();
      const width = Math.min(
        rect.width,
        (rect.height * image.naturalWidth) / image.naturalHeight,
      );
      const height = Math.min(
        rect.height,
        (rect.width * image.naturalHeight) / image.naturalWidth,
      );
      const left = rect.left - wrap.left + (rect.width - width) / 2;
      const top = rect.top - wrap.top + (rect.height - height) / 2;
      const b = televisionScreenBox(product, image);
      setScreenOverlay({
        left: (left + b.x * width) / visualScale,
        top: (top + b.y * height) / visualScale,
        width: (b.width * width) / visualScale,
        height: (b.height * height) / visualScale,
      });
    };
    const area = wrapRef.current;
    const card = area.closest(".brochure-product");
    area.addEventListener("brochure-photo-clearance", update);
    card?.addEventListener("brochure-photo-clearance", update);
    const observer = new ResizeObserver(update);
    observer.observe(wrapRef.current);
    observer.observe(imageRef.current);
    if (imageRef.current.complete) update();
    return () => {
      observer.disconnect();
      area.removeEventListener("brochure-photo-clearance", update);
      card?.removeEventListener("brochure-photo-clearance", update);
    };
  }, [
    product.screenArtwork,
    product.image,
    imageReady,
    placement,
    fittedImagePlacement,
  ]);
  React.useLayoutEffect(() => {
    if (!inches || !wrapRef.current || !imageRef.current) return;
    const update = () => {
      const area = wrapRef.current;
      const wrap = area?.getBoundingClientRect();
      const image = imageRef.current;
      if (!area || !wrap || !image?.naturalWidth || !image?.naturalHeight)
        return;
      const visualScale = wrap.width / (area.offsetWidth || wrap.width) || 1;
      const box = image.getBoundingClientRect();
      const contentWidth = Math.min(
        box.width,
        (box.height * image.naturalWidth) / image.naturalHeight,
      );
      const contentHeight = Math.min(
        box.height,
        (box.width * image.naturalHeight) / image.naturalWidth,
      );
      if (screenInches) {
        const screen = televisionScreenBox(product, image);
        setScreenCorner(
          televisionAnnotationBaseBox({
            left:
              (box.left -
                wrap.left +
                (box.width - contentWidth) / 2 +
                screen.x * contentWidth) /
              visualScale,
            top:
              (box.top -
                wrap.top +
                (box.height - contentHeight) / 2 +
                screen.y * contentHeight) /
              visualScale,
            width: (contentWidth * screen.width) / visualScale,
            height: (contentHeight * screen.height) / visualScale,
          }),
        );
        return;
      }
      const visible = visibleImageBounds(image);
      const contentTop =
        box.top -
        wrap.top +
        (box.height - contentHeight) / 2 +
        (visible?.top || 0) * contentHeight;
      const contentRight =
        wrap.right -
        box.right +
        (box.width - contentWidth) / 2 +
        (visible ? 1 - visible.right : 0) * contentWidth;
      if (phoneCorner) {
        setScreenCorner(
          phoneAnnotationBaseBox({
            left:
              (box.left -
                wrap.left +
                (box.width - contentWidth) / 2 +
                (visible?.left || 0) * contentWidth) /
              visualScale,
            top: contentTop / visualScale,
            width:
              (contentWidth * (visible ? visible.right - visible.left : 1)) /
              visualScale,
            height:
              (contentHeight * (visible ? visible.bottom - visible.top : 1)) /
              visualScale,
          }),
        );
        return;
      }
      const pageWidth =
        area.closest(".brochure-page")?.getBoundingClientRect().width ||
        wrap.width;
      const labelHeight = pageWidth * 0.044;
      setScreenCorner({
        top: Math.max(1, contentTop - labelHeight) / visualScale,
        right: Math.max(1, contentRight) / visualScale,
        guides: contentTop >= labelHeight && wrap.width >= pageWidth * 0.22,
      });
    };
    const area = wrapRef.current;
    const card = area.closest(".brochure-product");
    area.addEventListener("brochure-photo-clearance", update);
    card?.addEventListener("brochure-photo-clearance", update);
    const observer = new ResizeObserver(update);
    observer.observe(wrapRef.current);
    if (imageRef.current.complete) update();
    return () => {
      observer.disconnect();
      area.removeEventListener("brochure-photo-clearance", update);
      card?.removeEventListener("brochure-photo-clearance", update);
    };
  }, [
    inches,
    screenInches,
    phoneCorner,
    product.screenArtwork,
    product.image,
    imageReady,
    placement,
    fittedImagePlacement,
  ]);
  return (
    <article
      className={`brochure-product style-${style} ${redReference ? "red-reference-offer" : ""} ${blueReference ? "blue-reference-offer" : ""} ${detailPlacement === "left" ? "details-left" : ""} ${isAirConditioner(product) ? "conditioner-offer" : ""} ${hero ? "hero" : ""} ${screenInches ? "has-tv-inch-ribbon" : otherInches ? "has-screen-annotation" : ""} ${draggingCode === String(product.code) ? "cs-product-dragging" : ""} ${dropCode === String(product.code) ? "cs-product-drop-target" : ""}`}
      onDragOver={(event) => {
        if (
          [...event.dataTransfer.types].includes(
            "application/x-brochure-details-placement",
          )
        )
          event.preventDefault();
        else onProductDragOver?.(product, event);
      }}
      onDrop={(event) => {
        if (
          [...event.dataTransfer.types].includes(
            "application/x-brochure-details-placement",
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.classList.remove("cs-details-dragging");
        } else onProductDrop?.(product, event);
      }}
      onDragEnd={onProductDragEnd}
      data-custom-product-font={
        productDesign.typography.font !== "automatic" ? "true" : undefined
      }
      data-product-divider-hidden={
        !productDesign.divider.visible ? "true" : undefined
      }
      data-default-layout={
        redReference && !Object.values(contentPlacement).some(Boolean)
          ? "true"
          : undefined
      }
      style={{
        position: "relative",
        ...productTypographyStyle(campaign),
        ...(onResizeCard || product.brochureCardSize
          ? { gridColumn: `span ${size.width}`, gridRow: `span ${size.height}` }
          : {}),
        "--detail-strip-columns": Math.max(
          1,
          specs.length + Number(Boolean(warranty && warrantyInStrip)),
        ),
      }}
    >
      {onEditImage && (
        <MissingCatalogNotice
          product={product}
          variant="badge"
          onOpenEditor={() => onEditImage(product)}
        />
      )}
      <div
        className={`brochure-product-image-wrap ${product.showImage === false ? "brochure-photo-hidden" : ""}`}
        ref={wrapRef}
        onDragEnter={
          onDropImage
            ? (event) => {
                if ([...event.dataTransfer.types].includes("Files"))
                  event.currentTarget.classList.add("cs-image-drop-active");
              }
            : undefined
        }
        onDragLeave={
          onDropImage
            ? (event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget instanceof Node
                      ? event.relatedTarget
                      : null,
                  )
                )
                  event.currentTarget.classList.remove("cs-image-drop-active");
              }
            : undefined
        }
        onDragOver={
          onDropImage
            ? (event) => {
                if ([...event.dataTransfer.types].includes("Files")) {
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "copy";
                }
              }
            : undefined
        }
        onDrop={
          onDropImage
            ? (event) => {
                event.currentTarget.classList.remove("cs-image-drop-active");
                const file = [...event.dataTransfer.files][0];
                if (file) {
                  event.preventDefault();
                  event.stopPropagation();
                  onDropImage(product, file);
                }
              }
            : undefined
        }
      >
        {!isBundleOffer(product) &&
          (product.image ? (
            <div
              className="apple-photo-clearance-primary"
              data-apple-photo-clearance={
                hasApplePhotos(product) ? "true" : undefined
              }
            >
              <img
                className="brochure-product-image"
                ref={imageRef}
                src={product.image}
                alt={product.name}
                loading="eager"
                referrerPolicy="no-referrer"
                onLoad={() => {
                  setImageReady((value) => value + 1);
                }}
                style={{
                  left: `${fittedImagePlacement.x}%`,
                  top: `${fittedImagePlacement.y}%`,
                  transform: `translate(-50%, -50%) scale(${fittedImagePlacement.scale})`,
                }}
                onPointerDown={
                  onPlaceImage
                    ? (event) => beginImageGesture(event, "move")
                    : undefined
                }
                onPointerMove={onPlaceImage ? moveImageGesture : undefined}
                onPointerUp={onPlaceImage ? endImageGesture : undefined}
                onPointerCancel={
                  onPlaceImage
                    ? (event) => endImageGesture(event, true)
                    : undefined
                }
                onLostPointerCapture={
                  onPlaceImage
                    ? (event) => endImageGesture(event, true)
                    : undefined
                }
              />
            </div>
          ) : onEditImage && product.catalogMissing ? (
            <MissingCatalogNotice
              product={product}
              variant="placeholder"
              onUploadImage={() => onEditImage(product)}
            />
          ) : (
            <div className="brochure-image-empty">Foto e produktit</div>
          ))}
        {product.screenArtwork?.image && screenOverlay && (
          <img
            className="brochure-screen-image"
            src={product.screenArtwork.image}
            alt=""
            aria-hidden="true"
            style={{
              ...screenOverlay,
              objectFit: product.screenArtwork.fit || "cover",
            }}
          />
        )}
        {inches &&
          (!screenInches ||
            product.screenArtwork?.image ||
            !tvInchesEmbedded(product)) && (
            <EditableScreenAnnotation
              product={product}
              onChange={changeProduct}
              inches={inches}
              type={
                screenInches ? "television" : phoneCorner ? "phone" : "other"
              }
              className="brochure-inch-label"
              style={
                screenCorner
                  ? screenInches || phoneCorner
                    ? { ...screenCorner }
                    : { top: screenCorner.top, right: screenCorner.right }
                  : { visibility: "hidden" }
              }
            />
          )}
        {validSale(product) && usesRedReferencePrice(product, campaign) && (
          <RedReferenceSavings
            product={product}
            savingMode={savingMode}
            className="brochure-red-reference-saving"
            onEditSavings={onEditSavings}
            style={{
              ...regionStyle(contentPlacement.saving),
              ...defaultRegionScale(
                campaign,
                "saving",
                contentPlacement.saving,
              ),
            }}
          />
        )}
        {validSale(product) &&
          !usesRedReferencePrice(product, campaign) &&
          !usesBlueReferencePrice(product, campaign) &&
          (style === "current" || style === "minimal") && (
            <span
              className="brochure-saving"
              style={{
                ...regionStyle(contentPlacement.saving),
                ...defaultRegionScale(
                  campaign,
                  "saving",
                  contentPlacement.saving,
                ),
              }}
              aria-label={
                savingMode === "percentage"
                  ? `Zbritje ${discount(product.regular, product.sale)} për qind`
                  : `Kurseni ${money(Number(product.regular) - Number(product.sale))} euro`
              }
              role={onEditSavings ? "button" : undefined}
              tabIndex={onEditSavings ? 0 : undefined}
              onClick={onEditSavings ? () => onEditSavings(product) : undefined}
              onKeyDown={
                onEditSavings
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onEditSavings(product);
                      }
                    }
                  : undefined
              }
            >
              <i>{savingMode === "percentage" ? "ZBRITJE" : "KURSENI"}</i>
              <b className="brochure-saving-amount">
                {savingMode === "percentage"
                  ? discount(product.regular, product.sale)
                  : money(Number(product.regular) - Number(product.sale))}
                <small>{savingMode === "percentage" ? "%" : "€"}</small>
              </b>
            </span>
          )}
        {onEditImage && (
          <button
            type="button"
            className="cs-brochure-edit-image"
            onClick={() => onEditImage(product)}
            aria-label={`${t("Change image")}: ${product.name}`}
          >
            <span>{t("Change image")}</span>
          </button>
        )}
        {onPlaceImage && product.image && !isBundleOffer(product) && (
          <button
            type="button"
            className="cs-image-scale-handle"
            title={t("Drag to resize image")}
            aria-label={`${t("Resize image")}: ${product.name}`}
            onPointerDown={(event) => beginImageGesture(event, "scale")}
            onPointerMove={moveImageGesture}
            onPointerUp={endImageGesture}
            onPointerCancel={(event) => endImageGesture(event, true)}
            onLostPointerCapture={(event) => endImageGesture(event, true)}
          >
            ↘
          </button>
        )}
        {(onEditImage || onEditDetails || onMove) && (
          <div
            className="cs-product-edit-pins"
            aria-label={`${t("Edit product")}: ${product.name}`}
          >
            {onLayoutRegion &&
              validSale(product) &&
              (usesRedReferencePrice(product, campaign) ||
                (!usesBlueReferencePrice(product, campaign) &&
                  (style === "current" || style === "minimal"))) && (
                <LayoutHandles
                  product={product}
                  kind="saving"
                  placement={contentPlacement.saving}
                  onChange={onLayoutRegion}
                  baseWidth={24}
                  targetSelector={
                    usesRedReferencePrice(product, campaign)
                      ? ".brochure-red-reference-saving"
                      : ".brochure-saving"
                  }
                  toolbar
                />
              )}
            {onEditImage && (
              <button
                type="button"
                onClick={() => onEditImage(product)}
                title={t("Change image")}
                aria-label={`${t("Change image")}: ${product.name}`}
              >
                ▧
              </button>
            )}
            {onEditScreen && hasEditableScreen(product) && (
              <button
                type="button"
                onClick={() => onEditScreen(product)}
                title={t("Image inside the screen")}
                aria-label={`${t("Image inside the screen")}: ${product.name}`}
              >
                ▣
              </button>
            )}
            {onEditDetails && (
              <button
                type="button"
                onClick={() => onEditDetails(product)}
                title={t("Edit product details")}
                aria-label={`${t("Edit product details")}: ${product.name}`}
              >
                ✎
              </button>
            )}
            {onMove && (
              <button
                type="button"
                onClick={() => onMove(product)}
                title={t("Move product to another page")}
                aria-label={`${t("Move product to another page")}: ${product.name}`}
              >
                ↔
              </button>
            )}
            {onProductDragStart && (
              <span
                draggable="true"
                role="button"
                tabIndex={0}
                onDragStart={(event) => onProductDragStart(product, event)}
                onKeyDown={(event) => {
                  if ((event.key === "Enter" || event.key === " ") && onMove) {
                    event.preventDefault();
                    onMove(product);
                  }
                }}
                title={t("Drag to reorder or move to a page")}
                aria-label={`${t("Drag to reorder or move to a page")}: ${product.name}`}
              >
                ⠿
              </span>
            )}
          </div>
        )}
      </div>
      <ApplePhotoClearance photoAreaRef={wrapRef} />
      <DefaultSavingsClearance
        key={`${redReference}-${blueReference}-${validSale(product)}`}
        photoAreaRef={wrapRef}
        enabled={!contentPlacement.saving && !hasApplePhotos(product)}
      />
      <div className="brochure-product-bottom" ref={priceRowRef}>
        <div
          className="brochure-product-copy"
          style={regionStyle(contentPlacement.details)}
        >
          {colors.length > 0 && product.hideColors !== true && (
            <ProductDetailBlock
              product={product}
              detailKey="__colors"
              className="brochure-colors"
              onChange={changeProduct}
              onRemove={
                changeProduct
                  ? () => changeProduct("hideColors", true)
                  : undefined
              }
              aria-label={`Ngjyrat: ${colors.map((color) => color.name).join(", ")}`}
            >
              {colors.map((color) => (
                <i
                  key={color.name}
                  className="brochure-color-dot"
                  title={color.name}
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </ProductDetailBlock>
          )}
          <ProductBrandArtwork
            campaign={campaign}
            product={product}
            onChange={changeProduct}
          />
          <span data-product-name="true">{product.name}</span>
          <small className="brochure-product-code">{product.code}</small>
          {warranty && !warrantyInStrip && (
            <ProductDetailBlock
              product={product}
              detailKey="__warranty"
              className="brochure-warranty-line"
              onChange={changeProduct}
              onRemove={
                changeProduct
                  ? () => changeProduct("hideWarranty", true)
                  : undefined
              }
            >
              {warranty.count} {warranty.unit} GARANCION
            </ProductDetailBlock>
          )}
          {onEditDetails && (
            <button
              type="button"
              className="cs-brochure-edit-details"
              onClick={() => onEditDetails(product)}
              aria-label={`${t("Edit product details")}: ${product.name}`}
            >
              <span>{t("Edit details")}</span>
            </button>
          )}
          {onLayoutRegion && (
            <LayoutHandles
              product={product}
              kind="details"
              placement={contentPlacement.details}
              onChange={onLayoutRegion}
              baseWidth={56}
            />
          )}
        </div>
        <Price
          campaign={campaign}
          product={product}
          light={light}
          priceLogo={priceLogo}
          installments={installments}
          style={style}
          savingMode={savingMode}
          placement={contentPlacement.price}
          onLayoutRegion={onLayoutRegion}
          onEditPrice={onEditPrice}
          onEditSavings={onEditSavings}
        />
        <ProductNameDivider
          rowRef={priceRowRef}
          alignName={!contentPlacement.details}
          defaults={productDesign.divider}
        />
      </div>
      {(specs.length > 0 || (warranty && warrantyInStrip)) && (
        <div
          className={`brochure-specs ${importedSpecs ? "brochure-imported-specs" : ""}`}
          style={regionStyle(contentPlacement.specs)}
          data-detail-layout={detailPlacement === "left" ? "left" : "strip"}
        >
          {specs.map(([key, value], index) => (
            <ProductDetailBlock
              key={key}
              product={product}
              detailKey={key}
              className={`${isMemoryDetail(key, value) ? "detail-memory" : ""} ${defaultDetailFill(campaign, referenceStrip && defaultFilledDetail(product, key, value, index)) ? "detail-filled" : ""}`}
              onChange={changeProduct}
              draggable={Boolean(onReorderDetails)}
              onDragStart={
                onReorderDetails
                  ? (event: {
                      stopPropagation: () => void;
                      dataTransfer: {
                        setData: (arg0: string, arg1: string) => void;
                      };
                    }) => {
                      event.stopPropagation();
                      event.dataTransfer.setData(
                        "application/x-brochure-detail",
                        `${product.code}:${allSpecs.findIndex(([sourceKey]) => sourceKey === key)}`,
                      );
                    }
                  : undefined
              }
              onDragOver={
                onReorderDetails
                  ? (event) => {
                      if (
                        [...event.dataTransfer.types].includes(
                          "application/x-brochure-detail",
                        )
                      )
                        event.preventDefault();
                    }
                  : undefined
              }
              onDrop={
                onReorderDetails
                  ? (event) => {
                      const source = event.dataTransfer.getData(
                        "application/x-brochure-detail",
                      );
                      if (source.startsWith(`${product.code}:`)) {
                        event.preventDefault();
                        event.stopPropagation();
                        onReorderDetails(
                          product,
                          Number(source.slice(String(product.code).length + 1)),
                          allSpecs.findIndex(
                            ([sourceKey]) => sourceKey === key,
                          ),
                          allSpecs,
                        );
                      }
                    }
                  : undefined
              }
              onEdit={onEditDetails ? () => onEditDetails(product) : undefined}
              onRemove={
                changeProduct
                  ? () => {
                      const changes = deleteDisplayedDetail(
                        product,
                        allSpecs,
                        allSpecs.findIndex(([sourceKey]) => sourceKey === key),
                      );
                      changeProduct(changes);
                    }
                  : undefined
              }
              editText={importedSpecs ? String(value) : `${key}: ${value}`}
              onSaveText={
                changeProduct
                  ? (text) =>
                      changeProduct(
                        editDisplayedDetail(
                          product,
                          allSpecs,
                          allSpecs.findIndex(
                            ([sourceKey]) => sourceKey === key,
                          ),
                          text,
                        ),
                      )
                  : undefined
              }
            >
              <DetailContent
                product={product}
                label={key}
                value={value}
                imported={importedSpecs}
                layout={detailPlacement === "left" ? "left" : "strip"}
                reference={
                  blueReference ? "blue" : redReference ? "red" : "legacy"
                }
              />
            </ProductDetailBlock>
          ))}
          {warranty && warrantyInStrip && (
            <ProductDetailBlock
              product={product}
              detailKey="__warranty"
              onChange={changeProduct}
              onRemove={
                changeProduct
                  ? () => changeProduct("hideWarranty", true)
                  : undefined
              }
              className="brochure-warranty"
              aria-label={`${warranty.count} ${warranty.unit.toLowerCase()} garancion`}
            >
              <FittedDetailValue
                text={warranty.count}
                className="detail-warranty-count"
              />
              <small>
                <span className="brochure-warranty-unit">{warranty.unit}</span>
                <span className="brochure-warranty-label">GARANCION</span>
              </small>
            </ProductDetailBlock>
          )}
          {changeProduct && (
            <button
              type="button"
              className="cs-details-placement-handle"
              draggable
              data-export-hide="true"
              onDragStart={(event) => {
                event.stopPropagation();
                event.dataTransfer.setData(
                  "application/x-brochure-details-placement",
                  String(product.code),
                );
                event.currentTarget
                  .closest(".brochure-product")
                  ?.classList.add("cs-details-dragging");
              }}
              onDragEnd={(event) =>
                event.currentTarget
                  .closest(".brochure-product")
                  ?.classList.remove("cs-details-dragging")
              }
              aria-label={`Drag all details: ${product.name}`}
            >
              ⠿ Details
            </button>
          )}
          {onEditDetails && (
            <button
              type="button"
              className="cs-brochure-edit-specs"
              onClick={() => onEditDetails(product)}
              aria-label={`${t("Edit product details")}: ${product.name}`}
            >
              <span>{t("Edit details")}</span>
            </button>
          )}
          {onLayoutRegion && (
            <LayoutHandles
              product={product}
              kind="specs"
              placement={contentPlacement.specs}
              onChange={onLayoutRegion}
              baseWidth={100}
            />
          )}
        </div>
      )}
      <ProductArtworkLayer
        campaign={campaign}
        product={product}
        imageRef={imageRef}
        photoAreaRef={wrapRef}
        onChange={changeProduct}
        editable={Boolean(changeProduct)}
      />
      {changeProduct &&
        ["left", "bottom"].map((target) => (
          <div
            key={target}
            className={`cs-details-drop-zone ${target}`}
            data-export-hide="true"
            onDragOver={(event) => {
              if (
                [...event.dataTransfer.types].includes(
                  "application/x-brochure-details-placement",
                )
              ) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onDrop={(event) => {
              if (
                event.dataTransfer.getData(
                  "application/x-brochure-details-placement",
                ) !== String(product.code)
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              changeProduct("detailPlacement", target);
              event.currentTarget
                .closest(".brochure-product")
                ?.classList.remove("cs-details-dragging");
            }}
          >
            {target === "left" ? "Details beside photo" : "Details below photo"}
          </div>
        ))}
      {onResizeCard && (
        <button
          type="button"
          className="cs-card-resize-handle"
          title={t("Drag to resize product block")}
          aria-label={`${t("Resize product block")}: ${product.name}`}
          onPointerDown={beginCardGesture}
          onPointerMove={moveCardGesture}
          onPointerUp={endCardGesture}
          onPointerCancel={(event) => endCardGesture(event, true)}
          onLostPointerCapture={(event) => endCardGesture(event, true)}
        >
          ↘
        </button>
      )}
      {onResizeCard && (
        <span className="cs-card-size-label">
          {size.width} × {size.height}
        </span>
      )}
    </article>
  );
}

function LastPageWithStores({
  campaign,
  page,
  settings = defaultStores,
  onStoresFooterChange,
  onStoresFooterHide,
  onHideStore,
  onStoreChange,
  onContactChange,
  children,
}: BrochurePageProps & { page?: BrochurePage; children: React.ReactNode }) {
  const lastProductIndex = splitPages(campaign).at(-1)?.index ?? -1;
  if (!hasCompactStoresFooter(campaign, page?.index ?? -1, lastProductIndex))
    return children;
  const kind = page ? "product" : "cover";
  const color = pageBackgroundContrastColor(campaign, kind, page);
  const readability = pageBackgroundReadability(campaign, kind, page);
  const light = readability.light;
  const fill =
    pageBackgroundFill(campaign, kind, page) || (light ? "#f1f2f4" : "#1c4075");
  const scale = compactStoresFooterScale(campaign);
  return (
    <section
      className={`brochure-page brochure-last-page-shell has-background-readability ${readability.needsSurface ? "needs-contrast-surfaces" : ""} ${light ? "light" : "blue"}`}
      style={{
        ...brochureFormatStyle(campaign),
        ...backgroundReadabilityStyle(readability, color),
        background: fill,
      }}
    >
      <div
        className="brochure-last-page-scaled"
        style={{ left: `${(1 - scale) * 50}%`, transform: `scale(${scale})` }}
      >
        {children}
      </div>
      <CompactStoresFooter
        campaign={campaign}
        settings={settings}
        sources={{
          neptun: logoForBackground(
            campaign,
            "footer",
            pageBackgroundColor(campaign, kind, page),
            campaign.brandAssets?.neptun ||
              (campaign.neptunLogoOption === "framed"
                ? "/api/assets/legacy/assets/neptun-logo-framed.png"
                : "/api/assets/legacy/assets/neptun-cover-logo.png"),
            light,
          ),
          balfin: brochureAssetSource(campaign, "balfin", true),
          service: brochureAssetSource(campaign, "service", true),
        }}
        onChange={onStoresFooterChange}
        onHide={onStoresFooterHide}
        onHideStore={onHideStore}
        onStoreChange={onStoreChange}
        onContactChange={onContactChange}
      />
    </section>
  );
}

export function CoverPage(props: BrochurePageProps) {
  return (
    <BrochureFormatFrame campaign={props.campaign} kind="cover">
      <LastPageWithStores {...props}>
        <CoverPageContent {...props} />
      </LastPageWithStores>
    </BrochureFormatFrame>
  );
}

function CoverPageContent({
  campaign,
  onEditImage,
  onEditDetails,
  onEditPrice,
  onEditSavings,
  onEditScreen,
  onDropImage,
  onMove,
  onPlaceImage,
  onLayoutRegion,
  onReorderDetails,
  onProductChange,
  onArtworkChange,
  onArtworkRemove,
  onCampaignAssetChange,
  onCoverElementChange,
  onCoverElementHide,
  onProductDragStart,
  onProductDragEnd,
  onProductDragOver,
  onProductDrop,
  draggingCode,
  dropCode,
}: BrochurePageProps) {
  const products = coverProducts(campaign);
  const backgroundColor =
    pageBackgroundContrastColor(campaign, "cover") || "#1c4075";
  const backgroundImage = pageBackgroundImage(campaign, "cover");
  const backgroundFill =
    (backgroundImage
      ? pageBackgroundColor(campaign, "cover")
      : pageBackgroundFill(campaign, "cover")) || "#1c4075";
  const coverLogo = logoForBackground(
    campaign,
    "cover",
    backgroundColor,
    campaign.coverLogoSource || "",
  );
  const priceLogo = priceLogoSource(campaign);
  const template =
    campaign.coverTemplate === "photo"
      ? "photo"
      : campaign.coverTemplate === "blueRibbon" || COVER_TEMPLATES.some((item) => item.id === campaign.coverTemplate)
        ? campaign.coverTemplate
        : "blueClean";
  const coverArt =
    campaign.coverImage ||
    (template === "photo"
      ? "/api/assets/legacy/assets/default-cover-hero.png"
      : "");
  const readability =
    coverArt && !backgroundImage
      ? backgroundReadability({
          kind: "image",
          color: backgroundColor,
          image: coverArt,
        })
      : pageBackgroundReadability(campaign, "cover");
  const dark = !readability.light;
  const headline =
    campaign.coverHeadline == null ? campaign.name : campaign.coverHeadline;
  const tagline = campaign.tagline ?? "";
  const headlineSize = Math.max(
    3.7,
    6.8 - Math.max(0, headline.length - 21) * 0.09,
  );
  const taglineSize = Math.max(
    2.15,
    3.0 - Math.max(0, tagline.length - 33) * 0.035,
  );
  return (
    <section
      className={`brochure-page brochure-cover cover-editable-elements ${campaign.showCoverBand === true ? "cover-with-uuu" : ""} has-background-readability ${readability.needsSurface ? "needs-contrast-surfaces" : ""} ${dark ? "blue" : "light"} cover-template-${template} ${coverArt ? "has-cover-art" : ""} ${backgroundColor ? "has-custom-background" : ""}`}
      style={{
        ...brochureFormatStyle(campaign),
        ...backgroundReadabilityStyle(readability, backgroundColor),
        ...(backgroundFill ? { background: backgroundFill } : {}),
      }}
    >
      {backgroundImage && (
        <img
          className="brochure-page-background-image"
          src={backgroundImage}
          alt=""
          aria-hidden="true"
        />
      )}
      {coverArt && (
        <div
          className="cover-campaign-art"
          style={{
            backgroundImage: `linear-gradient(180deg,rgba(9,36,72,.20),rgba(9,36,72,.07) 62%,rgba(9,36,72,.35)),url(${coverArt})`,
          }}
          aria-hidden="true"
        />
      )}
      <PageArtwork
        campaign={campaign}
        pageKey="cover"
        onChange={onArtworkChange}
        onRemove={onArtworkRemove}
      />
      <div className="cover-photo" aria-hidden="true" />
      {campaign.showCoverGradient === true && (
        <CoverElement
          campaign={campaign}
          kind="gradient"
          onChange={onCoverElementChange}
          onHide={onCoverElementHide}
          style={{
            background: coverGradientFill(campaign),
            opacity: campaign.coverOverlayGradient?.opacity ?? 0.85,
          }}
        />
      )}
      {campaign.showCoverLogo !== false && (
        <CoverElement
          campaign={campaign}
          kind="logo"
          onChange={onCoverElementChange}
          onHide={onCoverElementHide}
        >
          {coverLogo ? (
            (campaign.coverLogoStyle === "framed" &&
              coverLogo === campaign.coverLogoSource) ||
            coverLogo === "/api/assets/legacy/assets/neptun-logo-framed.png" ? (
              <div className="brochure-framed-logo">
                <img src={coverLogo} alt="NEPTUN" draggable={false} />
              </div>
            ) : (
              <img src={coverLogo} alt="NEPTUN" draggable={false} />
            )
          ) : (
            <Mark campaign={campaign} />
          )}
        </CoverElement>
      )}
      {campaign.showCoverHeadline !== false && headline && (
        <CoverElement
          campaign={campaign}
          kind="headline"
          onChange={onCoverElementChange}
          onHide={onCoverElementHide}
        >
          {headline.trim().toLocaleLowerCase() !==
            campaign.type?.trim().toLocaleLowerCase() && (
            <span style={{ color: coverTextColor(campaign, "coverTypeColor") }}>
              {campaign.type}
            </span>
          )}
          <h1
            style={{
              fontSize: `${headlineSize}cqw`,
              color: coverTextColor(campaign, "coverHeadlineColor"),
            }}
          >
            {headline}
          </h1>
        </CoverElement>
      )}
      {campaign.showCoverBand === true && (
        <CoverElement
          campaign={campaign}
          kind="band"
          className={
            !campaign.coverElementPlacements?.band &&
            brochureAssetSource(campaign, "coverBand") ===
              "/api/assets/legacy/assets/uuu-hajde-band.png"
              ? "cover-band-default-artwork"
              : ""
          }
          onChange={onCoverElementChange}
          onHide={onCoverElementHide}
        >
          <img
            src={brochureAssetSource(campaign, "coverBand")}
            alt="UUU / hajde!"
            draggable={false}
          />
        </CoverElement>
      )}
      {coverMessageVisible(campaign) && tagline && (
        <CoverElement
          campaign={campaign}
          kind="message"
          className={
            campaign.showCoverBand === true &&
            !campaign.coverElementPlacements?.message
              ? "cover-band-default-message"
              : ""
          }
          onChange={onCoverElementChange}
          onHide={onCoverElementHide}
        >
          <p
            style={{
              fontSize: `${taglineSize}cqw`,
              color: coverTextColor(campaign, "coverMessageColor"),
            }}
          >
            {tagline}
          </p>
        </CoverElement>
      )}
      <div className="cover-content">
        <div
          className={`cover-feature-products free-cover-products ${products.length === 1 ? "single" : products.length === 3 ? "triple" : ""}`}
        >
          {products.map((product: Product, productIndex: number) => (
            <CoverElement
              key={product.code}
              campaign={campaign}
              kind={`product-${product.code}`}
              className={`cover-product-frame ${isFeaturedCoverProduct(campaign, product.code, productIndex, products.length) ? "cover-featured-product" : ""}`}
              defaultPlacement={coverProductPlacement(
                campaign,
                productIndex,
                products.length,
              )}
              onChange={onCoverElementChange}
            >
              <ProductCard
                key={product.code}
                campaign={campaign}
                product={product}
                hero={isFeaturedCoverProduct(
                  campaign,
                  product.code,
                  productIndex,
                  products.length,
                )}
                light={!dark}
                pageColor={backgroundColor}
                priceLogo={priceLogo}
                installments={installmentCount(campaign)}
                onEditImage={onEditImage}
                onEditDetails={onEditDetails}
                onEditPrice={onEditPrice}
                onEditSavings={onEditSavings}
                onEditScreen={onEditScreen}
                onDropImage={onDropImage}
                onMove={onMove}
                onPlaceImage={onPlaceImage}
                onLayoutRegion={onLayoutRegion}
                onReorderDetails={onReorderDetails}
                onProductChange={onProductChange}
                onProductDragStart={onProductDragStart}
                onProductDragEnd={onProductDragEnd}
                onProductDragOver={onProductDragOver}
                onProductDrop={onProductDrop}
                draggingCode={draggingCode}
                dropCode={dropCode}
              />
            </CoverElement>
          ))}
          {products.length === 0 && (
            <p className="cover-no-products">
              Shto produkte për të parë ofertat në kopertinë.
            </p>
          )}
        </div>
      </div>
      <BrochureFooter campaign={campaign} onChange={onCampaignAssetChange} />
    </section>
  );
}

function formatDates(start?: string, end?: string) {
  if (!start && !end) return "Datat e fushatës";
  const months = [
    "janar",
    "shkurt",
    "mars",
    "prill",
    "maj",
    "qershor",
    "korrik",
    "gusht",
    "shtator",
    "tetor",
    "nëntor",
    "dhjetor",
  ];
  const fmt = (date?: string) => {
    if (!date) return "—";
    const [year, month, day] = date.split("-").map(Number);
    return `${day} ${months[(month ?? 0) - 1] || ""} ${year}`;
  };
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

export function ProductPage(props: ProductPageProps) {
  return (
    <BrochureFormatFrame
      campaign={props.campaign}
      page={props.page}
      kind="product"
    >
      <LastPageWithStores {...props}>
        <ProductPageContent {...props} />
      </LastPageWithStores>
    </BrochureFormatFrame>
  );
}

function ProductPageContent({
  campaign,
  page,
  onEditImage,
  onEditDetails,
  onEditPrice,
  onEditSavings,
  onEditScreen,
  onDropImage,
  onMove,
  onPlaceImage,
  onResizeCard,
  onLayoutRegion,
  onReorderDetails,
  onProductChange,
  onArtworkChange,
  onArtworkRemove,
  onCampaignAssetChange,
  onProductDragStart,
  onProductDragEnd,
  onProductDragOver,
  onProductDrop,
  draggingCode,
  dropCode,
}: ProductPageProps) {
  const backgroundColor = pageBackgroundContrastColor(
    campaign,
    "product",
    page,
  );
  const backgroundImage = pageBackgroundImage(campaign, "product", page);
  const backgroundFill = backgroundImage
    ? pageBackgroundColor(campaign, "product", page)
    : pageBackgroundFill(campaign, "product", page);
  const readability = pageBackgroundReadability(campaign, "product", page);
  const light = readability.light;
  const priceLogo = priceLogoSource(campaign);
  return (
    <section
      className={`brochure-page brochure-interior has-background-readability ${readability.needsSurface ? "needs-contrast-surfaces" : ""} ${light ? "light" : "blue"} ${page.showFooter ? "with-footer" : ""} layout-${page.layout} count-${page.products.length} ${page.products.some((item) => item.brochureCardSize) ? "custom-card-layout" : ""}`}
      style={{
        ...brochureFormatStyle(campaign),
        ...backgroundReadabilityStyle(readability, backgroundColor),
        ...(backgroundFill
          ? { "--brochure-page-background": backgroundFill }
          : {}),
      }}
    >
      {backgroundImage && (
        <img
          className="brochure-page-background-image"
          src={backgroundImage}
          alt=""
          aria-hidden="true"
        />
      )}
      {page.image && (
        <div
          className="brochure-page-art"
          style={{ backgroundImage: `url(${page.image})` }}
        />
      )}
      <PageArtwork
        campaign={campaign}
        pageKey={`product-${page.index}`}
        onChange={onArtworkChange}
        onRemove={onArtworkRemove}
      />
      <div
        className="brochure-products"
        style={{
          gridTemplateRows: `repeat(${occupiedProductRows(page.products, page.layout)}, minmax(0, 1fr))`,
          ...productGridStyle(campaign, page.spacing),
        }}
      >
        {page.products.map((product: Product) => (
          <ProductCard
            key={product.code}
            campaign={campaign}
            product={product}
            light={light}
            pageColor={backgroundColor}
            priceLogo={priceLogo}
            installments={installmentCount(campaign)}
            hero={page.layout === "feature" && product === page.products[0]}
            onEditImage={onEditImage}
            onEditDetails={onEditDetails}
            onEditPrice={onEditPrice}
            onEditSavings={onEditSavings}
            onEditScreen={onEditScreen}
            onDropImage={onDropImage}
            onMove={onMove}
            onPlaceImage={onPlaceImage}
            onResizeCard={onResizeCard}
            onLayoutRegion={onLayoutRegion}
            onReorderDetails={onReorderDetails}
            onProductChange={onProductChange}
            layout={page.layout}
            onProductDragStart={onProductDragStart}
            onProductDragEnd={onProductDragEnd}
            onProductDragOver={onProductDragOver}
            onProductDrop={onProductDrop}
            draggingCode={draggingCode}
            dropCode={dropCode}
          />
        ))}
      </div>
      {page.showFooter && (
        <div className="brochure-interior-brand-footer">
          <CampaignAssetArtwork
            campaign={campaign}
            assetKey={`product-${page.index}-neptun`}
            label="NEPTUN footer logo"
            onChange={onCampaignAssetChange}
            defaultWidth="12cqw"
          >
            <NeptunWordmark
              dark={!light}
              campaign={campaign}
              backgroundColor={pageBackgroundColor(campaign, "product", page)}
            />
          </CampaignAssetArtwork>
          <span className="brochure-interior-footer-line" />
          {page.showFooterPageNumber && <b>{page.index + 2}</b>}
        </div>
      )}
    </section>
  );
}

export interface StoresPageProps extends BrochurePageProps {
  onPlaceStore?: StoresElementProps["onChange"];
  onReorderStore?: (from: number, to: number) => void;
  onElementChange?: StoresElementProps["onChange"];
  onElementHide?: StoresElementProps["onHide"];
}

export function StoresPage({
  settings = defaultStores,
  campaign,
  onPlaceStore,
  onReorderStore: _onReorderStore,
  onArtworkChange,
  onArtworkRemove,
  onCampaignAssetChange,
  onElementChange,
  onElementHide,
  onHideStore,
  onStoreChange,
  onContactChange,
}: StoresPageProps) {
  const readability = pageBackgroundReadability(campaign, "stores");
  const light = readability.light;
  const backgroundImage = pageBackgroundImage(campaign, "stores");
  const backgroundFill =
    (backgroundImage
      ? pageBackgroundColor(campaign, "stores")
      : pageBackgroundFill(campaign, "stores")) || (light ? "#e4e4e4" : "");
  const stores = campaign.storesSnapshot?.stores || settings.stores || [];
  const entries = storePageEntries(campaign, stores);
  const contact = visibleContact(
    campaign,
    campaign.storesSnapshot?.contact || settings.contact || {},
  );
  const element = (
    kind: string,
    placement: Box,
    children: React.ReactNode,
    className = "",
  ) => (
    <StoresElement
      campaign={campaign}
      kind={kind}
      onChange={onElementChange}
      onHide={onElementHide}
      defaultPlacement={placement}
      className={className}
    >
      {children}
    </StoresElement>
  );
  const editableText = (
    value: string | undefined,
    save?: (value: string) => void,
  ) => ({
    contentEditable: Boolean(save),
    suppressContentEditableWarning: true,
    onBlur: save
      ? (event: React.FocusEvent<HTMLElement>) => {
          const text = (event.currentTarget.textContent || "").trim();
          if (text !== String(value || "")) save(text);
        }
      : undefined,
    onKeyDown: save
      ? (event: {
          key: string;
          preventDefault: () => void;
          currentTarget: { blur: () => void };
        }) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }
      : undefined,
  });
  return (
    <BrochureFormatFrame campaign={campaign} kind="stores">
      <section
        className={`brochure-page brochure-stores stores-reference-page stores-element-canvas has-background-readability ${readability.needsSurface ? "needs-contrast-surfaces" : ""} ${light ? "custom-light stores-gray" : "stores-blue"}`}
        style={{
          ...brochureFormatStyle(campaign),
          ...backgroundReadabilityStyle(
            readability,
            pageBackgroundContrastColor(campaign, "stores"),
          ),
          ...(backgroundFill ? { background: backgroundFill } : {}),
        }}
      >
        {backgroundImage && (
          <img
            className="brochure-page-background-image"
            src={backgroundImage}
            alt=""
            aria-hidden="true"
          />
        )}
        <PageArtwork
          campaign={campaign}
          pageKey="stores"
          onChange={onArtworkChange}
          onRemove={onArtworkRemove}
        />
        {element(
          "heading",
          { x: 0, y: 2.7, width: 41, height: 4 },
          <span className="stores-heading">DYQANET</span>,
        )}
        {element(
          "hajde",
          { x: light ? 30 : 16, y: 7.6, width: light ? 40 : 48, height: 9.4 },
          <div className="stores-hajde">
            <img
              src={brochureAssetSource(campaign, "storesHajde", light)}
              alt="hajde!"
              draggable={false}
            />
          </div>,
        )}
        {!light &&
          element(
            "awards",
            { x: 70, y: 9, width: 23, height: 7.5 },
            <AwardBadges
              campaign={campaign}
              onChange={onCampaignAssetChange}
              scope="stores"
            />,
          )}
        {element(
          "locations",
          { x: 3.4, y: 17.7, width: 93.2, height: 68.4 },
          <div className="stores-grid stores-element-canvas">
            {entries.map(({ key, store, online }, index) => {
              const lines = online
                ? {
                    city: campaign.storeFields?.city === false ? "" : "ONLINE",
                    name: "",
                    address:
                      campaign.storeFields?.address === false
                        ? ""
                        : contact.onlineEmail,
                    phone:
                      campaign.storeFields?.phone === false
                        ? ""
                        : contact.onlinePhone,
                  }
                : visibleStoreLines(campaign, store);
              const save = (field: "city" | "name" | "address" | "phone") =>
                online
                  ? onContactChange &&
                    ((value: string) =>
                      onContactChange(
                        field === "address" ? "onlineEmail" : "onlinePhone",
                        value,
                      ))
                  : onStoreChange &&
                    ((value: string) => onStoreChange(key, field, value));
              return (
                <StoresElement
                  key={key}
                  campaign={campaign}
                  scope="store"
                  kind={String(key)}
                  onChange={onPlaceStore}
                  onHide={onHideStore}
                  defaultPlacement={storePlacement(
                    campaign,
                    key,
                    index,
                    entries.length,
                  )}
                  className="stores-card-wrapper"
                >
                  <div
                    className={`store-spot ${online ? "stores-online-spot" : ""}`}
                  >
                    {campaign.storeFields?.icon !== false &&
                      iconVisible(
                        campaign,
                        online ? "onlineCart" : "storePin",
                      ) &&
                      (!online || !light) && (
                        <span className="store-pin">
                          {iconSource(
                            campaign,
                            online ? "onlineCart" : "storePin",
                          ) ? (
                            <img
                              src={iconSource(
                                campaign,
                                online ? "onlineCart" : "storePin",
                              )}
                              alt=""
                              draggable={false}
                            />
                          ) : online ? (
                            <svg viewBox="0 0 64 64" aria-hidden="true">
                              <path
                                d="M5 8h8l7 35h30l7-25H17M21 49h31M27 57a3 3 0 1 0 0 .1M48 57a3 3 0 1 0 0 .1"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 48 64" aria-hidden="true">
                              <path
                                fillRule="evenodd"
                                d="M24 1C10.7 1 0 11.7 0 25c0 17.1 24 38 24 38s24-20.9 24-38C48 11.7 37.3 1 24 1Zm0 34a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z"
                              />
                            </svg>
                          )}
                        </span>
                      )}
                    <strong
                      {...(!online
                        ? editableText(lines.city, save("city"))
                        : {})}
                    >
                      {lines.city}
                    </strong>
                    {lines.name && (
                      <b {...editableText(lines.name, save("name"))}>
                        {lines.name}
                      </b>
                    )}
                    {lines.address && (
                      <span {...editableText(lines.address, save("address"))}>
                        {lines.address}
                      </span>
                    )}
                    <span {...editableText(lines.phone, save("phone"))}>
                      {lines.phone}
                    </span>
                  </div>
                </StoresElement>
              );
            })}
          </div>,
        )}
        {element(
          "disclaimer",
          { x: 3.4, y: 87, width: 56.8, height: 7.7 },
          <div className="stores-disclaimer">
            {campaign.contactVisibility?.membershipDisclaimer !== false && (
              <strong className="stores-members-note">
                {contact.membershipDisclaimer ||
                  "*çmimet haPPy vlejnë vetëm për anëtarët e programit haPPy"}
              </strong>
            )}
            <p
              {...editableText(
                contact.disclaimer,
                onContactChange &&
                  ((value: string) => onContactChange("disclaimer", value)),
              )}
            >
              {contact.disclaimer}
            </p>
          </div>,
        )}
        {element(
          "service",
          { x: 61.4, y: 87, width: 14.8, height: 7.7 },
          <div className="stores-service">
            <img
              src={brochureAssetSource(campaign, "service", light)}
              alt="Elektro-Servis Kosova"
              draggable={false}
            />
            <span
              {...editableText(
                contact.serviceAddress,
                onContactChange &&
                  ((value: string) => onContactChange("serviceAddress", value)),
              )}
            >
              {contact.serviceAddress}
            </span>
            <span
              {...editableText(
                contact.servicePhones,
                onContactChange &&
                  ((value: string) => onContactChange("servicePhones", value)),
              )}
            >
              {contact.servicePhones}
            </span>
          </div>,
        )}
        {campaign.contactVisibility?.group !== false &&
          element(
            "balfin",
            { x: 78.5, y: 86.9, width: 18.2, height: 7.2 },
            <div className="stores-balfin">
              <img
                src={brochureAssetSource(campaign, "balfin", light)}
                alt="Part of BALFIN Group"
                draggable={false}
              />
            </div>,
          )}
        {element(
          "social",
          { x: 3.4, y: 96, width: 93.2, height: 2.6 },
          <div className="stores-social">
            {["email", "website", "facebook", "instagram"]
              .filter((field) => campaign.contactVisibility?.[field] !== false)
              .map((field) => (
                <span key={field}>
                  <SocialIcon type={field} campaign={campaign} />
                  <span
                    {...editableText(
                      contact[field],
                      onContactChange &&
                        ((value: string) => onContactChange(field, value)),
                    )}
                  >
                    {contact[field]}
                  </span>
                </span>
              ))}
          </div>,
        )}
      </section>
    </BrochureFormatFrame>
  );
}

function BrochureFooter({
  campaign,
  onChange,
}: {
  campaign: Campaign;
  onChange?: CampaignAssetChange;
}) {
  return (
    <div
      className="brochure-offer-footer"
      style={{ color: coverTextColor(campaign, "coverFooterColor") }}
    >
      <span className="brochure-footer-dates">
        Vlen {formatDates(campaign.startDate, campaign.endDate)}
      </span>
      <span className="brochure-footer-payment">
        {paymentTextFor(campaign)}
      </span>
      <AwardBadges campaign={campaign} onChange={onChange} />
    </div>
  );
}

function AwardBadges({
  campaign,
  onChange,
  scope = "cover",
}: {
  campaign: Campaign;
  onChange?: CampaignAssetChange;
  scope?: string;
}) {
  const artwork = (
    id: string,
    label: string,
    children: React.ReactNode,
    width = "4cqw",
  ) => (
    <CampaignAssetArtwork
      campaign={campaign}
      assetKey={`${scope}-${id}`}
      label={label}
      onChange={onChange}
      defaultWidth={width}
    >
      {children}
    </CampaignAssetArtwork>
  );
  return (
    <div className="brochure-awards">
      {campaign.brandAssets?.awards
        ? artwork(
            "awards",
            "BestBuy Award and QUDAL Quality Medal",
            <img
              className="award-combined"
              src={campaign.brandAssets.awards}
              alt="BestBuy Award and QUDAL Quality Medal"
            />,
            "10cqw",
          )
        : ["bestbuy", "qudal"].map((id) => (
            <React.Fragment key={id}>
              {artwork(
                id,
                id === "bestbuy" ? "BestBuy Award" : "QUDAL Quality Medal",
                campaign.brandAssets?.[id] ? (
                  <img
                    className="award-badge"
                    src={campaign.brandAssets[id]}
                    alt={
                      id === "bestbuy" ? "BestBuy Award" : "QUDAL Quality Medal"
                    }
                  />
                ) : (
                  <span
                    className={`award-badge award-default ${id}`}
                    role="img"
                    aria-label={
                      id === "bestbuy" ? "BestBuy Award" : "QUDAL Quality Medal"
                    }
                  />
                ),
              )}
            </React.Fragment>
          ))}
    </div>
  );
}

function SocialIcon({
  type,
  campaign,
}: {
  type: string;
  campaign: Partial<Campaign>;
}) {
  if (!iconVisible(campaign, type)) return null;
  const custom = iconSource(campaign, type);
  if (custom)
    return (
      <img
        className="stores-custom-social-icon"
        src={custom}
        alt=""
        draggable={false}
      />
    );
  if (type === "email")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m3 6 9 7 9-7" />
      </svg>
    );
  if (type === "website")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2c3 3 4 6 4 10s-1 7-4 10c-3-3-4-6-4-10s1-7 4-10Z" />
      </svg>
    );
  if (type === "facebook")
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="3" />
        <path d="M14.5 21v-8h2.5l.4-3h-2.9V8.4c0-.9.3-1.4 1.5-1.4h1.5V4.3A20 20 0 0 0 15.2 4c-2.5 0-4.2 1.5-4.2 4.3V10H8.5v3H11v8" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle className="social-icon-dot" cx="18" cy="6" r="1" />
    </svg>
  );
}
