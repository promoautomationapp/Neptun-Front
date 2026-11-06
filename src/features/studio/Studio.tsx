import {
  readWorkspaceRoute,
  workspaceRouteUrl,
  sameWorkspaceRoute,
  type WorkspaceRoute,
} from "../../app/workspaceRoute";
import { confirmDialog } from "../../components/dialogs";
import { ActionMenu } from "../brochure/ActionMenu";
import { BrochurePreview } from "../brochure/BrochurePreview";
import { BrochureImportNotices } from "../brochure/BrochureImportNotices";
import { BrochurePageNavigator } from "../brochure/BrochurePageNavigator";
import { BrochurePagination } from "../brochure/BrochurePagination";
import { BrochureZoomControls } from "../brochure/BrochureZoomControls";
import "../../styles/brochure-editor-chrome.css";
import "../../styles/brochure-mobile-toolbar.css";
import { FooterDesignControls } from "../brochure/FooterDesignControls";
import { EditorIcon } from "../brochure/EditorIcon";
import { CanvasTools, type CanvasTool } from "../brochure/CanvasTools";
import {
  PageDecorationControls,
  type PageDecorationChange,
} from "../brochure/PageDecorations";
import { isOctoberBrochure } from "../brochure/octoberDesign";
import "../../styles/brochure-ux.css";
import { FileUpload } from "../../components/FileUpload";
import { SocialStudio } from "../social/SocialStudio";
import { NotificationBell } from "../notifications/NotificationBell";
import { AppearanceToggle } from "../appearance/Appearance";
import { useLiveSession } from "../auth/useLiveSession";
import {
  catalogPathAllowed,
  effectiveWorkspaceAccess,
} from "../auth/workspaceAccess";
import { productCategoryPath } from "../settings/categoryHierarchy";
import type { WorkspaceNotification } from "../notifications/notifications.api";
import { StudioPageBoundary } from "./StudioPageBoundary";
import { NavIcon } from "./NavIcon";
import { catalogFacets } from "../products/products.api";
import { useCampaignClock } from "../campaigns/campaignValidity";
import { CampaignEditorHeader } from "../brochure/CampaignEditorHeader";
import { CampaignStatus } from "../campaigns/CampaignStatus";
import { SearchableSelect } from "../../components/SearchableSelect";
import {
  ReusableImages,
  droppedReusableImage,
  REUSABLE_IMAGE_TYPE,
} from "../settings/ReusableImages";
import type { LogoAsset } from "../settings/settings.schema";
import {
  emptyCampaignFilters,
  filterCampaigns,
  normalizeCampaignFilters,
  type CampaignFilters,
} from "../campaigns/campaignFilters";
import { CampaignActivityStatus } from "../brochure/CampaignActivityStatus";
import {
  applyPreparedProductPhoto,
  createProductImagePreparationQueue,
  currentProductPhotoTarget,
  productPhotoSelectionKey,
  productImagePreparationTargets,
  retainPreparedProductPhoto,
  type ProductPhotoTarget,
  type ProductPhotoPreparationOptions,
  type PhotoOutcome,
} from "../brochure/productImagePreparationQueue";
import { PhotoPreparationModal } from "../brochure/PhotoPreparationModal";
import {
  reusableProductPhotos,
  SavedPhotoLookupError,
} from "../brochure/reusableProductPhotos";
import {
  CatalogNavigator,
  defaultCatalogSelection,
  filterCatalog,
} from "../products/CatalogNavigator";
import { PromoAutomationCredit } from "../../shared/PromoAutomationCredit";
import { CatalogRefreshControl } from "../products/CatalogRefreshControl";
import {
  PageSettingsTabs,
  PageSettingsGroup as SettingsGroup,
} from "../brochure/PageSettingsTabs";
import { CoverImageControls } from "../brochure/CoverImageControls";
import { CoverLogoPicker } from "../brochure/CoverLogoPicker";
import { ImagePickerProvider } from "../brochure/ImagePickerProvider";
import { loadCatalog } from "../products/catalog-loader";
import { screenArtworkForPhotoChange } from "../brochure/screenGeometry";
import { BrochureIconControls } from "../settings/BrochureIconControls";
import type {
  Artwork,
  Campaign,
  CampaignMutator,
  Gradient,
  JsonValue,
  PageLayout,
  Placement,
  Product,
  Store,
} from "../../domain/models";
import type { AiProposal } from "../brochure/AiReview";
import type { DetailEntry } from "../brochure/detailFacts";
import {
  missingImageTargets,
  startMissingImageSearch,
  finishMissingImageSearch,
  findMissingProductImages,
} from "../ai/missing-product-images";
import type { MissingImageTarget } from "../ai/missing-product-images";
import { MissingCatalogNotice } from "../brochure/MissingCatalogNotice";
import {
  catalogWithExcelProducts,
  campaignContainingExcelProduct,
  hasRegularPrice,
} from "../brochure/missingCatalog";
import { startCampaignAiReview } from "../ai/campaign-review";
import type { CampaignReviewTask } from "../ai/campaign-review";
import { getLanguage, setLanguage, t } from "../brochure/i18n";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FilterDate, FilterSelect } from "../brochure/FilterControls";
import {
  AiReview,
  applyAiProposals,
  recordTextReview,
} from "../brochure/AiReview";
import { BrochureExport } from "../brochure/BrochureExport";
import { ReviewPanel } from "../brochure/ReviewPanel";
import { BrochureComments } from "../brochure/BrochureComments";
import {
  brochurePageCount,
  includesOnlineStore,
  includesStoresPage,
  includesStoresFooter,
  compactStoresFooterHeight,
  selectedStoreIndexes,
} from "../brochure/storesSelection";
import { OfferStyleControls } from "../brochure/OfferStyleControls";
import { CategorySavingsControls } from "../brochure/CategorySavingsControls";
import { ProductImageEditor } from "../brochure/ProductImageEditor";
import { ProductPhotoRepair } from "../brochure/ProductPhotoRepair";
import { ScreenImageEditor } from "../brochure/ScreenImageEditor";
import {
  applyTvWallpaper,
  campaignTelevisions,
  campaignTelevisionPhoto,
  campaignTelevisionPhotos,
} from "../brochure/tvWallpaper";
import {
  normalizeScreenPhotoSource,
  screenPhotoSource,
} from "../brochure/screenGeometry";
import { BrochureFormatPicker } from "../brochure/BrochureFormatPicker";
import {
  brochureExportGeometry,
  brochureFormatSelection,
  resolveBrochureFormat,
} from "../brochure/brochureFormat";
import { ProductPriceEditor } from "../brochure/ProductPriceEditor";
import { BackgroundPicker } from "../brochure/BackgroundPicker";
import { BrochureGridPicker } from "../brochure/BrochureGridPicker";
import { PageLayersControls } from "../brochure/PageLayersControls";
import { CoverDesignControls } from "../brochure/CoverDesignControls";
import { ImageUploadButton } from "../brochure/ImageUploadButton";
import {
  pageBackgroundColor,
  pageBackgroundGradient,
  pageBackgroundImage,
  productImageBackgroundContext,
} from "../brochure/pageBackground";
import {
  discardPreparedProductPhoto,
  imageBackgroundSignature,
  IMAGE_PREPARATION_REVISION,
} from "../brochure/imageReview";
import { BrandLogoManager } from "../brochure/BrandLogoManager";
import { loadPreparedBrandLogos } from "../brochure/brandLogos";
import {
  mergeCampaignSnapshots,
  confirmMissingCampaign,
} from "../brochure/mergeCampaignSnapshots";
import { useCampaignEditHistory } from "../brochure/useCampaignEditHistory";
import { brochureColorVariantCampaign } from "../brochure/campaignColorVariants";
import { mergeBrochureImportProducts } from "../brochure/brochureReimport";
import { CampaignHistoryControls } from "../brochure/CampaignHistoryControls";
import {
  placeProductOnPage,
  reorderProducts,
} from "../brochure/productPlacement";
import { moveStore, orderedStoreIndexes } from "../brochure/brochureLayout";
import {
  applyProductPageLayout,
  materializeProductPages,
  reviewCommentsForLayout,
} from "../brochure/campaignPages";
import {
  applyCoverProductPlacement,
  repairCoverProductLayout,
} from "../brochure/coverElements";
import {
  storeDisplayChanges,
  withoutFooterStorePlacements,
} from "../brochure/storesDesign";
import { reorderDisplayedDetails } from "../brochure/detailRows";
import { savedDetailEntries } from "../brochure/detailFacts";
import { searchProducts, searchProductCodes } from "../brochure/productSearch";
import { SettingsPage } from "../settings/SettingsPage";
import { UsersPage } from "../users/UsersPage";
import { InsightsPage } from "../insights/InsightsPage";
import { ActivityPage } from "../activity/ActivityPage";
import {
  PhotoPreparationProgress,
  type PhotoProgressItem,
} from "../brochure/PhotoPreparationProgress";
import { ProfilePage } from "../users/ProfilePage";
import { canManageUsers } from "../auth/auth.api";
import { SidebarAccount } from "./SidebarAccount";
import { resolveSettings } from "../settings/settings.schema";
import type { SettingsSnapshot } from "../settings/settings.api";
import type { Settings } from "../../domain/models";
import {
  getSettingsSnapshot,
  getCampaigns,
  getCampaign,
  hasAcknowledgedCampaign,
  getMembers,
  getSession,
  hasPendingSaves,
  login,
  logout,
  removeCampaign,
  restoreCampaign,
  reviewCampaign,
  saveCampaign,
} from "../brochure/teamStorage";
import { downloadJson, normalize, readImage } from "../brochure/utils";
import {
  BROCHURE_ASSETS,
  brochureAssetSource,
  COVER_TEMPLATES,
  CoverPage,
  coverProducts,
  discount,
  installmentCount,
  money,
  paymentTextFor,
  PRICE_LOGOS,
  ProductPage,
  splitPages,
  StoresPage,
  validOffer,
  validSale,
} from "../brochure/Brochure";
import {
  Button,
  CreateCampaign,
  Details,
  Field,
  ImportSales,
  ManualPicker,
  Modal,
  ProductImage,
} from "../brochure/Modals";
import "../../styles/campaign.css";
import "../../styles/brochure-reference.css";
import "../../styles/responsive.css";
import "../../styles/ai-review.css";
import "../../styles/export.css";
import "../../styles/review.css";
import "../../styles/campaign-library.css";
import "../../styles/category-select.css";
import "../../styles/brochure-workspace.css";
import "../../styles/cover-layout.css";
import "../../styles/product-editing.css";
import "../../styles/import-flex.css";
import "../../styles/page-background.css";
import "../../styles/brochure-direct-edit.css";
import "../../styles/layer-workspace.css";
import "../../styles/stores-design.css";
import "../../styles/brochure-comments.css";
import "../../styles/brochure-import-artwork.css";
import "../../styles/artwork-typography.css";
import "../../styles/reference-price-card.css";
import "../../styles/mobile-details.css";
import "../../styles/brochure-format.css";

const logo = "/api/assets/app/logo";
type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>["user"]>;
type TeamMember = Awaited<ReturnType<typeof getMembers>>[number];
type CampaignUpdater = (mutator: CampaignMutator) => void;
interface CampaignControlsProps {
  campaign: Campaign;
  onUpdate: CampaignUpdater;
}
interface StoreControlsProps extends CampaignControlsProps {
  settings: Settings;
}
interface CampaignLibraryProps {
  campaigns: Campaign[];
  settings?: Settings;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDuplicate: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
  onPrint: (id: string) => void;
  canManageDisabled?: boolean;
  canDisable?: boolean;
  loading?: boolean;
  restoringId?: string | null;
  onRestore?: (campaign: Campaign) => void;
}
interface ProductEditorProps extends CampaignControlsProps {
  canMakeSocial?: boolean;
  canUseCatalog?: boolean;
  onImport: () => void;
  onManual: () => void;
  onDetails: (product: Product) => void;
  onImageEdit: (product: Product) => void;
  onAiReview: () => void;
  onReCut: () => void;
  onNext: () => void;
  onMakeSocial: (products: Product[]) => void;
}
interface BrochureEditorProps extends StoreControlsProps {
  canMakeSocial?: boolean;
  canUseCatalog?: boolean;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  notificationTarget?: {
    id: string;
    campaignId: string;
    pageIndex: number;
    commentId?: string | null;
    openComments?: boolean;
  } | null;
  onPreparePhotos?: (
    snapshot: Campaign,
    products?: Product[],
  ) => Promise<unknown>;
  user: SessionUser;
  members: TeamMember[];
  onReviewAction: (
    action: string,
    details?: Record<string, JsonValue | undefined>,
  ) => Promise<boolean>;
  onToast: (message: string) => void;
  onAiReview: () => void;
  onReCut: () => void;
  onPrint: () => void;
  onExport: (page: number) => void;
  onAddProducts: () => void;
  onImportProducts: () => void;
  onEditImage: (product: Product) => void;
  onEditScreen: (product: Product) => void;
  onEditDetails: (product: Product) => void;
  onEditPrice: (product: Product) => void;
  onEditSavings: (product: Product) => void;
  onMakeSocial: (products: Product[]) => void;
}
interface SocialSeed {
  campaignId: string;
  products: Product[];
}
interface ImportOptions {
  brochureImport?: boolean;
  replaceImported?: boolean;
  warnings?: Campaign["brochureImportWarnings"];
}
interface DetailSelection {
  product: Product;
  focusDetailKey?: string;
  editable: boolean;
}
type BrochureCssStyle = React.CSSProperties & {
  "--brochure-page-aspect": string | number;
};
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function brochureAspectStyle(aspect: string | number): BrochureCssStyle {
  return { "--brochure-page-aspect": aspect };
}
function LanguageSwitch({
  language,
  onChange,
}: {
  language: string;
  onChange: (language: string) => void;
}) {
  return (
    <div
      className="cs-language-switch"
      role="group"
      aria-label="Language / Gjuha"
    >
      <button
        type="button"
        lang="en"
        aria-pressed={language === "en"}
        className={language === "en" ? "active" : ""}
        onClick={() => onChange("en")}
      >
        EN
      </button>
      <button
        type="button"
        lang="sq"
        aria-pressed={language === "sq"}
        className={language === "sq" ? "active" : ""}
        onClick={() => onChange("sq")}
      >
        SQ
      </button>
    </div>
  );
}

const MINI_COVER_BASE_WIDTH = 794;
export function CampaignCoverThumbnail({ campaign }: { campaign: Campaign }) {
  const frameRef = useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const updateScale = () => {
      frame.style.setProperty(
        "--mini-cover-scale",
        String(frame.getBoundingClientRect().width / MINI_COVER_BASE_WIDTH),
      );
    };
    updateScale();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={frameRef}
      className="cs-campaign-mini-cover"
      aria-hidden="true"
      style={brochureAspectStyle(resolveBrochureFormat(campaign).aspectRatio)}
    >
      <div className="cs-campaign-mini-cover-canvas">
        <CoverPage campaign={campaign} />
      </div>
    </div>
  );
}

export function CampaignLibrary({
  campaigns,
  settings,
  onCreate,
  onOpen,
  onDuplicate,
  onDelete,
  onPrint,
  canManageDisabled = false,
  canDisable = true,
  loading = false,
  restoringId,
  onRestore,
}: CampaignLibraryProps) {
  const now = useCampaignClock();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanelId = React.useId();
  const emptyFilters = emptyCampaignFilters;
  const [filters, setFilters] = useState<CampaignFilters>(() => {
    try {
      return normalizeCampaignFilters(
        JSON.parse(localStorage.getItem("neptun-campaign-filters") || "{}"),
      );
    } catch {
      return { ...emptyFilters };
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("neptun-campaign-filters", JSON.stringify(filters));
    } catch {
      /* Filtering remains usable when browser storage is unavailable. */
    }
  }, [filters]);
  const setFilter = (key: keyof CampaignFilters, value: string) =>
    setFilters((current) =>
      normalizeCampaignFilters({ ...current, [key]: value }),
    );
  const visibleCampaigns = canManageDisabled
    ? campaigns
    : campaigns.filter((item) => !item.disabledAt);
  const campaignTypes = [
    ...new Set([
      ...resolveSettings(settings).campaignTypes.map((item) => item.name),
      ...visibleCampaigns
        .map((item) => item.type)
        .filter((value): value is string => Boolean(value)),
    ]),
  ].sort();
  const formats = [
    ...new Map(
      visibleCampaigns.map((item) => {
        const format = resolveBrochureFormat(item);
        return [format.id, format] as const;
      }),
    ).values(),
  ];
  const effectiveFilters = {
    ...filters,
    visibility: canManageDisabled ? filters.visibility : "active",
    type: campaignTypes.includes(filters.type) ? filters.type : "all",
    format: formats.some((format) => format.id === filters.format)
      ? filters.format
      : "all",
  };
  const filtered = filterCampaigns(visibleCampaigns, effectiveFilters, now);
  const filterActive = Object.entries(filters).some(
    ([key, value]) => value !== emptyFilters[key as keyof CampaignFilters],
  );
  const advancedFilterCount = Object.entries(effectiveFilters).filter(
    ([key, value]) =>
      key !== "query" && value !== emptyFilters[key as keyof CampaignFilters],
  ).length;
  return (
    <div className="cs-main-panel cs-library">
      <div className="cs-library-heading">
        <div>
          <h1>{t("Campaigns")}</h1>
          <p>
            {loading
              ? t("Loading campaigns…")
              : `${visibleCampaigns.length} ${t("saved for the team")}`}
          </p>
        </div>
        <Button tone="primary" onClick={onCreate}>
          <NavIcon name="plus" />
          {t("New campaign")}
        </Button>
      </div>
      <section
        className="cs-campaign-filters"
        aria-label={t("Campaign filters")}
      >
        <div className="cs-library-filter-bar">
          <label className="cs-search cs-library-search">
            <NavIcon name="search" />
            <input
              type="search"
              aria-label={t("Search campaigns, products or codes")}
              value={filters.query}
              onChange={(event) => setFilter("query", event.target.value)}
              placeholder={t("Search campaigns, products or codes")}
            />
          </label>
          <button
            type="button"
            className="cs-library-filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls={filterPanelId}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <NavIcon name="filter" />
            {t("Filters")}
            {advancedFilterCount > 0 && (
              <span className="cs-filter-count">{advancedFilterCount}</span>
            )}
            <NavIcon name="chevron-down" />
          </button>
        </div>
        <div
          id={filterPanelId}
          className="cs-library-advanced"
          hidden={!filtersOpen}
        >
          <div className="cs-campaign-filter-grid">
            {canManageDisabled && (
              <FilterSelect
                label={t("Brochure visibility")}
                value={effectiveFilters.visibility}
                onChange={(value: string) => setFilter("visibility", value)}
                options={[
                  { value: "active", label: t("Active brochures") },
                  { value: "disabled", label: t("Deleted brochures") },
                  { value: "all", label: t("All brochures") },
                ]}
              />
            )}

            <FilterSelect
              label={t("Status")}
              value={filters.status}
              onChange={(value: string) => setFilter("status", value)}
              options={[
                { value: "all", label: t("All statuses") },
                { value: "in_progress", label: t("In progress") },
                { value: "in_review", label: t("In review") },
                { value: "changes_requested", label: t("Changes requested") },
                { value: "completed", label: t("Completed") },
                { value: "expired", label: t("Offer period ended") },
              ]}
            />
            <FilterSelect
              label={t("Campaign period")}
              value={filters.period}
              onChange={(value: string) => setFilter("period", value)}
              options={[
                { value: "all", label: t("Any time") },
                { value: "past", label: t("Past") },
                { value: "current", label: t("Current") },
                { value: "upcoming", label: t("Upcoming") },
                { value: "one_day", label: t("One day") },
              ]}
            />
            <FilterSelect
              label={t("Type")}
              value={effectiveFilters.type}
              onChange={(value: string) => setFilter("type", value)}
              options={[
                { value: "all", label: t("All types") },
                ...campaignTypes.map((type) => ({
                  value: type,
                  label: t(type),
                })),
              ]}
            />
            <FilterSelect
              label={t("Format")}
              value={effectiveFilters.format}
              onChange={(value: string) => setFilter("format", value)}
              options={[
                { value: "all", label: t("All formats") },
                ...formats.map((format) => ({
                  value: format.id,
                  label: format.label,
                })),
              ]}
            />
            <FilterDate
              label={t("From date")}
              value={filters.from}
              min={undefined}
              max={filters.to || undefined}
              onChange={(value: string) => setFilter("from", value)}
            />
            <FilterDate
              label={t("To date")}
              value={filters.to}
              max={undefined}
              min={filters.from || undefined}
              onChange={(value: string) => setFilter("to", value)}
            />
            <FilterSelect
              label={t("Sort by")}
              value={filters.sort}
              onChange={(value: string) => setFilter("sort", value)}
              options={[
                { value: "updated_desc", label: t("Recently edited") },
                { value: "updated_asc", label: t("Oldest edited") },
                { value: "start_desc", label: t("Newest campaign date") },
                { value: "start_asc", label: t("Oldest campaign date") },
                { value: "name", label: t("Name A–Z") },
              ]}
            />
          </div>
        </div>
        <div className="cs-campaign-filter-footer" hidden={!filterActive}>
          <span>
            {t("Showing")} {filtered.length} {t("of")} {visibleCampaigns.length}{" "}
            {t("campaigns")}
          </span>
          {filterActive && (
            <button type="button" onClick={() => setFilters(emptyFilters)}>
              {t("Clear filters")}
            </button>
          )}
        </div>
      </section>
      {loading ? (
        <div
          className="cs-campaign-grid cs-library-skeleton"
          role="status"
          aria-label={t("Loading campaigns…")}
        >
          <div />
          <div />
          <div />
        </div>
      ) : filtered.length ? (
        <div className="cs-campaign-grid">
          {filtered.map((item) => (
            <article className="cs-campaign-card" key={item.id}>
              <div className="cs-campaign-badges">
                <span className="cs-campaign-type">
                  {t(item.type || "Campaign")}
                </span>
                <CampaignStatus campaign={item} now={now} surface="library" />
              </div>
              <button
                className="cs-campaign-cover"
                type="button"
                aria-label={`${item.name} · ${item.startDate === item.endDate ? item.startDate : `${item.startDate} – ${item.endDate}`}`}
                onClick={() => {
                  if (!item.disabledAt) onOpen(item.id);
                }}
                disabled={Boolean(item.disabledAt)}
              >
                <CampaignCoverThumbnail campaign={item} />
              </button>
              <div className="cs-campaign-card-title">
                <strong>{item.name}</strong>
                <small>
                  {item.startDate === item.endDate
                    ? item.startDate
                    : `${item.startDate} → ${item.endDate}`}
                </small>
              </div>
              <div className="cs-campaign-card-meta">
                <span>
                  {item.products.length} {t("products")}
                </span>
                <span>{resolveBrochureFormat(item).label}</span>
                {(item.reviewComments || []).some(
                  (comment) => !comment.fixed,
                ) && (
                  <span>
                    {
                      (item.reviewComments || []).filter(
                        (comment) => !comment.fixed,
                      ).length
                    }{" "}
                    {t("open comments")}
                  </span>
                )}
              </div>
              <div className="cs-campaign-card-actions">
                {item.disabledAt ? (
                  <>
                    <p className="cs-disabled-note">
                      {t("Only superadmins can view deleted brochures.")}
                    </p>
                    {canManageDisabled && onRestore && (
                      <button
                        className="cs-card-enable"
                        type="button"
                        disabled={restoringId === item.id}
                        onClick={() => onRestore(item)}
                        aria-label={`${t("Restore campaign")}: ${item.name}`}
                      >
                        <NavIcon name="refresh" />
                        {t(restoringId === item.id ? "Restoring…" : "Restore")}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="cs-card-utility"
                      onClick={() => onDuplicate(item)}
                      aria-label={`${t("Duplicate campaign")}: ${item.name}`}
                    >
                      <NavIcon name="copy" />
                      {t("Duplicate")}
                    </button>
                    {canDisable && (
                      <button
                        type="button"
                        className="cs-card-utility cs-card-delete"
                        onClick={() => onDelete(item)}
                        aria-label={`${t("Delete campaign")}: ${item.name}`}
                      >
                        <NavIcon name="trash" />
                        {t("Delete")}
                      </button>
                    )}
                    <button
                      className="cs-card-open"
                      type="button"
                      onClick={() => onOpen(item.id)}
                      aria-label={`${t("Open campaign")}: ${item.name}`}
                    >
                      {t(
                        (item.status || "in_progress") === "completed"
                          ? "Open"
                          : "Continue",
                      )}
                      <NavIcon name="arrow-right" />
                    </button>
                    <button
                      className="cs-card-download"
                      type="button"
                      aria-label={t("Download brochure")}
                      title={t("Download brochure")}
                      onClick={() => onPrint(item.id)}
                    >
                      <NavIcon name="download" />
                      {t("Brochure")}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="cs-empty">
          <b>✳</b>
          <h3>
            {visibleCampaigns.length
              ? t("No campaigns match these filters")
              : "Your first campaign starts here"}
          </h3>
          <p>
            {visibleCampaigns.length
              ? t("Adjust the search or clear filters to see saved campaigns.")
              : "Create a campaign to organize your offers and design a brochure."}
          </p>
          {visibleCampaigns.length > 0 && filterActive && (
            <Button onClick={() => setFilters(emptyFilters)}>
              {t("Clear filters")}
            </Button>
          )}
          {!visibleCampaigns.length && (
            <Button tone="primary" onClick={onCreate}>
              {t("Create campaign →")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ProductEditor({
  canMakeSocial = true,
  canUseCatalog = true,
  campaign,
  onUpdate,
  onImport,
  onManual,
  onDetails,
  onImageEdit,
  onAiReview,
  onReCut,
  onNext,
  onMakeSocial,
}: ProductEditorProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [draggingCode, setDraggingCode] = useState<string | null>(null);
  const [dropCode, setDropCode] = useState<string | null>(null);
  const categories = [
    ...new Set(
      campaign.products
        .map((p) => p.category)
        .filter((value): value is NonNullable<typeof value> => Boolean(value)),
    ),
  ];
  const filtered = campaign.products.filter(
    (p) =>
      (!search ||
        normalize(`${p.code} ${p.name} ${p.brand}`).includes(
          normalize(search),
        )) &&
      (!category || p.category === category),
  );
  const valid = campaign.products.filter(validOffer).length;
  const discountedProducts = campaign.products.filter(validSale);
  const featured = coverProducts(campaign).map((product: Product) =>
    String(product.code),
  );
  const featuredSet = new Set(featured);
  function toggleCover(code: string) {
    onUpdate((draft: Campaign) => {
      const current = coverProducts(draft).map((product: Product) =>
        String(product.code),
      );
      const key = String(code);
      const positioned = draft.products.some((product) =>
        Number.isInteger(product.brochurePage),
      );
      const product = draft.products.find((item) => String(item.code) === key);
      if (current.includes(key)) {
        const remaining = current.filter((item: string) => item !== key);
        if (remaining.length) {
          draft.coverProductCodes = remaining;
          if (positioned && product) {
            product.brochurePage = 2;
            delete product.brochureOrder;
          }
        }
      } else {
        draft.coverProductCodes = [...current, key];
        if (positioned && product) {
          product.brochurePage = 1;
          delete product.brochureOrder;
        }
      }
    });
  }
  function updatePrice(code: string, sale: string) {
    onUpdate((draft: Campaign) => {
      draft.products = draft.products.map((p) =>
        p.code === code && String(p.sale) !== String(sale)
          ? { ...p, sale, confirmedAboveRegular: false }
          : p,
      );
    });
  }
  function confirmHigher(code: string, confirmed: boolean) {
    onUpdate((draft: Campaign) => {
      draft.products = draft.products.map((p) =>
        p.code === code ? { ...p, confirmedAboveRegular: confirmed } : p,
      );
    });
  }
  function remove(code: string) {
    onUpdate((draft: Campaign) => {
      draft.products = draft.products.filter((p) => p.code !== code);
      draft.coverProductCodes = (draft.coverProductCodes || []).filter(
        (item) => String(item) !== String(code),
      );
    });
  }
  function move(code: string, direction: number) {
    onUpdate((draft: Campaign) => {
      const index = draft.products.findIndex((p) => p.code === code);
      if (index < 0) return;
      const target = index + direction;
      if (target < 0 || target >= draft.products.length) return;
      const first = draft.products[index];
      const second = draft.products[target];
      if (!first || !second) return;
      draft.products[index] = second;
      draft.products[target] = first;
    });
  }
  function dropOnProduct(
    product: Product,
    event: React.DragEvent<HTMLElement>,
  ) {
    event.preventDefault();
    const source = draggingCode || event.dataTransfer.getData("text/plain");
    const target = String(product.code);
    setDraggingCode(null);
    setDropCode(null);
    if (!source || String(source) === target) return;
    const after =
      event.clientY >
      event.currentTarget.getBoundingClientRect().top +
        event.currentTarget.getBoundingClientRect().height / 2;
    onUpdate((draft: Campaign) => {
      draft.products = reorderProducts(draft.products, source, target, after);
    });
  }
  return (
    <div className="cs-editor-section">
      <div className="cs-editor-section-head">
        <div>
          <span className="cs-eyebrow">{t("02 / OFFERS")}</span>
          <h2>{t("Campaign products")}</h2>
          <p>
            {t(
              "Import a sale file or choose products manually. All prices update live.",
            )}
          </p>
        </div>
        <div className="cs-actions">
          <Button onClick={onAiReview}>{t("✦ AI review")}</Button>
          <Button onClick={onReCut}>{t("Fix product photos")}</Button>
          {canUseCatalog && (
            <Button onClick={onManual}>{t("＋ Add manually")}</Button>
          )}
          <Button tone="primary" onClick={onImport}>
            {t("↑ Import CSV / Excel")}
          </Button>
        </div>
      </div>
      <div className="cs-metrics">
        <div>
          <span>{t("PRODUCTS")}</span>
          <strong>{campaign.products.length}</strong>
        </div>
        <div>
          <span>{t("VALID OFFERS")}</span>
          <strong>{valid}</strong>
        </div>
        <div>
          <span>{t("AVERAGE DISCOUNT")}</span>
          <strong>
            {discountedProducts.length
              ? Math.round(
                  discountedProducts.reduce(
                    (sum, p) =>
                      sum + discount(Number(p.regular), Number(p.sale)),
                    0,
                  ) / discountedProducts.length,
                )
              : 0}
            %
          </strong>
        </div>
        <div>
          <span>{t("BROCHURE PAGES")}</span>
          <strong>
            {brochurePageCount(campaign, splitPages(campaign).length)}
          </strong>
        </div>
      </div>
      <div className="cs-next-step">
        <div>
          <span>{t("NEXT STEP")}</span>
          <strong>{t("Ready to design the brochure?")}</strong>
          <small>
            {t("Preview pages and choose layouts, stores and export options.")}
          </small>
        </div>
        <Button tone="primary" onClick={onNext}>
          {t("Next: brochure design")} →
        </Button>
      </div>
      {campaign.products.length > 0 ? (
        <>
          <div className="cs-cover-selection-help">
            <span>
              <strong>{t("Cover products")}</strong> ·{" "}
              {t(
                "Select cover products. The cover layout adapts to your selection.",
              )}
            </span>
            {!!campaign.coverProductCodes?.length && (
              <button
                type="button"
                onClick={() =>
                  onUpdate((draft: Campaign) => {
                    delete draft.coverProductCodes;
                  })
                }
              >
                {t("Use first 3")}
              </button>
            )}
          </div>
          <div className="cs-list-tools">
            <div className="cs-search">
              <span>⌕</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("Search code, name or brand")}
              />
            </div>
            <SearchableSelect
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="">{t("All categories")}</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </SearchableSelect>
            <span>
              {filtered.length} {t("shown")} · {t("Drag the grip to reorder")}
            </span>
          </div>
          <div className="cs-product-list">
            {filtered.map((product: Product) => {
              const higher =
                Number(product.regular) > 0 &&
                Number(product.sale) > Number(product.regular);
              return (
                <article
                  className={`cs-offer-row ${draggingCode === String(product.code) ? "cs-product-dragging" : ""} ${dropCode === String(product.code) ? "cs-product-drop-target" : ""}`}
                  key={product.code}
                  onDragOver={(event) => {
                    if (draggingCode && draggingCode !== String(product.code)) {
                      event.preventDefault();
                      setDropCode(String(product.code));
                    }
                  }}
                  onDragLeave={(event) => {
                    if (!(
                      event.relatedTarget instanceof Node &&
                      event.currentTarget.contains(event.relatedTarget)
                    ))
                      setDropCode(null);
                  }}
                  onDrop={(event) => dropOnProduct(product, event)}
                >
                  <span
                    className="cs-list-drag-handle"
                    draggable="true"
                    role="button"
                    tabIndex={0}
                    title={t("Drag to reorder products")}
                    aria-label={`${t("Drag to reorder products")}: ${product.name}`}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData(
                        "text/plain",
                        String(product.code),
                      );
                      setDraggingCode(String(product.code));
                    }}
                    onDragEnd={() => {
                      setDraggingCode(null);
                      setDropCode(null);
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === "ArrowUp" ||
                        event.key === "ArrowDown"
                      ) {
                        event.preventDefault();
                        move(product.code, event.key === "ArrowUp" ? -1 : 1);
                      }
                    }}
                  >
                    ⠿
                  </span>
                  <button
                    type="button"
                    className="cs-product-photo"
                    onClick={() => onImageEdit(product)}
                    aria-label={`${t("Change image")}: ${product.name}`}
                    title={t("Change image")}
                  >
                    <ProductImage product={product} />
                    <span className="cs-photo-edit-label">{t("Change")}</span>
                  </button>
                  <div className="cs-product-info">
                    <span>
                      {product.brand} · {product.code}
                    </span>
                    <h3>{product.name}</h3>
                    <small>
                      {product.category} / {product.subcategory}
                    </small>
                    <div className="cs-product-quick-actions">
                      <button type="button" onClick={() => onDetails(product)}>
                        {t("Edit details & display ↗")}
                      </button>
                      <button
                        type="button"
                        onClick={() => onImageEdit(product)}
                      >
                        {t("Change image ↗")}
                      </button>
                      {canMakeSocial && (
                        <button
                          type="button"
                          onClick={() => onMakeSocial([product])}
                        >
                          Make social post ↗
                        </button>
                      )}
                      {product.aiOriginalImage && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdate((draft: Campaign) => {
                              const current = draft.products.find(
                                (item) =>
                                  String(item.code) === String(product.code),
                              );
                              if (current?.aiOriginalImage) {
                                current.image = current.aiOriginalImage;
                                current.aiReviewedImageSource = current.image;
                                current.aiReviewedPreparationRevision =
                                  IMAGE_PREPARATION_REVISION;
                                current.aiReviewedBackgroundSignature =
                                  imageBackgroundSignature(
                                    productImageBackgroundContext(
                                      draft,
                                      current,
                                    ),
                                  );
                                delete current.aiOriginalImage;
                                for (const field of [
                                  "aiInchesEmbedded",
                                  "aiPreparedScreenInches",
                                  "aiAnnotationStyle",
                                  "aiPreparationRevision",
                                  "aiBackgroundSignature",
                                ])
                                  delete current[field as keyof Product];
                              }
                            })
                          }
                        >
                          {t("Restore original photo")}
                        </button>
                      )}
                      <label className="cs-cover-checkbox">
                        <input
                          type="checkbox"
                          checked={featuredSet.has(String(product.code))}
                          disabled={
                            featuredSet.has(String(product.code)) &&
                            featured.length <= 1
                          }
                          onChange={() => toggleCover(product.code)}
                        />
                        <span>{t("Cover")}</span>
                      </label>
                    </div>
                  </div>
                  <div className="cs-regular-price">
                    <small>{t("REGULAR PRICE")}</small>
                    <strong>{money(Number(product.regular))} €</strong>
                  </div>
                  <div className="cs-sale-field">
                    <label htmlFor={`sale-${product.code}`}>
                      {t("SALE PRICE")}
                    </label>
                    <div>
                      <input
                        id={`sale-${product.code}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={product.sale ?? ""}
                        onChange={(event) =>
                          updatePrice(product.code, event.target.value)
                        }
                      />
                      <span>€</span>
                    </div>
                    {product.sale && !validSale(product) && !higher && (
                      <small>{t("Must be below regular")}</small>
                    )}
                    {higher && (
                      <label className="cs-confirm-higher">
                        <input
                          type="checkbox"
                          checked={product.confirmedAboveRegular === true}
                          onChange={(event) =>
                            confirmHigher(product.code, event.target.checked)
                          }
                        />
                        {t("Confirm higher price")}
                      </label>
                    )}
                  </div>
                  <div
                    className={`cs-percent ${higher ? "higher" : validSale(product) ? "" : "invalid"}`}
                  >
                    <strong>
                      {validSale(product)
                        ? `−${discount(Number(product.regular), Number(product.sale))}%`
                        : higher
                          ? `−${Math.round((Number(product.sale) / Number(product.regular) - 1) * 100)}%`
                          : "—"}
                    </strong>
                    <small>
                      {validSale(product)
                        ? `${t("Save")} ${money(Number(product.regular) - Number(product.sale))} €`
                        : higher
                          ? `${t("Above regular")} ${money(Number(product.sale) - Number(product.regular))} €`
                          : t("Check price")}
                    </small>
                  </div>
                  <div className="cs-row-actions">
                    <button
                      type="button"
                      title={t("Move up")}
                      onClick={() => move(product.code, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      title={t("Move down")}
                      onClick={() => move(product.code, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      title={t("Remove product")}
                      onClick={() => remove(product.code)}
                    >
                      ×
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="cs-empty">
          <b>▤</b>
          <h3>{t("Build your offer list")}</h3>
          <p>
            {t(
              "Import sale prices matched by product code, or search the catalog and set prices one by one.",
            )}
          </p>
          <div className="cs-actions">
            {canUseCatalog && (
              <Button onClick={onManual}>{t("Add manually")}</Button>
            )}
            <Button tone="primary" onClick={onImport}>
              {t("Import CSV / Excel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceLogoPicker({ campaign, onUpdate }: CampaignControlsProps) {
  const selected =
    campaign.priceLogo === "custom"
      ? campaign.customPriceLogo
        ? "custom"
        : "symbol"
      : campaign.priceLogo || "symbol";
  return (
    <div className="cs-price-logo-picker">
      <span className="cs-label">{t("haPPy PRICE LOGO")}</span>
      <p className="cs-control-help">
        {t(
          "The red price style uses this logo. Blue price cards use the supplied white haPPy logo with Çmimi.",
        )}
      </p>
      <div className="cs-price-logo-options">
        {PRICE_LOGOS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={selected === option.id ? "chosen" : ""}
            aria-pressed={selected === option.id}
            onClick={() =>
              onUpdate((draft: Campaign) => {
                draft.priceLogo = option.id;
              })
            }
          >
            <span className="cs-price-logo-preview">
              <img src={option.src} alt="" />
            </span>
            <span>{t(option.label)}</span>
          </button>
        ))}
        {campaign.customPriceLogo && (
          <button
            type="button"
            className={selected === "custom" ? "chosen" : ""}
            aria-pressed={selected === "custom"}
            onClick={() =>
              onUpdate((draft: Campaign) => {
                draft.priceLogo = "custom";
              })
            }
          >
            <span className="cs-price-logo-preview">
              <img src={campaign.customPriceLogo} alt="" />
            </span>
            <span>{t("Uploaded logo")}</span>
          </button>
        )}
      </div>
      <FileUpload
        accept="image/*"
        onChange={async (event) => {
          const image = await readImage(event.target.files?.[0]);
          if (image)
            onUpdate((draft: Campaign) => {
              draft.customPriceLogo = image;
              draft.priceLogo = "custom";
            });
          event.target.value = "";
        }}
      >
        {t("Upload a new logo")}
      </FileUpload>
    </div>
  );
}

function BrochureAssetPicker({ campaign, onUpdate }: CampaignControlsProps) {
  return (
    <details className="cs-brand-assets">
      <summary>{t("Brochure logos")}</summary>
      <p>{t("Replace the logo artwork for this campaign.")}</p>
      <div className="cs-brand-asset-list">
        {BROCHURE_ASSETS.map((asset) => {
          const custom = !!campaign.brandAssets?.[asset.id];
          const source = brochureAssetSource(campaign, asset.id);
          return (
            <div className="cs-brand-asset" key={asset.id}>
              <strong>{t(asset.label)}</strong>
              <div
                className={`cs-brand-asset-preview ${asset.id === "neptun" && !custom && campaign.neptunLogoOption === "framed" ? "framed" : ""}`}
              >
                {asset.crop && !custom ? (
                  <span className={`cs-brand-asset-crop ${asset.crop}`} />
                ) : (
                  <img src={source} alt="" />
                )}
              </div>
              {asset.id === "neptun" && (
                <div className="cs-neptun-logo-options">
                  {(
                    [
                      ["classic", "Classic"],
                      ["framed", "Framed"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      type="button"
                      key={id}
                      className={
                        !custom &&
                        (campaign.neptunLogoOption || "classic") === id
                          ? "chosen"
                          : ""
                      }
                      aria-pressed={
                        !custom &&
                        (campaign.neptunLogoOption || "classic") === id
                      }
                      onClick={() =>
                        onUpdate((draft: Campaign) => {
                          draft.neptunLogoOption = id;
                          delete draft.brandAssets?.neptun;
                        })
                      }
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
              )}
              <div className="cs-brand-asset-actions">
                <FileUpload
                  accept="image/*"
                  onChange={async (event) => {
                    const image = await readImage(event.target.files?.[0]);
                    if (image)
                      onUpdate((draft: Campaign) => {
                        draft.brandAssets ||= {};
                        draft.brandAssets[asset.id] = image;
                      });
                    event.target.value = "";
                  }}
                >
                  {custom ? "Replace" : "Upload"}
                </FileUpload>
                {custom && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate((draft: Campaign) => {
                        delete draft.brandAssets?.[asset.id];
                      })
                    }
                  >
                    {t("Use selected logo")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function SocialContactFields({
  campaign,
  settings,
  onUpdate,
}: StoreControlsProps) {
  const contact = campaign.storesSnapshot?.contact || settings.contact || {};
  return (
    <div className="cs-social-fields">
      <span className="cs-label">{t("FOOTER CONTACTS")}</span>
      {(
        [
          ["email", "Email"],
          ["website", "Website"],
          ["facebook", "Facebook"],
          ["instagram", "Instagram"],
        ] as const
      ).map(([key, label]) => (
        <Field key={key} label={t(label)}>
          <input
            aria-label={t(label)}
            value={contact[key] ?? settings.contact?.[key] ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              onUpdate((draft: Campaign) => {
                draft.storesSnapshot ||= structuredClone(settings);
                draft.storesSnapshot.contact ||= {};
                draft.storesSnapshot.contact[key] = value;
              });
            }}
          />
        </Field>
      ))}
    </div>
  );
}

function PaymentNoteEditor({ campaign, onUpdate }: CampaignControlsProps) {
  return (
    <div className="cs-payment-note">
      <span className="cs-label">{t("PAYMENT TERMS")}</span>
      <Field
        label={t("Maximum installments")}
        hint={t(
          "Offer prices and the default footer message recalculate automatically",
        )}
      >
        <input
          type="number"
          min="1"
          max="60"
          step="1"
          aria-label={t("Maximum installments")}
          value={campaign.installments ?? 12}
          onChange={(event) => {
            const value = event.target.value;
            onUpdate((draft: Campaign) => {
              draft.installments =
                value === ""
                  ? undefined
                  : Math.min(60, Math.max(1, Number.parseInt(value, 10) || 1));
            });
          }}
        />
      </Field>
      <Field
        label={t("Footer payment text")}
        hint={t("Edit this only when you want different wording")}
      >
        <textarea
          rows={3}
          aria-label={t("Footer payment text")}
          value={paymentTextFor(campaign)}
          onChange={(event) => {
            const value = event.target.value;
            onUpdate((draft: Campaign) => {
              draft.paymentText = value;
            });
          }}
        />
      </Field>
      {campaign.paymentText !== undefined && (
        <button
          type="button"
          onClick={() =>
            onUpdate((draft: Campaign) => {
              delete draft.paymentText;
            })
          }
        >
          {t("Use automatic message for")} {installmentCount(campaign)}{" "}
          {t("installments")}
        </button>
      )}
    </div>
  );
}

function CoverTemplatePicker({ campaign, onUpdate }: CampaignControlsProps) {
  return (
    <div className="cs-cover-template-picker">
      <span className="cs-label">{t("COVER TEMPLATE")}</span>
      <button
        type="button"
        className="cs-reference-preset"
        onClick={() =>
          onUpdate((draft) => {
            draft.brochureVisualStyle = "current";
            draft.brochurePresetId = "neptun-current";
            draft.offerStyle = "current";
            draft.layout = "feature3";
            draft.autoProductLayout = true;
            draft.coverProductLayout = "hero";
            draft.coverTemplate = "blueClean";
            draft.showCoverBand = false;
            draft.showInteriorFooter = false;
            draft.showFooterPageNumber = false;
            draft.brochureFooter = { style: "reference" };
            draft.coverBackgroundColor = "";
            draft.productBackgroundColor = "";
            draft.coverBackgroundImage = "";
            draft.productBackgroundImage = "";
            draft.coverBackgroundGradient = {
              from: "#1f5687",
              to: "#38739f",
              angle: 110,
            };
            draft.productBackgroundGradient = {
              ...draft.coverBackgroundGradient,
            };
            for (const product of draft.products) {
              delete product.brochurePage;
              delete product.brochureCardSize;
              delete product.brochureImagePlacement;
              delete product.brochureContentPlacement;
            }
            for (const config of Object.values(draft.pages || {})) {
              delete config.layout;
              config.showFooter = false;
              config.showFooterPageNumber = false;
            }
            for (const key of Object.keys(draft.coverElementPlacements || {}))
              if (key.startsWith("product-") || key === "footer")
                delete draft.coverElementPlacements![key];
          })
        }
      >
        <EditorIcon name="edit" />
        <span>
          {t("Use reference brochure preset")}
          <small>{t("One above two · TV pages 3–2–3")}</small>
        </span>
      </button>
      <div className="cs-cover-template-options">
        {COVER_TEMPLATES.map((template) => (
          <button
            type="button"
            key={template.id}
            className={
              (campaign.coverTemplate === "redBlue"
                ? "redBlue"
                : "blueClean") === template.id
                ? "chosen"
                : ""
            }
            aria-pressed={
              (campaign.coverTemplate === "redBlue"
                ? "redBlue"
                : "blueClean") === template.id
            }
            onClick={() =>
              onUpdate((draft: Campaign) => {
                draft.coverTemplate = template.id;
                draft.coverBackgroundColor =
                  template.id === "blueClean" ? "#1c4075" : "";
                draft.coverBackgroundGradient = null;
                draft.coverBackgroundImage = "";
              })
            }
          >
            <img src={template.preview} alt="" />
            <span>{t(template.label)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CoverHeadlineEditor({ campaign, onUpdate }: CampaignControlsProps) {
  const styles = [
    { id: "strong", label: "Bold", sample: "BLACK" },
    { id: "clean", label: "Simple", sample: "Black" },
    { id: "italic", label: "Italic", sample: "Black" },
  ];
  const [height, align] = (
    campaign.coverHeadlinePosition || "middle-left"
  ).split("-");
  const title = campaign.coverHeadline || campaign.name;
  return (
    <section className="cs-cover-headline-editor">
      <div className="cs-title-card-head">
        <div>
          <span className="cs-label">{t("COVER TITLE")}</span>
          <p>{t("Text between the NEPTUN logo and the UUU band.")}</p>
        </div>
        <label className="cs-title-switch">
          <input
            type="checkbox"
            aria-label={t("Show title on cover")}
            checked={campaign.showCoverHeadline !== false}
            onChange={(event) =>
              onUpdate((draft: Campaign) => {
                draft.showCoverHeadline = event.target.checked;
              })
            }
          />
          <span aria-hidden="true" />
        </label>
      </div>
      {campaign.showCoverHeadline !== false && (
        <>
          <Field label={t("Title text")}>
            <input
              aria-label={t("Cover headline")}
              value={campaign.coverHeadline ?? campaign.name}
              onChange={(event) =>
                onUpdate((draft: Campaign) => {
                  draft.coverHeadline = event.target.value;
                })
              }
            />
          </Field>
          <span className="cs-field-caption">{t("FONT STYLE")}</span>
          <div className="cs-cover-headline-styles">
            {styles.map((style) => (
              <button
                type="button"
                key={style.id}
                className={`${style.id} ${(campaign.coverHeadlineStyle || "strong") === style.id ? "chosen" : ""}`}
                aria-pressed={
                  (campaign.coverHeadlineStyle || "strong") === style.id
                }
                onClick={() =>
                  onUpdate((draft: Campaign) => {
                    draft.coverHeadlineStyle = style.id;
                  })
                }
              >
                <strong>{style.sample}</strong>
                <small>{t(style.label)}</small>
              </button>
            ))}
          </div>
          <span className="cs-field-caption">{t("PLACEMENT ON COVER")}</span>
          <div className="cs-title-position-preview">
            <span>NEPTUN</span>
            <strong
              className={`at-${height} align-${align} ${(campaign.coverHeadlineStyle || "strong") === "italic" ? "italic" : ""}`}
            >
              {title}
            </strong>
            <small>UUU / hajde!</small>
          </div>
          <div className="cs-title-placement-options">
            <div>
              <span>{t("Across")}</span>
              <div className="cs-segmented">
                {(
                  [
                    ["left", "Left"],
                    ["center", "Center"],
                    ["right", "Right"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    className={align === id ? "chosen" : ""}
                    aria-pressed={align === id}
                    onClick={() =>
                      onUpdate((draft: Campaign) => {
                        draft.coverHeadlinePosition = `${height}-${id}`;
                      })
                    }
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span>{t("Height")}</span>
              <div className="cs-segmented">
                {(
                  [
                    ["top", "Upper"],
                    ["middle", "Middle"],
                    ["bottom", "Lower"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    className={height === id ? "chosen" : ""}
                    aria-pressed={height === id}
                    onClick={() =>
                      onUpdate((draft: Campaign) => {
                        draft.coverHeadlinePosition = `${id}-${align}`;
                      })
                    }
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function StorePageControls({
  campaign,
  settings,
  onUpdate,
}: StoreControlsProps) {
  const stores = campaign.storesSnapshot?.stores || settings.stores || [];
  const chosen = selectedStoreIndexes(campaign, stores.length);
  const chosenSet = new Set(chosen);
  const online = includesOnlineStore(campaign);
  const included = includesStoresPage(campaign);
  const compact = includesStoresFooter(campaign);
  const hiddenKey = compact
    ? "storeFooterHiddenElements"
    : "storesHiddenElements";
  const placementKey = compact
    ? "storeFooterElementPlacements"
    : "storesElementPlacements";
  const order = orderedStoreIndexes(campaign, stores.length);
  const [dragStore, setDragStore] = useState<number | null>(null);
  function selectAll() {
    onUpdate((draft: Campaign) => {
      draft.selectedStoreIndexes = stores.map((_, index) => index);
      draft.showOnlineStore = true;
    });
  }
  function selectNone() {
    onUpdate((draft: Campaign) => {
      draft.selectedStoreIndexes = [];
      draft.showOnlineStore = false;
    });
  }
  function toggleStore(index: number) {
    onUpdate((draft: Campaign) => {
      const current = new Set(selectedStoreIndexes(draft, stores.length));
      if (current.has(index)) current.delete(index);
      else current.add(index);
      draft.selectedStoreIndexes = [...current].sort((a, b) => a - b);
    });
  }
  function reorderStore(from: number, to: number | undefined) {
    if (to === undefined) return;
    onUpdate((draft: Campaign) => {
      draft.storeOrder = moveStore(
        orderedStoreIndexes(draft, stores.length),
        from,
        to,
      );
    });
  }
  function resetStorePositions(resetOrder = false) {
    onUpdate((draft: Campaign) => {
      if (compact)
        draft.storeFooterElementPlacements = withoutFooterStorePlacements(
          draft.storeFooterElementPlacements,
        );
      else delete draft.storePositions;
      if (resetOrder) delete draft.storeOrder;
    });
  }
  return (
    <section
      className="cs-store-page-options"
      aria-label={t("Stores page options")}
    >
      <div className="cs-stores-display-options">
        <label>
          <strong>{t("Store information")}</strong>
          <SearchableSelect
            aria-label={t("Store information")}
            value={included ? "page" : compact ? "footer" : "none"}
            onChange={(event) => {
              const value = event.target.value;
              onUpdate((draft: Campaign) => {
                draft.includeStoresPage = value === "page";
                draft.includeStoresFooter = value === "footer";
              });
            }}
          >
            <option value="page">{t("Separate stores page")}</option>
            <option value="footer">
              {t("Bottom of the last product page")}
            </option>
            <option value="none">{t("No store information")}</option>
          </SearchableSelect>
        </label>
        <small>
          {compact
            ? t(
                "Products scale together to make room and keep their proportions.",
              )
            : included
              ? t("This page will appear in downloads and print.")
              : t("Store information is excluded from downloads and print.")}
        </small>
      </div>
      {compact && (
        <label className="cs-store-footer-size">
          <span>
            {t("Store section height")} · {compactStoresFooterHeight(campaign)}%
          </span>
          <input
            aria-label={t("Store section height")}
            type="range"
            min="10"
            max="28"
            step="1"
            value={compactStoresFooterHeight(campaign)}
            onChange={(event) =>
              onUpdate((draft: Campaign) => {
                draft.compactStoresFooterHeight = Number(event.target.value);
              })
            }
          />
        </label>
      )}
      <details className="cs-store-elements-options">
        <summary>{t("Store fields & contact visibility")}</summary>
        {(["city", "name", "address", "phone", "icon"] as const).map(
          (field) => (
            <label key={field}>
              <input
                type="checkbox"
                checked={campaign.storeFields?.[field] !== false}
                onChange={(event) =>
                  onUpdate((draft: Campaign) => {
                    draft.storeFields ??= {
                      city: true,
                      name: true,
                      address: true,
                      phone: true,
                      icon: true,
                    };
                    draft.storeFields[field] = event.target.checked;
                  })
                }
              />
              {t(`Show store ${field}`)}
            </label>
          ),
        )}
        {Object.keys(
          campaign.storesSnapshot?.contact || settings.contact || {},
        ).map((field) => (
          <label key={field}>
            <input
              type="checkbox"
              checked={campaign.contactVisibility?.[field] !== false}
              onChange={(event) =>
                onUpdate((draft: Campaign) => {
                  draft.contactVisibility ??= {};
                  draft.contactVisibility[field] = event.target.checked;
                })
              }
            />
            {t(`Show ${field}`)}
          </label>
        ))}
      </details>
      <BrochureIconControls campaign={campaign} onUpdate={onUpdate} />
      <details className="cs-store-elements-options">
        <summary>{t("Visible sections & alignment")}</summary>
        <div className="cs-store-checkboxes">
          {(compact
            ? ([
                ["brand", "Logos"],
                ["stores", "Stores"],
                ["service", "Elektro-Servis"],
                ["disclaimer", "Offer information"],
              ] as const)
            : ([
                ["heading", "Page title"],
                ["hajde", "hajde! logo"],
                ["locations", "Stores"],
                ["service", "Elektro-Servis"],
                ["balfin", "BALFIN Group"],
                ["disclaimer", "Offer information"],
                ["social", "Footer contacts"],
              ] as const)
          ).map(([kind, label]) => (
            <label key={kind}>
              <input
                type="checkbox"
                checked={!campaign[hiddenKey]?.includes(kind)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  onUpdate((draft: Campaign) => {
                    const hidden = new Set(draft[hiddenKey] || []);
                    if (checked) hidden.delete(kind);
                    else hidden.add(kind);
                    draft[hiddenKey] = [...hidden];
                  });
                }}
              />
              {t(label)}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            onUpdate((draft: Campaign) => {
              delete draft[placementKey];
              delete draft[hiddenKey];
            })
          }
        >
          {t("Reset sections")}
        </button>
      </details>
      <div className="cs-store-select-head">
        <span className="cs-label">{t("STORES ON THIS PAGE")}</span>
        <small>
          {chosen.length + Number(online)} / {stores.length + 1} {t("selected")}
        </small>
      </div>
      <div className="cs-store-select-actions">
        <button type="button" onClick={selectAll}>
          {t("Select all")}
        </button>
        <button type="button" onClick={selectNone}>
          {t("Unselect all")}
        </button>
      </div>
      <p className="cs-control-help">
        {t(
          "Drag stores to change their brochure order. Use the handles on the page to move, resize or hide them.",
        )}
      </p>
      <div className="cs-store-select-actions">
        <button type="button" onClick={() => resetStorePositions()}>
          {t("Reset store positions")}
        </button>
        <button type="button" onClick={() => resetStorePositions(true)}>
          {t("Reset order and alignment")}
        </button>
      </div>
      <div className="cs-store-checkboxes">
        {order.map((index) => {
          const store = stores[index];
          if (!store) return null;
          return (
            <div
              className={`cs-store-order-row ${dragStore === index ? "dragging" : ""}`}
              key={`${store.city}-${index}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                setDragStore(index);
              }}
              onDragEnd={() => setDragStore(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragStore !== null) reorderStore(dragStore, index);
                setDragStore(null);
              }}
            >
              <span className="cs-store-grip" title={t("Drag to reorder")}>
                ⠿
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={chosenSet.has(index)}
                  onChange={() => toggleStore(index)}
                />
                <span>
                  <strong>{store.name}</strong>
                  <small>{store.city}</small>
                </span>
              </label>
              <button
                type="button"
                aria-label={`${t("Move up")}: ${store.name}`}
                disabled={order.indexOf(index) === 0}
                onClick={() =>
                  reorderStore(index, order[order.indexOf(index) - 1])
                }
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`${t("Move down")}: ${store.name}`}
                disabled={order.indexOf(index) === order.length - 1}
                onClick={() =>
                  reorderStore(index, order[order.indexOf(index) + 1])
                }
              >
                ↓
              </button>
            </div>
          );
        })}
        <label>
          <input
            type="checkbox"
            checked={online}
            onChange={(event) =>
              onUpdate((draft: Campaign) => {
                draft.showOnlineStore = event.target.checked;
              })
            }
          />
          <span>
            <strong>{t("Online store")}</strong>
          </span>
        </label>
      </div>
    </section>
  );
}

export function BrochureEditor({
  canMakeSocial = true,
  canUseCatalog = true,
  campaign,
  settings,
  user,
  members,
  onReviewAction,
  onUpdate,
  onToast,
  onAiReview,
  onReCut,
  onPrint,
  onExport,
  onAddProducts,
  onImportProducts,
  onEditImage,
  onEditScreen,
  onEditDetails,
  onEditPrice,
  onEditSavings,
  onMakeSocial,
  onPreparePhotos,
  notificationTarget,
  initialPage = 0,
  onPageChange,
}: BrochureEditorProps) {
  const pages = splitPages(campaign);
  const pageFormat = resolveBrochureFormat(campaign);
  const formatGeometry = brochureExportGeometry(pageFormat);
  const televisions = campaignTelevisionPhotos(campaign);
  const hasStoresPage = includesStoresPage(campaign);
  const [selected, setSelected] = useState(() =>
    Math.max(
      -1,
      Math.min(
        initialPage - 1,
        hasStoresPage ? pages.length : Math.max(-1, pages.length - 1),
      ),
    ),
  );
  useEffect(() => {
    onPageChange?.(selected + 1);
  }, [selected, onPageChange]);
  const [moveTarget, setMoveTarget] = useState<Product | null>(null);
  const [movePage, setMovePage] = useState(-1);
  const [movePosition, setMovePosition] = useState("start");
  const [draggingCode, setDraggingCode] = useState<string | null>(null);
  const [dropCode, setDropCode] = useState<string | null>(null);
  const [overPage, setOverPage] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [inlinePreview, setInlinePreview] = useState(false);
  const editModeButton = React.useRef<HTMLButtonElement>(null);
  const fullPreviewButton = React.useRef<HTMLButtonElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [commentMode, setCommentMode] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [showLogoPicker, setShowLogoPicker] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const canEditCanvas = !previewMode && !inlinePreview && !commentMode;
  const chooseCanvasTool = (tool: CanvasTool) => {
    setTextMode(tool === "text");
    setCommentMode(tool === "comment");
    setPreviewMode(false);
    setInlinePreview(false);
  };
  useEffect(() => {
    if (!textMode) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTextMode(false);
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [textMode]);
  const lastPreviewPage = pages.length - (hasStoresPage ? 0 : 1);
  useEffect(() => {
    if (!previewMode && !inlinePreview) return;
    const leavePreview = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        document.querySelector('[role="dialog"]')
      )
        return;
      event.preventDefault();
      setPreviewMode(false);
      setInlinePreview(false);
      editModeButton.current?.focus();
    };
    window.addEventListener("keydown", leavePreview);
    return () => window.removeEventListener("keydown", leavePreview);
  }, [previewMode, inlinePreview]);
  useEffect(() => {
    if (notificationTarget?.campaignId !== campaign.id) return;
    setInlinePreview(false);
    setSelected(
      Math.max(
        -1,
        Math.min(
          hasStoresPage ? pages.length : Math.max(-1, pages.length - 1),
          notificationTarget.pageIndex - 1,
        ),
      ),
    );
    setCommentMode(notificationTarget.openComments !== false);
    setPreviewMode(false);
    setShowSettings(false);
  }, [notificationTarget?.id, campaign.id]);

  function updateProduct(
    code: string,
    field: keyof Product | Partial<Product>,
    value?: Product[keyof Product],
  ) {
    onUpdate((draft: Campaign) => {
      const product = draft.products.find(
        (item) => String(item.code) === String(code),
      );
      if (product) {
        const changes = typeof field === "object" ? field : { [field]: value };
        Object.assign(product, changes);
        if (Object.hasOwn(changes, "specs")) product.autoSpecsDisabled = true;
      }
    });
  }
  const placeImage = (
    product: Product,
    value: Product["brochureImagePlacement"],
  ) => updateProduct(product.code, "brochureImagePlacement", value);
  const resizeCard = (product: Product, value: Product["brochureCardSize"]) =>
    updateProduct(product.code, "brochureCardSize", value);
  const reorderDetails = (
    product: Product,
    from: number,
    to: number,
    rows?: DetailEntry[],
  ) =>
    onUpdate((draft: Campaign) => {
      const item = draft.products.find(
        (entry) => String(entry.code) === String(product.code),
      );
      if (item)
        Object.assign(
          item,
          rows
            ? reorderDisplayedDetails(item, rows, from, to)
            : {
                brochureDetails: reorderDisplayedDetails(
                  item,
                  savedDetailEntries(item) || Object.entries(item.specs || {}),
                  from,
                  to,
                ).brochureDetails,
              },
        );
    });
  const layoutRegion = (product: Product, kind: string, value: Placement) =>
    onUpdate((draft: Campaign) => {
      const item = draft.products.find(
        (entry) => String(entry.code) === String(product.code),
      );
      if (item) {
        item.brochureContentPlacement ||= {};
        item.brochureContentPlacement[kind] = value;
      }
    });
  const placeStore = (index: string | number, value: Placement) =>
    onUpdate((draft: Campaign) => {
      draft.storePositions ||= {};
      draft.storePositions[index] = value;
    });
  const hideStore = (key: string | number) =>
    onUpdate((draft: Campaign) => {
      if (key === "online") draft.showOnlineStore = false;
      else {
        const count = (draft.storesSnapshot?.stores || settings.stores || [])
          .length;
        draft.selectedStoreIndexes = selectedStoreIndexes(draft, count).filter(
          (index) => index !== Number(key),
        );
      }
    });
  const changeStore = (
    index: string | number,
    field: keyof Store,
    value: string,
  ) =>
    onUpdate((draft: Campaign) => {
      draft.storesSnapshot ||= structuredClone(settings);
      const store = draft.storesSnapshot.stores?.[Number(index)];
      if (store) Object.assign(store, storeDisplayChanges(store, field, value));
    });
  const changeStoreContact = (field: string, value: string) =>
    onUpdate((draft: Campaign) => {
      draft.storesSnapshot ||= structuredClone(settings);
      draft.storesSnapshot.contact ||= {};
      draft.storesSnapshot.contact[field] = value;
    });
  const changeStoreElement = (
    scope: "footer" | "page",
    kind: string,
    value: Placement,
  ) =>
    onUpdate((draft: Campaign) => {
      const key =
        scope === "footer"
          ? "storeFooterElementPlacements"
          : "storesElementPlacements";
      draft[key] ||= {};
      draft[key][kind] = value;
    });
  const hideStoreElement = (scope: "footer" | "page", kind: string) =>
    onUpdate((draft: Campaign) => {
      const key =
        scope === "footer"
          ? "storeFooterHiddenElements"
          : "storesHiddenElements";
      draft[key] = [...new Set([...(draft[key] || []), kind])];
    });
  const reorderStore = (from: number, to: number) =>
    onUpdate((draft: Campaign) => {
      const count = (draft.storesSnapshot?.stores || settings.stores || [])
        .length;
      draft.storeOrder = moveStore(orderedStoreIndexes(draft, count), from, to);
    });
  async function dropImage(product: Product, file: File) {
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      onToast(t("Choose an image under 12 MB."));
      return;
    }
    try {
      const image = await readImage(file);
      const snapshot = structuredClone(campaign);
      const replace = (draft: Campaign) => {
        const item = draft.products.find(
          (entry) => String(entry.code) === String(product.code),
        );
        if (!item) return;
        item.screenArtwork = screenArtworkForPhotoChange(
          item.screenArtwork,
          item.image,
          image,
        );
        item.image = image;
        item.skipAiCutout = false;
        for (const key of [
          "aiOriginalImage",
          "aiInchesEmbedded",
          "aiPreparationRevision",
          "aiBackgroundSignature",
          "aiCutoutProvider",
          "aiReviewedImageSource",
          "aiReviewedPreparationRevision",
          "aiReviewedBackgroundSignature",
        ] as const)
          delete item[key];
      };
      replace(snapshot);
      onUpdate(replace);
      void onPreparePhotos?.(snapshot);
      onToast(t("Product image updated."));
    } catch {
      onToast(t("Could not read this image."));
    }
  }
  useEffect(() => {
    if (selected > pages.length) setSelected(-1);
  }, [selected, pages.length]);
  const page =
    selected >= 0 && selected < pages.length ? pages[selected] : null;
  const artworkPageKey =
    selected === -1 ? "cover" : page ? `product-${page.index}` : "stores";
  function addSavedPageArtwork(
    asset: LogoAsset,
    point?: { x: number; y: number } | null,
  ) {
    onUpdate((draft) => {
      draft.pageArtworks ||= {};
      draft.pageArtworks[artworkPageKey] ||= [];
      draft.pageArtworks[artworkPageKey]!.push({
        id: crypto.randomUUID(),
        name: asset.name,
        image: asset.url,
        x: point?.x ?? 5,
        y: point?.y ?? 12,
        width: 20,
        zIndex: 6,
      });
    });
    onToast(t("Artwork added. Drag it to position it on this page."));
  }
  function addImageLayer(source: string) {
    addSavedPageArtwork({
      id: crypto.randomUUID(),
      name: t("Image"),
      url: source,
    });
  }
  async function addPageArtwork(
    file: File,
    point: { x: number; y: number } | null = null,
  ) {
    if (!file?.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      onToast(t("Choose an image under 12 MB."));
      return;
    }
    try {
      const image = await readImage(file);
      const id = crypto.randomUUID();
      onUpdate((draft: Campaign) => {
        draft.pageArtworks ||= {};
        draft.pageArtworks[artworkPageKey] ||= [];
        draft.pageArtworks[artworkPageKey].push({
          id,
          name: file.name,
          image,
          x: point?.x ?? 5,
          y:
            point?.y ??
            Math.min(80, 5 + draft.pageArtworks[artworkPageKey].length * 8),
          width: 20,
          zIndex: 6,
        });
      });
      onToast(t("Artwork added. Drag it to position it on this page."));
    } catch {
      onToast(t("Could not read this image."));
    }
  }
  async function replaceCoverLogo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      onToast(t("Choose an image under 12 MB."));
      return;
    }
    try {
      const image = await readImage(file);
      onUpdate((draft: Campaign) => {
        draft.coverLogoSource = image;
        draft.coverLogoStyle = "custom";
        draft.showCoverLogo = true;
      });
      onToast(t("Cover logo updated. Drag it on the page to move it."));
    } catch {
      onToast(t("Could not read this image."));
    }
  }
  async function replaceCoverArtwork(key: string, file: File) {
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      onToast(t("Choose an image under 12 MB."));
      return;
    }
    try {
      const image = await readImage(file);
      changeCampaignAsset(key, { image });
    } catch {
      onToast(t("Could not read this image."));
    }
  }
  const changeCampaignAsset = (
    key: string,
    changes: { image?: string; hidden?: boolean; placement?: Placement },
  ) =>
    onUpdate((draft: Campaign) => {
      draft.campaignAssets ||= {};
      draft.campaignAssets[key] = {
        ...(draft.campaignAssets[key] || {}),
        ...changes,
      };
    });
  const changePageDecoration: PageDecorationChange = (changes) =>
    onUpdate((draft) => {
      if (selected < 0 || selected >= pages.length) return;
      draft.pages ||= {};
      draft.pages[selected] = { ...draft.pages[selected], ...changes };
    });
  function placeText(event: React.PointerEvent<HTMLDivElement>) {
    if (!textMode || !canEditCanvas || event.button !== 0) return;
    const paper = event.currentTarget.querySelector(".brochure-page");
    if (!paper) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = paper.getBoundingClientRect();
    const id = crypto.randomUUID();
    const x = Math.max(
      1,
      Math.min(80, ((event.clientX - rect.left) / rect.width) * 100),
    );
    const y = Math.max(
      1,
      Math.min(94, ((event.clientY - rect.top) / rect.height) * 100),
    );
    onUpdate((draft) => {
      draft.pageArtworks ||= {};
      draft.pageArtworks[artworkPageKey] ||= [];
      draft.pageArtworks[artworkPageKey].push({
        id,
        type: "text",
        name: t("Text"),
        text: t("Your text"),
        x,
        y,
        width: Math.min(38, 98 - x),
        fontSize: 2.8,
        color: backgroundKind === "cover" ? "#ffffff" : "#003870",
        zIndex: 12,
      });
    });
    setTextMode(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const text = document.querySelector<HTMLElement>(
          `[data-text-layer="${id}"]`,
        );
        text?.focus();
        if (text) {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(text);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }),
    );
  }
  async function replaceCoverPhoto(file: File) {
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      onToast(t("Choose an image under 12 MB."));
      return;
    }
    try {
      const image = await readImage(file);
      onUpdate((draft) => {
        draft.coverImage = image;
        delete draft.coverElementPlacements?.["campaign-photo"];
      });
    } catch {
      onToast(t("Could not read this image."));
    }
  }
  function changeArtwork(id: string, placement: Partial<Artwork>) {
    onUpdate((draft: Campaign) => {
      const item = draft.pageArtworks?.[artworkPageKey]?.find(
        (entry) => entry.id === id,
      );
      if (item) Object.assign(item, placement);
    });
  }
  function removeArtwork(id: string) {
    onUpdate((draft: Campaign) => {
      if (draft.pageArtworks?.[artworkPageKey])
        draft.pageArtworks[artworkPageKey] = draft.pageArtworks[
          artworkPageKey
        ].filter((entry) => entry.id !== id);
    });
  }
  function dropArtwork(event: React.DragEvent<HTMLElement>) {
    const asset = droppedReusableImage(event.dataTransfer);
    const file = [...(event.dataTransfer?.files || [])].find((item) =>
      item.type.startsWith("image/"),
    );
    if (!file && !asset) return;
    event.preventDefault();
    const pageNode =
      event.currentTarget.querySelector(
        ".brochure-last-page-scaled > .brochure-page",
      ) || event.currentTarget.querySelector(".brochure-page");
    const rect = pageNode?.getBoundingClientRect();
    const point = rect
      ? {
          x: Math.max(
            0,
            Math.min(90, ((event.clientX - rect.left) / rect.width) * 100),
          ),
          y: Math.max(
            0,
            Math.min(90, ((event.clientY - rect.top) / rect.height) * 100),
          ),
        }
      : null;
    if (asset) addSavedPageArtwork(asset, point);
    else if (file) void addPageArtwork(file, point);
  }
  const title =
    selected === -1
      ? t("Cover")
      : selected === pages.length
        ? t("Stores & details")
        : `${t("Page")} ${selected + 2}`;
  const backgroundKind =
    selected === -1 ? "cover" : page ? "product" : "stores";
  const backgroundColor = pageBackgroundColor(
    campaign,
    backgroundKind,
    page ?? undefined,
  );
  const backgroundGradient = pageBackgroundGradient(
    campaign,
    backgroundKind,
    page ?? undefined,
  );
  const backgroundImage = pageBackgroundImage(
    campaign,
    backgroundKind,
    page ?? undefined,
  );
  const defaultBackground =
    backgroundKind === "cover"
      ? "#1c4075"
      : backgroundKind === "stores"
        ? campaign.theme === "light"
          ? "#e4e4e4"
          : "#245b89"
        : campaign.theme === "light"
          ? "#f1f2f4"
          : "#1c4075";
  const backgroundPrefix = backgroundKind === "cover" ? "cover" : "stores";
  const pageOverride =
    backgroundKind === "product"
      ? campaign.pages?.[selected]?.backgroundColor ||
        campaign.pages?.[selected]?.backgroundGradient ||
        campaign.pages?.[selected]?.backgroundImage
      : campaign[`${backgroundPrefix}BackgroundColor`] ||
        campaign[`${backgroundPrefix}BackgroundGradient`] ||
        campaign[`${backgroundPrefix}BackgroundImage`];
  function setBackgroundValues(
    values: Pick<
      PageLayout,
      "backgroundColor" | "backgroundGradient" | "backgroundImage"
    >,
  ) {
    onUpdate((draft: Campaign) => {
      if (backgroundKind === "product") {
        draft.pages ||= {};
        draft.pages[selected] = { ...(draft.pages[selected] || {}), ...values };
      } else if (backgroundKind === "cover") {
        draft.coverBackgroundColor = values.backgroundColor;
        draft.coverBackgroundGradient = values.backgroundGradient;
        draft.coverBackgroundImage = values.backgroundImage;
        draft.coverImage = "";
      } else {
        draft.storesBackgroundColor = values.backgroundColor;
        draft.storesBackgroundGradient = values.backgroundGradient;
        draft.storesBackgroundImage = values.backgroundImage;
      }
      if (backgroundKind !== "stores") draft.aiBackgroundChanged = true;
    });
  }
  function changeBackground(color: string) {
    setBackgroundValues({
      backgroundColor: color,
      backgroundGradient: null,
      backgroundImage: "",
    });
  }
  function changeGradient(gradient: Gradient) {
    setBackgroundValues({
      backgroundGradient: gradient,
      backgroundColor: "",
      backgroundImage: "",
    });
  }
  function changeBackgroundImage(image: string) {
    setBackgroundValues({
      backgroundImage: image,
      backgroundColor: backgroundColor || defaultBackground,
      backgroundGradient: null,
    });
  }
  function resetBackground() {
    onUpdate((draft: Campaign) => {
      if (backgroundKind === "product") {
        if (draft.pages?.[selected])
          for (const field of [
            "backgroundColor",
            "backgroundGradient",
            "backgroundImage",
          ])
            delete draft.pages[selected][field];
      } else if (backgroundKind === "cover") {
        delete draft.coverBackgroundColor;
        delete draft.coverBackgroundGradient;
        delete draft.coverBackgroundImage;
      } else {
        delete draft.storesBackgroundColor;
        delete draft.storesBackgroundGradient;
        delete draft.storesBackgroundImage;
      }
      if (backgroundKind !== "stores") draft.aiBackgroundChanged = true;
    });
  }
  function setPage(field: string, value: JsonValue | Gradient | undefined) {
    onUpdate((draft: Campaign) => {
      draft.pages ||= {};
      draft.pages[selected] = {
        ...(draft.pages[selected] || {}),
        [field]: value,
      };
    });
  }
  function clearDrag() {
    setDraggingCode(null);
    setDropCode(null);
    setOverPage(null);
  }
  function placeProduct(code: string, destination: number, position = "start") {
    onUpdate((draft: Campaign) => {
      if (
        draft.products.some((product) => Number.isInteger(product.brochurePage))
      )
        materializeProductPages(draft);
      placeProductOnPage(
        draft,
        code,
        destination,
        coverProducts(draft).map((product: Product) => product.code),
        position,
      );
      if (
        draft.products.some((product: Product) =>
          Number.isInteger(product.brochurePage),
        )
      ) {
        const moved = draft.products.find(
          (product: Product) => String(product.code) === String(code),
        );
        if (moved)
          moved.brochurePage = destination === -1 ? 1 : destination + 2;
      }
    });
    setSelected(destination);
  }
  function pageDrop(destination: number, event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    const source = draggingCode || event.dataTransfer.getData("text/plain");
    clearDrag();
    if (source) placeProduct(source, destination);
  }
  function productDrop(target: Product, event: React.DragEvent<HTMLElement>) {
    if ([...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    const source = draggingCode || event.dataTransfer.getData("text/plain");
    const targetCode = String(target.code);
    clearDrag();
    if (!source || String(source) === targetCode) return;
    const productsHere =
      selected === -1 ? coverProducts(campaign) : page?.products || [];
    if (
      productsHere.some(
        (product: Product) => String(product.code) === String(source),
      )
    ) {
      const rect = event.currentTarget.getBoundingClientRect();
      const after = event.clientX > rect.left + rect.width / 2;
      onUpdate((draft: Campaign) => {
        draft.products = reorderProducts(
          draft.products,
          source,
          targetCode,
          after,
        );
      });
    } else {
      placeProduct(source, selected);
    }
  }
  const dragProps = {
    onProductDragStart: (
      product: Product,
      event: React.DragEvent<HTMLElement>,
    ) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(product.code));
      setDraggingCode(String(product.code));
    },
    onProductDragEnd: clearDrag,
    onProductDragOver: (
      product: Product,
      event: React.DragEvent<HTMLElement>,
    ) => {
      if (draggingCode && draggingCode !== String(product.code)) {
        event.preventDefault();
        setDropCode(String(product.code));
      }
    },
    onProductDrop: productDrop,
    draggingCode,
    dropCode,
  };
  function openMove(product: Product) {
    setMoveTarget(product);
    setMovePage(selected);
    setMovePosition("start");
  }
  const editor = (
    <div
      className="cs-editor-section"
      style={brochureAspectStyle(pageFormat.aspectRatio)}
    >
      <style>{`@page { size: ${formatGeometry.pdfWidthMm}mm ${formatGeometry.pdfHeightMm}mm; margin:0; } @media print { html,body,#root { width:${formatGeometry.pdfWidthMm}mm!important; } .print-stack .brochure-output-page { width:${formatGeometry.pdfWidthMm}mm!important;height:${formatGeometry.pdfHeightMm}mm!important; } }`}</style>
      <div className="cs-editor-section-head">
        <div className="cs-brochure-section-title">
          <h2>{t("Your brochure")}</h2>
          <span className="cs-brochure-page-count">
            {brochurePageCount(campaign, pages.length)} {t("brochure pages")}
          </span>
        </div>
        <div className="cs-actions cs-brochure-header-actions">
          <Button onClick={onImportProducts}>
            <NavIcon name="catalog" size={17} />
            {t("Upload products")}
          </Button>
          <ActionMenu
            label={
              <>
                <span aria-hidden="true">✦</span> {t("AI assistant")}
              </>
            }
            className="cs-ai-action-menu"
          >
            <button
              className="cs-button secondary"
              type="button"
              onClick={onAiReview}
            >
              <span aria-hidden="true">✦</span>
              <span>
                <strong>{t("Check text & photos")}</strong>
                <small>{t("Review wording and product images")}</small>
              </span>
            </button>
            <button
              className="cs-button secondary"
              type="button"
              onClick={onReCut}
            >
              <span aria-hidden="true">✂</span>
              <span>
                <strong>{t("Fix product photos")}</strong>
                <small>{t("Choose photos and remove their backgrounds")}</small>
              </span>
            </button>
          </ActionMenu>
          <ActionMenu
            label={
              <>
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="4" cy="10" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="16" cy="10" r="1.5" />
                </svg>
                {t("More actions")}
              </>
            }
          >
            {canUseCatalog && (
              <Button onClick={onAddProducts}>
                <NavIcon name="plus" size={16} />
                {t("Add products")}
              </Button>
            )}
            {canMakeSocial && (
              <Button
                onClick={() =>
                  onMakeSocial(
                    selected === -1
                      ? coverProducts(campaign)
                      : page?.products || campaign.products.slice(0, 3),
                  )
                }
              >
                <NavIcon name="social" size={16} /> {t("Create social post")}
              </Button>
            )}
            {canEditCanvas && (
              <Button onClick={() => setShowGuides((value) => !value)}>
                <NavIcon name="filter" size={16} />
                {t(showGuides ? "Hide guides" : "Show guides")}
              </Button>
            )}
            <Button
              onClick={() => {
                downloadJson(
                  `${campaign.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-backup.json`,
                  campaign,
                );
                onToast(t("Campaign backup downloaded."));
              }}
            >
              <NavIcon name="download" size={16} />
              {t("Backup")}
            </Button>
            <Button onClick={onPrint}>
              <EditorIcon name="screen" />
              {t("Print")}
            </Button>
          </ActionMenu>
          <Button
            tone="primary"
            onClick={() =>
              onExport(
                selected === pages.length && !hasStoresPage ? 0 : selected + 1,
              )
            }
          >
            <NavIcon name="download" size={17} />
            {t("Download brochure")}
          </Button>
        </div>
      </div>
      {showLogoPicker && (
        <CoverLogoPicker
          settings={settings}
          onAddLayer={addImageLayer}
          onManageLayers={() => setShowLayers(true)}
          currentSource={
            campaign.coverLogoSource ||
            campaign.brandAssets?.neptun ||
            settings.brandAssets?.neptun ||
            logo
          }
          onClose={() => setShowLogoPicker(false)}
          onSelect={(source) =>
            onUpdate((draft) => {
              draft.coverLogoSource = source;
              draft.coverLogoStyle = source.endsWith("/neptun-logo-framed.png")
                ? "framed"
                : source.endsWith("/neptun-cover-logo.png")
                  ? "original"
                  : "custom";
              draft.showCoverLogo = true;
            })
          }
        />
      )}
      {showLayerPicker && (
        <CoverLogoPicker
          settings={settings}
          kind="image"
          title={t("Add image layer")}
          confirmLabel={t("Add image layer")}
          onSelect={addImageLayer}
          onClose={() => setShowLayerPicker(false)}
        />
      )}
      {showLayers && (
        <Modal
          wide
          title={t("Layers")}
          kicker={title}
          onClose={() => setShowLayers(false)}
        >
          <div className="cs-layer-workspace">
            <div>
              <PageLayersControls
                key={artworkPageKey}
                campaign={campaign}
                pageKey={artworkPageKey}
                onUpdate={onUpdate}
                onToast={onToast}
              />
            </div>
            <aside className="cs-layer-preview" aria-label={t("Layer preview")}>
              <strong>{t("Layer preview")}</strong>
              <p>{t("Changes appear immediately in the preview.")}</p>
              <div className="cs-layer-preview-paper">
                {selected === -1 ? (
                  <CoverPage campaign={campaign} settings={settings} />
                ) : page ? (
                  <ProductPage
                    campaign={campaign}
                    settings={settings}
                    page={page}
                  />
                ) : (
                  <StoresPage campaign={campaign} settings={settings} />
                )}
              </div>
            </aside>
          </div>
          <div className="cs-modal-actions">
            <Button onClick={() => setShowLayers(false)}>{t("Done")}</Button>
          </div>
        </Modal>
      )}
      {previewMode && (
        <BrochurePreview
          campaign={campaign}
          settings={settings}
          selected={selected}
          onSelect={setSelected}
          onClose={() => {
            setPreviewMode(false);
            fullPreviewButton.current?.focus();
          }}
          onExport={onExport}
        />
      )}
      <div
        className={`cs-brochure-workspace ${showSettings || commentMode ? "" : "settings-hidden"}`}
      >
        <BrochurePageNavigator
          campaign={campaign}
          pages={pages}
          selected={selected}
          onSelect={setSelected}
          draggingCode={draggingCode}
          overPage={overPage}
          onOverPage={setOverPage}
          onDropPage={pageDrop}
        />
        <div
          className={`cs-page-preview ${canEditCanvas ? "edit-view" : "view-only"} ${inlinePreview ? "inline-preview" : ""} ${commentMode ? "comment-view" : ""} ${canEditCanvas && showGuides ? "show-guides" : ""}`}
        >
          <div className="cs-canvas-meta">
            <strong>{title}</strong>
            <CampaignActivityStatus
              campaignId={campaign.id}
              mode={canEditCanvas ? "edit" : "preview"}
              pageLabel={title}
              compact
            />
          </div>
          <div
            className={`cs-canvas-dock ${toolbarCollapsed ? "is-collapsed" : ""}`}
          >
            <div className="cs-canvas-actions-row">
              <CanvasTools
                activeTool={
                  commentMode ? "comment" : textMode ? "text" : "pointer"
                }
                onSelect={chooseCanvasTool}
                disabled={previewMode}
                commentCount={
                  (campaign.reviewComments || []).filter((item) => !item.fixed)
                    .length
                }
              />
              {canEditCanvas && (
                <ActionMenu
                  label={
                    <>
                      <EditorIcon name="image" />
                      {t("Images")}
                    </>
                  }
                  className="cs-canvas-images"
                  portal
                  portalClassName="cs-canvas-images-panel"
                  triggerLabel={t("Images")}
                >
                  {selected === -1 && (
                    <CoverImageControls
                      campaign={campaign}
                      onUpdate={onUpdate}
                    />
                  )}
                  {selected === -1 && (
                    <button
                      type="button"
                      className="cs-button secondary"
                      onClick={() => setShowLogoPicker(true)}
                    >
                      <EditorIcon name="image" />
                      {t("Change cover logo")}
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={t("Add image layer")}
                    onClick={() => setShowLayerPicker(true)}
                  >
                    <EditorIcon name="plus" />
                    {t("Add image layer")}
                  </button>
                  <button type="button" onClick={() => setShowLayers(true)}>
                    <EditorIcon name="layers" /> {t("Manage layers")}
                  </button>
                  <ReusableImages
                    settings={settings}
                    onAdd={addSavedPageArtwork}
                  />
                </ActionMenu>
              )}
              {canEditCanvas && (
                <button
                  type="button"
                  className="cs-canvas-layers-button"
                  aria-label={t("Layers")}
                  title={t("Layers")}
                  onClick={() => setShowLayers(true)}
                >
                  <EditorIcon name="layers" /> {t("Layers")}
                </button>
              )}
              <button
                type="button"
                className="cs-canvas-preview-button"
                aria-label={t(
                  inlinePreview ? "Back to editing" : "Preview only",
                )}
                title={t(inlinePreview ? "Back to editing" : "Preview only")}
                aria-pressed={inlinePreview}
                ref={editModeButton}
                onClick={() => {
                  setInlinePreview(!inlinePreview);
                  setTextMode(false);
                  setCommentMode(false);
                }}
              >
                <NavIcon name="eye" size={18} />
                {t(inlinePreview ? "Back to editing" : "Preview")}
              </button>
              <button
                type="button"
                ref={fullPreviewButton}
                className="cs-canvas-full-preview-button"
                aria-label={t("Open full preview")}
                title={t("Open full preview")}
                onClick={() => {
                  setSelected((current) => Math.min(current, lastPreviewPage));
                  setInlinePreview(false);
                  setPreviewMode(true);
                  setTextMode(false);
                  setCommentMode(false);
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
                </svg>
              </button>
              <button
                type="button"
                className="cs-canvas-design-button"
                aria-label={t(
                  showSettings ? "Close design tools" : "Design tools",
                )}
                title={t(showSettings ? "Close design tools" : "Design tools")}
                aria-expanded={showSettings}
                aria-controls="brochure-page-settings"
                onClick={() => {
                  setShowSettings(!showSettings);
                  setCommentMode(false);
                  setTextMode(false);
                  setPreviewMode(false);
                  setInlinePreview(false);
                }}
              >
                <NavIcon name="stores" size={18} />
                {t(showSettings ? "Close design tools" : "Design")}
              </button>
              <ActionMenu
                label={<span aria-label={t("Editing help")}>?</span>}
                className="cs-canvas-help"
                portal
                portalClassName="cs-canvas-help-panel"
              >
                <strong>{t("Editing help")}</strong>
                <p>
                  {t(
                    "Click text or prices to edit them here. Double-click an image to replace it, or drop a new image onto it. Double-click savings to switch € and %. Drag handles to move items.",
                  )}
                </p>
                <small>{t(pageFormat.label)}</small>
                <BrochureImportNotices
                  warnings={campaign.brochureImportWarnings}
                  products={campaign.products}
                />
              </ActionMenu>
            </div>
            <BrochureZoomControls />
            <BrochurePagination
              pages={[
                { index: -1, label: t("Cover") },
                ...pages.map((item) => ({
                  index: item.index,
                  label: `${t("Page")} ${item.index + 2}`,
                })),
                {
                  index: pages.length,
                  label: t("Stores & details"),
                  excluded: !hasStoresPage,
                },
              ]}
              selected={selected}
              onSelect={setSelected}
            />
            <button
              type="button"
              className="cs-canvas-collapse-button"
              aria-label={t(toolbarCollapsed ? "Show toolbar" : "Hide toolbar")}
              title={t(toolbarCollapsed ? "Show toolbar" : "Hide toolbar")}
              aria-expanded={!toolbarCollapsed}
              onClick={() => setToolbarCollapsed((value) => !value)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                {toolbarCollapsed ? (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                ) : (
                  <path d="m8 5 7 7-7 7" />
                )}
              </svg>
              {toolbarCollapsed && <span>{t("Show toolbar")}</span>}
            </button>
          </div>
          {commentMode && (
            <p className="cs-preview-edit-hint">
              {t(
                "Click anywhere on this page to place a comment. Click a numbered circle to read and reply.",
              )}
            </p>
          )}
          <div className="cs-preview-viewport">
            <div
              className={`cs-preview-paper ${textMode ? "cs-text-placement-mode" : ""} ${selected === pages.length && !hasStoresPage ? "cs-preview-excluded" : ""}`}
              onPointerDownCapture={placeText}
              onDragOver={
                canEditCanvas
                  ? (event) => {
                      if (
                        [...event.dataTransfer.types].some(
                          (type) =>
                            type === "Files" || type === REUSABLE_IMAGE_TYPE,
                        )
                      ) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "copy";
                      }
                    }
                  : undefined
              }
              onDrop={canEditCanvas ? dropArtwork : undefined}
            >
              {selected === pages.length && !hasStoresPage && (
                <span className="cs-preview-excluded-label">
                  {t("Not included in brochure")}
                </span>
              )}
              {selected === -1 ? (
                <CoverPage
                  campaign={campaign}
                  settings={settings}
                  onChooseCoverLogo={
                    canEditCanvas ? () => setShowLogoPicker(true) : undefined
                  }
                  onReplaceCoverPhoto={
                    canEditCanvas
                      ? (file) => {
                          void replaceCoverPhoto(file);
                        }
                      : undefined
                  }
                  onCoverImageChange={
                    canEditCanvas
                      ? (source) =>
                          onUpdate((draft) => {
                            draft.coverImage = source;
                          })
                      : undefined
                  }
                  onStoresFooterChange={
                    canEditCanvas
                      ? (kind: string, value: Placement) =>
                          changeStoreElement("footer", kind, value)
                      : undefined
                  }
                  onStoresFooterHide={
                    canEditCanvas
                      ? (kind: string) => hideStoreElement("footer", kind)
                      : undefined
                  }
                  onHideStore={canEditCanvas ? hideStore : undefined}
                  onStoreChange={canEditCanvas ? changeStore : undefined}
                  onContactChange={
                    canEditCanvas ? changeStoreContact : undefined
                  }
                  onReplaceCoverArtwork={
                    canEditCanvas ? replaceCoverArtwork : undefined
                  }
                  onReplaceCoverLogo={
                    canEditCanvas
                      ? (file) => {
                          void replaceCoverLogo(file);
                        }
                      : undefined
                  }
                  onCoverTextChange={
                    canEditCanvas
                      ? (field, value) =>
                          onUpdate((draft) => {
                            draft[field] = value;
                          })
                      : undefined
                  }
                  onFooterTextChange={
                    canEditCanvas
                      ? (field, value) =>
                          onUpdate((draft) => {
                            if (field === "paymentText")
                              draft.paymentText = value;
                            else
                              draft.brochureFooter = {
                                ...draft.brochureFooter,
                                dateText: value,
                              };
                          })
                      : undefined
                  }
                  onCoverElementChange={
                    canEditCanvas
                      ? (kind: string, placement: Placement) =>
                          onUpdate((draft: Campaign) => {
                            if (
                              !applyCoverProductPlacement(
                                draft,
                                kind,
                                placement,
                              )
                            ) {
                              draft.coverElementPlacements ||= {};
                              draft.coverElementPlacements[kind] = placement;
                              if (kind === "gradient")
                                draft.coverGradientRegion = "custom";
                            }
                          })
                      : undefined
                  }
                  onCoverElementHide={
                    canEditCanvas
                      ? (kind: string) =>
                          onUpdate((draft: Campaign) => {
                            if (kind === "logo") draft.showCoverLogo = false;
                            else if (kind === "headline")
                              draft.showCoverHeadline = false;
                            else if (kind === "band")
                              draft.showCoverBand = false;
                            else if (kind === "message")
                              draft.showCoverMessage = false;
                            else if (kind === "gradient")
                              draft.showCoverGradient = false;
                            else {
                              draft.coverElementPlacements ||= {};
                              draft.coverElementPlacements[kind] = {
                                ...draft.coverElementPlacements[kind],
                                hidden: true,
                              };
                            }
                          })
                      : undefined
                  }
                  onEditImage={canEditCanvas ? onEditImage : undefined}
                  onEditScreen={canEditCanvas ? onEditScreen : undefined}
                  onEditDetails={canEditCanvas ? onEditDetails : undefined}
                  onEditPrice={canEditCanvas ? onEditPrice : undefined}
                  onEditSavings={canEditCanvas ? onEditSavings : undefined}
                  onDropImage={canEditCanvas ? dropImage : undefined}
                  onMove={canEditCanvas ? openMove : undefined}
                  onPlaceImage={canEditCanvas ? placeImage : undefined}
                  onLayoutRegion={canEditCanvas ? layoutRegion : undefined}
                  onReorderDetails={canEditCanvas ? reorderDetails : undefined}
                  onProductChange={
                    canEditCanvas
                      ? (
                          product: Product,
                          field: keyof Product | Partial<Product>,
                          value?: Product[keyof Product],
                        ) => updateProduct(product.code, field, value)
                      : undefined
                  }
                  onCampaignAssetChange={
                    canEditCanvas ? changeCampaignAsset : undefined
                  }
                  onArtworkChange={canEditCanvas ? changeArtwork : undefined}
                  onArtworkRemove={canEditCanvas ? removeArtwork : undefined}
                  {...(canEditCanvas ? dragProps : {})}
                />
              ) : page ? (
                <ProductPage
                  campaign={campaign}
                  settings={settings}
                  page={page}
                  onPageDecorationChange={
                    canEditCanvas ? changePageDecoration : undefined
                  }
                  onStoresFooterChange={
                    canEditCanvas
                      ? (kind: string, value: Placement) =>
                          changeStoreElement("footer", kind, value)
                      : undefined
                  }
                  onStoresFooterHide={
                    canEditCanvas
                      ? (kind: string) => hideStoreElement("footer", kind)
                      : undefined
                  }
                  onHideStore={canEditCanvas ? hideStore : undefined}
                  onStoreChange={canEditCanvas ? changeStore : undefined}
                  onContactChange={
                    canEditCanvas ? changeStoreContact : undefined
                  }
                  onEditImage={canEditCanvas ? onEditImage : undefined}
                  onEditScreen={canEditCanvas ? onEditScreen : undefined}
                  onEditDetails={canEditCanvas ? onEditDetails : undefined}
                  onEditPrice={canEditCanvas ? onEditPrice : undefined}
                  onEditSavings={canEditCanvas ? onEditSavings : undefined}
                  onDropImage={canEditCanvas ? dropImage : undefined}
                  onMove={canEditCanvas ? openMove : undefined}
                  onPlaceImage={canEditCanvas ? placeImage : undefined}
                  onResizeCard={canEditCanvas ? resizeCard : undefined}
                  onLayoutRegion={canEditCanvas ? layoutRegion : undefined}
                  onReorderDetails={canEditCanvas ? reorderDetails : undefined}
                  onProductChange={
                    canEditCanvas
                      ? (
                          product: Product,
                          field: keyof Product | Partial<Product>,
                          value?: Product[keyof Product],
                        ) => updateProduct(product.code, field, value)
                      : undefined
                  }
                  onCampaignAssetChange={
                    canEditCanvas ? changeCampaignAsset : undefined
                  }
                  onArtworkChange={canEditCanvas ? changeArtwork : undefined}
                  onArtworkRemove={canEditCanvas ? removeArtwork : undefined}
                  {...(canEditCanvas ? dragProps : {})}
                />
              ) : (
                <StoresPage
                  campaign={campaign}
                  settings={settings}
                  onElementChange={
                    canEditCanvas
                      ? (kind: string, value: Placement) =>
                          changeStoreElement("page", kind, value)
                      : undefined
                  }
                  onElementHide={
                    canEditCanvas
                      ? (kind: string) => hideStoreElement("page", kind)
                      : undefined
                  }
                  onHideStore={canEditCanvas ? hideStore : undefined}
                  onStoreChange={canEditCanvas ? changeStore : undefined}
                  onContactChange={
                    canEditCanvas ? changeStoreContact : undefined
                  }
                  onPlaceStore={canEditCanvas ? placeStore : undefined}
                  onReorderStore={canEditCanvas ? reorderStore : undefined}
                  onCampaignAssetChange={
                    canEditCanvas ? changeCampaignAsset : undefined
                  }
                  onArtworkChange={canEditCanvas ? changeArtwork : undefined}
                  onArtworkRemove={canEditCanvas ? removeArtwork : undefined}
                />
              )}
              {commentMode && (
                <BrochureComments
                  key={`${campaign.id}-${selected}-${notificationTarget?.id || "manual"}`}
                  campaign={campaign}
                  pageIndex={selected + 1}
                  pageLabel={title}
                  user={user}
                  members={members}
                  onAction={onReviewAction}
                  focusedCommentId={notificationTarget?.commentId}
                />
              )}
            </div>
          </div>
        </div>
        {commentMode && (
          <aside className="cs-page-controls cs-review-sidebar">
            <ReviewPanel
              key={notificationTarget?.id}
              campaign={campaign}
              user={user}
              members={members}
              pageIndex={selected + 1}
              pageLabel={title}
              onAction={onReviewAction}
              focusedCommentId={notificationTarget?.commentId}
            />
          </aside>
        )}
        {showSettings && (
          <aside
            className="cs-page-controls"
            id="brochure-page-settings"
            key={selected}
          >
            <span className="cs-label">{t("PAGE SETTINGS")}</span>
            <h3>{title}</h3>
            <PageSettingsTabs>
              {selected === -1 && (
                <SettingsGroup
                  category="appearance"
                  title={t("Brochure footer")}
                >
                  <FooterDesignControls
                    campaign={campaign}
                    onUpdate={onUpdate}
                  />
                </SettingsGroup>
              )}
              <SettingsGroup category="layout" title={t("Brochure size")}>
                <BrochureFormatPicker
                  value={campaign}
                  customFormats={settings.customFormats}
                  onChange={(value: string) =>
                    onUpdate((draft: Campaign) => {
                      Object.assign(
                        draft,
                        brochureFormatSelection(
                          value,
                          settings.customFormats,
                          draft,
                        ),
                      );
                    })
                  }
                />
              </SettingsGroup>
              {televisions.length > 0 && (
                <SettingsGroup category="images" title={t("TV wallpaper")}>
                  <p>
                    {t(
                      "Choose one picture for a TV or every TV in this brochure.",
                    )}
                  </p>
                  <Button
                    onClick={() => {
                      const currentPageProducts =
                        selected === -1
                          ? coverProducts(campaign)
                          : page?.products || [];
                      const television =
                        campaignTelevisionPhotos({
                          products: currentPageProducts,
                        })[0] || televisions[0];
                      if (television) onEditScreen(television);
                    }}
                  >
                    {t("Choose TV wallpaper")}
                  </Button>
                </SettingsGroup>
              )}
              <SettingsGroup
                category="review"
                title={`${t("Page comments")} · ${reviewCommentsForLayout(campaign).filter((item) => item.pageIndex === selected + 1).length}`}
              >
                <ReviewPanel
                  campaign={campaign}
                  user={user}
                  members={members}
                  pageIndex={selected + 1}
                  pageLabel={title}
                  onAction={onReviewAction}
                />
              </SettingsGroup>
              <SettingsGroup category="appearance" title={t("Background")}>
                <BackgroundPicker
                  compact
                  color={backgroundColor}
                  defaultColor={defaultBackground}
                  onChange={changeBackground}
                  gradient={backgroundGradient}
                  onGradientChange={changeGradient}
                  image={backgroundImage}
                  onImageChange={
                    backgroundKind === "cover"
                      ? undefined
                      : changeBackgroundImage
                  }
                  onReset={pageOverride ? resetBackground : undefined}
                  onAllPages={
                    backgroundKind === "product"
                      ? () =>
                          onUpdate((draft: Campaign) => {
                            draft.productBackgroundColor =
                              backgroundColor ||
                              (backgroundImage ? defaultBackground : "");
                            draft.productBackgroundGradient =
                              backgroundGradient;
                            draft.productBackgroundImage = backgroundImage;
                            for (const config of Object.values(
                              draft.pages || {},
                            )) {
                              delete config.backgroundColor;
                              delete config.backgroundGradient;
                              delete config.backgroundImage;
                            }
                            draft.aiBackgroundChanged = true;
                          })
                      : undefined
                  }
                />
                {backgroundKind !== "stores" &&
                  campaign.aiBackgroundChanged && (
                    <div className="cs-ai-background-reminder" role="status">
                      <p>
                        {t(
                          "Background changed. Run AI again to match product images and inch labels.",
                        )}
                      </p>
                      <Button onClick={onAiReview}>
                        {t("✦ Run AI again")}
                      </Button>
                    </div>
                  )}
              </SettingsGroup>
              {page && isOctoberBrochure(campaign) && (
                <SettingsGroup
                  category="appearance"
                  title={t("Page heading & pagination")}
                >
                  <PageDecorationControls
                    campaign={campaign}
                    page={page}
                    onChange={changePageDecoration}
                  />
                </SettingsGroup>
              )}
              {selected === -1 && (
                <SettingsGroup category="appearance" title={t("Cover design")}>
                  <CoverDesignControls
                    campaign={campaign}
                    onUpdate={onUpdate}
                    onToast={onToast}
                  />
                </SettingsGroup>
              )}
              {page && (
                <SettingsGroup category="layout" title={t("Grid")}>
                  <BrochureGridPicker
                    value={page.layout}
                    onChange={(value) =>
                      onUpdate((draft: Campaign) => {
                        applyProductPageLayout(draft, selected, value);
                      })
                    }
                  />
                  <p className="cs-control-help">
                    {t(
                      "Background and grid can be changed later. Run AI again after changing the background.",
                    )}
                  </p>
                </SettingsGroup>
              )}
              <SettingsGroup
                category="images"
                title={t("Images, text & layers")}
              >
                <PageLayersControls
                  campaign={campaign}
                  pageKey={artworkPageKey}
                  onUpdate={onUpdate}
                  onToast={onToast}
                />
              </SettingsGroup>
              <SettingsGroup
                category="layout"
                title={t("Page layout & content")}
              >
                {selected === -1 ? (
                  <>
                    <CoverTemplatePicker
                      campaign={campaign}
                      onUpdate={onUpdate}
                    />
                    <Field
                      label={t("Campaign name")}
                      hint={t(
                        "Used in the workspace and as the cover title until you set a different title.",
                      )}
                    >
                      <input
                        value={campaign.name || ""}
                        onChange={(event) =>
                          onUpdate((draft: Campaign) => {
                            draft.name = event.target.value;
                          })
                        }
                      />
                    </Field>
                    <CoverHeadlineEditor
                      campaign={campaign}
                      onUpdate={onUpdate}
                    />
                    {!pages.length && (
                      <details className="cs-store-elements-options">
                        <summary>
                          {t("Stores at the end of the brochure")}
                        </summary>
                        <StorePageControls
                          campaign={campaign}
                          settings={settings}
                          onUpdate={onUpdate}
                        />
                      </details>
                    )}
                    <Field label={t("Cover message")}>
                      <textarea
                        rows={3}
                        aria-label={t("Cover message")}
                        value={campaign.tagline}
                        onChange={(event) =>
                          onUpdate((draft: Campaign) => {
                            draft.tagline = event.target.value;
                          })
                        }
                      />
                    </Field>
                    <p className="cs-control-help">
                      {t(
                        "Artwork, headline, message, and brochure logos can be changed for each campaign.",
                      )}
                    </p>
                  </>
                ) : page ? (
                  <>
                    <div className="cs-spacing-controls">
                      <strong>{t("Spacing")}</strong>
                      {(
                        [
                          [
                            "horizontal",
                            t("Between products · horizontal"),
                            3.1,
                          ],
                          ["vertical", t("Between products · vertical"), 3.2],
                          ["content", t("Between details and price"), 1],
                        ] as const
                      ).map(([key, label, fallback]) => (
                        <label key={key}>
                          <span>
                            {label}
                            <b>
                              {Number(page.spacing?.[key] ?? fallback).toFixed(
                                1,
                              )}
                              %
                            </b>
                          </span>
                          <input
                            type="range"
                            min={key === "content" ? 0 : 0.5}
                            max={key === "content" ? 4 : 6}
                            step="0.1"
                            value={Number(page.spacing?.[key] ?? fallback)}
                            onChange={(event) =>
                              setPage("spacing", {
                                horizontal: page.spacing?.horizontal ?? 3.1,
                                vertical: page.spacing?.vertical ?? 3.2,
                                content: page.spacing?.content ?? 1,
                                [key]: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                      ))}
                      {page.spacing && (
                        <button
                          type="button"
                          className="cs-spacing-reset"
                          onClick={() => setPage("spacing", null)}
                        >
                          {t("Reset spacing")}
                        </button>
                      )}
                    </div>
                    <ImageUploadButton
                      label={t("Optional page artwork")}
                      value={page.image}
                      onFile={async (file) =>
                        setPage("image", await readImage(file))
                      }
                      onRemove={() => setPage("image", "")}
                    />
                    <label className="cs-store-page-switch">
                      <input
                        type="checkbox"
                        checked={page.showFooter}
                        onChange={(event) =>
                          setPage("showFooter", event.target.checked)
                        }
                      />
                      <span>
                        <strong>{t("NEPTUN footer")}</strong>
                        <small>
                          {t(
                            "Show the NEPTUN wordmark and line on this product page.",
                          )}
                        </small>
                      </span>
                    </label>
                    {page.showFooter && (
                      <label className="cs-store-page-switch">
                        <input
                          type="checkbox"
                          checked={page.showFooterPageNumber}
                          onChange={(event) =>
                            setPage(
                              "showFooterPageNumber",
                              event.target.checked,
                            )
                          }
                        />
                        <span>
                          <strong>{t("Show page number")}</strong>
                          <small>
                            {t("Turn off for only the NEPTUN logo and line.")}
                          </small>
                        </span>
                      </label>
                    )}
                    {page.index === pages.at(-1)?.index && (
                      <details className="cs-store-elements-options">
                        <summary>
                          {t("Stores at the end of the brochure")}
                        </summary>
                        <StorePageControls
                          campaign={campaign}
                          settings={settings}
                          onUpdate={onUpdate}
                        />
                      </details>
                    )}
                    <button
                      type="button"
                      className="cs-page-footer-apply"
                      onClick={() =>
                        onUpdate((draft: Campaign) => {
                          draft.showInteriorFooter = page.showFooter;
                          draft.showFooterPageNumber =
                            page.showFooterPageNumber;
                          draft.pages ||= {};
                          for (const item of pages)
                            draft.pages[item.index] = {
                              ...(draft.pages[item.index] || {}),
                              showFooter: page.showFooter,
                              showFooterPageNumber: page.showFooterPageNumber,
                            };
                        })
                      }
                    >
                      {t("Apply footer choice to all product pages")}
                    </button>
                    <p className="cs-control-help">
                      {t(
                        "Drag products on the preview to change their order, or use the move control to choose a page.",
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="cs-control-help">
                      {t("Manage locations from")} <b>{t("Stores & footer")}</b>{" "}
                      {t("to update future campaigns.")}
                    </p>
                    <StorePageControls
                      campaign={campaign}
                      settings={settings}
                      onUpdate={onUpdate}
                    />
                    <SocialContactFields
                      campaign={campaign}
                      settings={settings}
                      onUpdate={onUpdate}
                    />
                  </>
                )}
              </SettingsGroup>
              <SettingsGroup
                category="prices"
                title={t("Offer styles & savings")}
              >
                <OfferStyleControls
                  styleValue={campaign.offerStyle || "current"}
                  savingValue={campaign.savingMode || "amount"}
                  onStyleChange={(value: string) =>
                    onUpdate((draft: Campaign) => {
                      draft.offerStyle = value;
                    })
                  }
                  onSavingChange={(value: string) =>
                    onUpdate((draft: Campaign) => {
                      draft.savingMode = value;
                    })
                  }
                />
                <CategorySavingsControls
                  campaign={campaign}
                  onUpdate={onUpdate}
                />
                <PriceLogoPicker campaign={campaign} onUpdate={onUpdate} />
                <div className="cs-store-checkboxes">
                  {(["red", "blue", "blueBand", "saving"] as const).map(
                    (key) => (
                      <label key={key}>
                        <span>{t(`Price artwork color: ${key}`)}</span>
                        <input
                          type="color"
                          value={
                            campaign.pricePalette?.[key] ||
                            {
                              red: "#ef4023",
                              blue: "#243a6a",
                              blueBand: "#e7eae9",
                              saving: "#ef4023",
                            }[key]
                          }
                          onChange={(event) =>
                            onUpdate((draft: Campaign) => {
                              draft.pricePalette ??= {
                                red: "#ef4023",
                                blue: "#243a6a",
                                blueBand: "#e7eae9",
                                saving: "#ef4023",
                              };
                              draft.pricePalette[key] = event.target.value;
                            })
                          }
                        />
                      </label>
                    ),
                  )}
                </div>
              </SettingsGroup>
              <SettingsGroup category="logos" title={t("Logos & artwork")}>
                <BrandLogoManager campaign={campaign} onUpdate={onUpdate} />
                <BrochureAssetPicker campaign={campaign} onUpdate={onUpdate} />
              </SettingsGroup>
              <SettingsGroup category="prices" title={t("Payment message")}>
                <PaymentNoteEditor campaign={campaign} onUpdate={onUpdate} />
              </SettingsGroup>
            </PageSettingsTabs>
          </aside>
        )}
      </div>
      <div className="print-stack">
        <CoverPage campaign={campaign} settings={settings} />
        {pages.map((item) => (
          <ProductPage
            key={item.index}
            campaign={campaign}
            settings={settings}
            page={item}
          />
        ))}
        {hasStoresPage && (
          <StoresPage campaign={campaign} settings={settings} />
        )}
      </div>
      {moveTarget && (
        <Modal
          title={t("Move product")}
          kicker={t("BROCHURE POSITION")}
          onClose={() => setMoveTarget(null)}
        >
          <div className="cs-move-product-intro">
            <ProductImage product={moveTarget} />
            <div>
              <strong>{moveTarget.name}</strong>
              <small>
                {moveTarget.brand} · {moveTarget.code}
              </small>
            </div>
          </div>
          <Field label={t("Destination page")}>
            <SearchableSelect
              value={movePage}
              onChange={(event) => setMovePage(Number(event.target.value))}
            >
              <option value={-1}>{t("Cover")}</option>
              {pages.map((item) => (
                <option key={item.index} value={item.index}>
                  {t("Page")} {item.index + 2} · {item.products.length}{" "}
                  {t("products")}
                </option>
              ))}
              {pages.length === 0 && campaign.products.length > 1 && (
                <option value={0}>{t("First product page")}</option>
              )}
            </SearchableSelect>
          </Field>
          <Field label={t("Position on page")}>
            <SearchableSelect
              value={movePosition}
              onChange={(event) => setMovePosition(event.target.value)}
            >
              <option value="start">{t("At the beginning")}</option>
              <option value="end">{t("At the end")}</option>
            </SearchableSelect>
          </Field>
          <p className="cs-move-product-note">
            {t("If a page is full, its last product moves to the next page.")}
          </p>
          <div className="cs-modal-actions">
            <Button onClick={() => setMoveTarget(null)}>{t("Cancel")}</Button>
            <Button
              tone="primary"
              onClick={() => {
                placeProduct(moveTarget.code, movePage, movePosition);
                setMoveTarget(null);
              }}
            >
              {t("Move product")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
  return (
    <ImagePickerProvider
      settings={settings}
      onAddLayer={addImageLayer}
      onManageLayers={() => setShowLayers(true)}
    >
      {editor}
    </ImagePickerProvider>
  );
}

function enrichSavedCampaigns(saved: Campaign[], products: Product[]) {
  const byCode = new Map(
    products.map((product: Product) => [String(product.code), product]),
  );
  return (saved || []).map((item) =>
    repairCoverProductLayout({
      ...item,
      status: item.status || "in_progress",
      products: (item.products || []).map((product: Product) => ({
        ...product,
        warranty:
          product.warranty || byCode.get(String(product.code))?.warranty || "",
        specs: {
          ...(byCode.get(String(product.code))?.specs || {}),
          ...(product.specs || {}),
        },
      })),
    }),
  );
}

export default function App({
  initialUser,
  onAuthChange,
}: {
  initialUser?: SessionUser;
  onAuthChange?: (user: SessionUser | null, notice?: string) => void;
} = {}) {
  const [initialRoute] = useState(() => readWorkspaceRoute(window.location));
  const routeRef = useRef(initialRoute);
  const routeWriteMode = useRef<"push" | "replace">("push");
  const historyTracker = useRef({
    index: Number.isInteger(window.history.state?.neptunWorkspaceIndex)
      ? Number(window.history.state.neptunWorkspaceIndex)
      : 0,
    url:
      window.location.pathname + window.location.search + window.location.hash,
    restoring: false,
    allow: false,
  });
  const [navigationError, setNavigationError] = useState("");
  const [routePostId, setRoutePostId] = useState(initialRoute.postId);
  const [routePage, setRoutePage] = useState({
    campaignId: initialRoute.campaignId,
    index: initialRoute.pageIndex,
  });
  const routeComment = useRef(initialRoute.commentId);
  const routeCommentDocument = useRef(
    initialRoute.campaignId || initialRoute.postId,
  );
  const [language, setLocale] = useState(getLanguage);
  const [, setBrandLogoRevision] = useState(0);
  useEffect(() => {
    loadPreparedBrandLogos().then(() =>
      setBrandLogoRevision((value) => value + 1),
    );
  }, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editorMenuExpanded, setEditorMenuExpanded] = useState(false);
  function changeLanguage(next: string) {
    setLanguage(next);
    setLocale(next);
  }
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const [user, setUser] = useState<SessionUser | null>(initialUser || null);
  const access = useMemo(
    () => effectiveWorkspaceAccess(user || { role: "staff" }),
    [user],
  );
  const catalogAccessKey = JSON.stringify([
    access.canViewCatalog,
    access.catalogCategoryPaths,
  ]);
  useLiveSession(user, (next) => {
    setUser(next);
    onAuthChange?.(next);
  });
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [authReady, setAuthReady] = useState(Boolean(initialUser));
  const [authConfigured, setAuthConfigured] = useState(true);
  const [authError, setAuthError] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [settings, setSettings] = useState<Settings>(() =>
    resolveSettings(null),
  );
  const [settingsSnapshot, setSettingsSnapshot] =
    useState<SettingsSnapshot | null>(null);
  const [catalogSnapshot, setCatalog] = useState<Product[]>([]);
  const catalog = useMemo(
    () =>
      catalogSnapshot.filter((product) =>
        catalogPathAllowed(productCategoryPath(product), access),
      ),
    [catalogSnapshot, access],
  );
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [sourcePathsSnapshot, setCatalogSourcePaths] = useState<string[]>([]);
  const catalogSourcePaths = useMemo(
    () =>
      sourcePathsSnapshot.filter((path) =>
        catalogPathAllowed(path, access, true),
      ),
    [sourcePathsSnapshot, access],
  );
  const [activeId, setActiveId] = useState<string | null>(
    initialRoute.campaignId,
  );
  const [notificationTarget, setNotificationTarget] =
    useState<BrochureEditorProps["notificationTarget"]>(null);
  const [notificationPostTarget, setNotificationPostTarget] = useState<{
    postId: string;
    commentId: string | null;
  } | null>(
    initialRoute.postId
      ? { postId: initialRoute.postId, commentId: initialRoute.commentId }
      : null,
  );
  const notificationRequest = useRef<AbortController | null>(null);
  const emailLinkHandled = useRef(false);

  const campaignNow = useCampaignClock();
  const [section, setSectionValue] = useState<string>(initialRoute.section);
  useEffect(
    () => () => notificationRequest.current?.abort(),
    [section, activeId],
  );
  useEffect(() => {
    if (!user || emailLinkHandled.current) return;
    emailLinkHandled.current = true;
    const { campaignId, postId, commentId, pageIndex } = initialRoute;
    const id = postId || campaignId;
    if (!id) return;
    void openReviewNotification({
      id: `url:${id}:${commentId || ""}`,
      campaignId: id,
      documentKind: postId ? "post" : "campaign",
      pageIndex,
      commentId,
      openComments:
        Boolean(commentId) ||
        !new URLSearchParams(window.location.search).has("tab"),
      preserveNavigation:
        !commentId && new URLSearchParams(window.location.search).has("tab"),
    });
  }, [user?.id]);

  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const settingsDraftKey = user
    ? `neptun-settings-draft:${user.organizationId}:${user.id}`
    : undefined;
  const leaveSettingsRequest = useRef<Promise<boolean> | null>(null);
  async function canLeaveSettings() {
    if (settingsBusy) return false;
    if (!settingsDirty) return true;
    if (leaveSettingsRequest.current) return leaveSettingsRequest.current;
    const request = confirmDialog({
      title: t("Unsaved settings"),
      message: t(
        "You have unsaved changes in Settings. Discard them and leave?",
      ),
      confirmLabel: t("Discard changes"),
      cancelLabel: t("Keep editing"),
      danger: true,
    })
      .then((accepted) => {
        if (accepted && settingsDraftKey) {
          try {
            sessionStorage.removeItem(settingsDraftKey);
          } catch {
            /* Storage may be unavailable. */
          }
        }
        return accepted;
      })
      .finally(() => {
        leaveSettingsRequest.current = null;
      });
    leaveSettingsRequest.current = request;
    return request;
  }
  async function setSection(next: string) {
    if (
      (next === "catalog" && !access.canViewCatalog) ||
      (next === "social" && !access.canViewSocialPosts)
    )
      return;
    if (next === section) return true;
    if (section === "stores" && !(await canLeaveSettings())) return false;
    setSectionValue(next);
    return true;
  }
  const settingsNavigationGuard = useRef({
    section,
    settingsDirty,
    settingsBusy,
    canLeaveSettings,
  });
  settingsNavigationGuard.current = {
    section,
    settingsDirty,
    settingsBusy,
    canLeaveSettings,
  };
  const [socialSeed, setSocialSeed] = useState<SocialSeed | null>(null);
  const activeEditorRef = useRef({ activeId, section });
  activeEditorRef.current = { activeId, section };
  const [editorTab, setEditorTab] = useState<string>(initialRoute.editorTab);
  const rememberBrochurePage = React.useCallback(
    (index: number) => {
      if (
        routeRef.current.campaignId === activeId &&
        routeRef.current.pageIndex !== index
      )
        routeComment.current = null;
      setRoutePage((current) =>
        current.campaignId === activeId && current.index === index
          ? current
          : { campaignId: activeId, index },
      );
    },
    [activeId],
  );
  useEffect(() => {
    window.history.replaceState(
      {
        ...window.history.state,
        neptunWorkspaceIndex: historyTracker.current.index,
      },
      "",
      historyTracker.current.url,
    );
    const restore = async (event: PopStateEvent) => {
      const tracker = historyTracker.current;
      if (tracker.restoring) {
        tracker.restoring = false;
        return;
      }
      const next = readWorkspaceRoute(window.location);
      const targetUrl =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      const targetIndex = Number.isInteger(event.state?.neptunWorkspaceIndex)
        ? Number(event.state.neptunWorkspaceIndex)
        : tracker.index - 1;
      const guard = settingsNavigationGuard.current;
      if (
        !tracker.allow &&
        guard.section === "stores" &&
        (guard.settingsDirty || guard.settingsBusy)
      ) {
        const delta = tracker.index - targetIndex;
        tracker.restoring = delta !== 0;
        if (delta) window.history.go(delta);
        else
          window.history.replaceState(
            { ...window.history.state, neptunWorkspaceIndex: tracker.index },
            "",
            tracker.url,
          );
        if (!(await guard.canLeaveSettings())) return;
        tracker.allow = true;
        if (delta) {
          window.history.go(-delta);
          return;
        }
        window.history.replaceState(
          { ...window.history.state, neptunWorkspaceIndex: targetIndex },
          "",
          targetUrl,
        );
      }
      tracker.allow = false;
      tracker.index = targetIndex;
      tracker.url = targetUrl;
      setNavigationError("");
      routeRef.current = next;
      routeComment.current = next.commentId;
      routeCommentDocument.current = next.campaignId || next.postId;
      setSectionValue(next.section);
      setActiveId(next.campaignId);
      setRoutePostId(next.postId);
      setEditorTab(next.editorTab);
      setRoutePage({ campaignId: next.campaignId, index: next.pageIndex });
      setNotificationPostTarget(
        next.postId ? { postId: next.postId, commentId: next.commentId } : null,
      );
      setNotificationTarget(
        next.campaignId
          ? {
              id: `history:${crypto.randomUUID()}`,
              campaignId: next.campaignId,
              pageIndex: next.pageIndex,
              commentId: next.commentId,
              openComments: Boolean(next.commentId),
            }
          : null,
      );
      setModal(null);
    };
    const updated = () => {
      historyTracker.current.url =
        window.location.pathname +
        window.location.search +
        window.location.hash;
    };
    window.addEventListener("neptun:workspace-url-changed", updated);
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("neptun:workspace-url-changed", updated);
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    const next: WorkspaceRoute = {
      section: section as WorkspaceRoute["section"],
      campaignId: section === "editor" ? activeId : null,
      postId: section === "social" ? routePostId : null,
      pageIndex:
        section === "editor" && routePage.campaignId === activeId
          ? routePage.index
          : 0,
      editorTab:
        section === "editor" && editorTab === "products"
          ? "products"
          : "brochure",
      commentId:
        routeCommentDocument.current ===
        (section === "editor"
          ? activeId
          : section === "social"
            ? routePostId
            : null)
          ? routeComment.current
          : null,
    };
    if (!sameWorkspaceRoute(routeRef.current, next)) {
      const url = workspaceRouteUrl(next, window.location);
      if (
        url !==
        window.location.pathname + window.location.search + window.location.hash
      ) {
        const tracker = historyTracker.current;
        if (routeWriteMode.current === "replace")
          window.history.replaceState(
            { ...window.history.state, neptunWorkspaceIndex: tracker.index },
            "",
            url,
          );
        else {
          tracker.index += 1;
          window.history.pushState(
            { ...window.history.state, neptunWorkspaceIndex: tracker.index },
            "",
            url,
          );
        }
        tracker.url = url;
      }
      routeWriteMode.current = "push";
      routeRef.current = next;
    }
  }, [section, activeId, editorTab, routePage, routePostId, user?.id]);
  const [brochurePreviewVersion, setBrochurePreviewVersion] = useState(0);
  const [modal, setModal] = useState<string | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [newBusy, setNewBusy] = useState(false);
  const [photoPreparationStage, setPhotoPreparationStage] = useState<{
    campaignId: string;
    productCodes: string[];
    busy: boolean;
    error?: string;
    cacheLookupFailed?: boolean;
  } | null>(null);
  const photoPreparationRun = useRef(0);
  useEffect(() => {
    photoPreparationRun.current += 1;
    setPhotoPreparationStage(null);
  }, [user?.id]);
  const [aiTask, setAiTask] = useState<CampaignReviewTask | null>(null);
  const [aiDestination, setAiDestination] = useState("manual");
  const activeImageSearches = useRef(new Set<string>());
  const [detail, setDetail] = useState<DetailSelection | null>(null);
  const [imageEditCode, setImageEditCode] = useState<string | null>(null);
  const [screenEditCode, setScreenEditCode] = useState<string | null>(null);
  const [screenEditSource, setScreenEditSource] = useState<string>("");
  const [priceEdit, setPriceEdit] = useState<{
    code: string;
    focusSavings?: boolean;
  } | null>(null);
  const [toast, setToast] = useState("");
  const {
    campaigns,
    setCampaigns,
    updateCampaign,
    undoCampaign,
    redoCampaign,
    historyCounts,
    interactionHandlers,
  } = useCampaignEditHistory({
    activeId,
    enabled: section === "editor" && !photoPreparationStage,
    persist: saveCampaign,
    onError: (error: unknown) => {
      console.error(error);
      setToast(errorMessage(error));
    },
  });
  const latestCampaigns = useRef(campaigns);
  latestCampaigns.current = campaigns;
  const productPhotoQueue = useRef(createProductImagePreparationQueue());
  const failedPhotoTargets = useRef(new Map<string, ProductPhotoTarget>());
  const cachedPhotoLookupFailures = useRef(new Set<string>());
  useEffect(() => cachedPhotoLookupFailures.current.clear(), [user?.id]);
  const [photoProgress, setPhotoProgress] = useState<
    Record<string, Record<string, PhotoProgressItem>>
  >({});
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCodeQuery, setCatalogCodeQuery] = useState("");
  const catalogCategoryInitialized = useRef(false);
  const [catalogSelection, setCatalogSelection] = useState({
    categoryPath: "",
    brand: "",
    availability: "all",
  });
  const [catalogVisible, setCatalogVisible] = useState(60);
  useEffect(() => {
    if (
      (section === "catalog" && !access.canViewCatalog) ||
      (section === "social" && !access.canViewSocialPosts) ||
      (["users", "activity"].includes(section) &&
        user &&
        !canManageUsers(user)) ||
      (section === "insights" && user?.role !== "superadmin")
    ) {
      routeWriteMode.current = "replace";
      setSectionValue("campaigns");
    }
    if (!access.canViewSocialPosts) setSocialSeed(null);
    if (!access.canDisableBrochures) setDeleteTarget(null);
    if (!access.canViewCatalog)
      setModal((current) => (current === "manual" ? null : current));
    setDetail((current) =>
      current &&
      !current.editable &&
      !catalogPathAllowed(productCategoryPath(current.product), access)
        ? null
        : current,
    );
  }, [access, section, user]);
  const [pendingPrintId, setPendingPrintId] = useState<string | null>(null);
  const [exportId, setExportId] = useState<string | null>(null);
  const [exportPage, setExportPage] = useState(0);
  React.useLayoutEffect(() => {
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  }, [section, activeId]);
  useEffect(() => {
    if (initialUser) return;
    let active = true;
    getSession()
      .then(({ configured, user: sessionUser }) => {
        if (!active) return;
        setAuthConfigured(configured);
        setUser(sessionUser);
        onAuthChange?.(sessionUser);
      })
      .catch((error) => {
        if (active) setAuthError(errorMessage(error));
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void getMembers()
      .then((result) => {
        if (!controller.signal.aborted) setMembers(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          console.error("Could not load team members:", error);
      });
    // Saved brochures must not wait behind all pages of the source catalog.
    void getCampaigns(controller.signal)
      .then((saved) => {
        if (controller.signal.aborted) return;
        setCampaigns((current) =>
          mergeCampaignSnapshots(
            current,
            enrichSavedCampaigns(saved, []),
            activeEditorRef.current.activeId,
            activeEditorRef.current.section === "editor",
          ),
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) setToast(errorMessage(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) setCampaignsLoading(false);
      });
    return () => controller.abort();
  }, [user?.email]);
  useEffect(() => {
    setSettingsSnapshot(null);
    if (!user) return;
    const controller = new AbortController();
    // Settings has its own request: long brochure lists must not hold it back.
    void getSettingsSnapshot(controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted) return;
        setSettings(resolveSettings(snapshot.settings));
        setSettingsSnapshot(snapshot);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setToast(errorMessage(error));
      });
    return () => controller.abort();
  }, [user?.id, user?.organizationId]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setCatalog([]);
    setCatalogSourcePaths([]);
    catalogCategoryInitialized.current = false;
    setCatalogSelection({ categoryPath: "", brand: "", availability: "all" });
    if (!access.canViewCatalog) {
      setCatalogLoading(false);
      return () => controller.abort();
    }
    setCatalogLoading(true);
    void catalogFacets(controller.signal)
      .then((facets) => {
        if (!controller.signal.aborted)
          setCatalogSourcePaths(
            facets.sourceCategories.map((category) => category.categoryPath),
          );
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          console.error("Could not load source categories:", error);
      });
    void loadCatalog(controller.signal)
      .then((products) => {
        if (controller.signal.aborted) return;
        setCatalog(products);
        setCampaigns((current) => enrichSavedCampaigns(current, products));
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          console.error("Could not load product catalog:", error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setCatalogLoading(false);
      });
    return () => controller.abort();
  }, [user?.email, catalogAccessKey]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    let disposed = false;
    let refreshing = false;
    const refresh = async () => {
      const focused = document.activeElement;
      if (
        disposed ||
        refreshing ||
        focused?.matches?.("input, textarea, [contenteditable=true]") ||
        hasPendingSaves()
      )
        return;
      refreshing = true;
      const navigation = activeEditorRef.current;
      try {
        const latest = await getCampaigns(controller.signal);
        if (disposed || hasPendingSaves()) return;
        const active =
          navigation.section === "editor"
            ? latestCampaigns.current.find(
                (item) => item.id === navigation.activeId,
              )
            : undefined;
        const result = await confirmMissingCampaign(
          latest,
          active,
          Boolean(
            active && (active.version || hasAcknowledgedCampaign(active.id)),
          ),
          (id) => getCampaign(id, controller.signal),
        );
        if (
          disposed ||
          hasPendingSaves() ||
          navigation.activeId !== activeEditorRef.current.activeId ||
          navigation.section !== activeEditorRef.current.section
        )
          return;
        const unavailable =
          navigation.section === "editor" &&
          Boolean(
            result.confirmedMissingId ||
            result.remote.find((item) => item.id === navigation.activeId)
              ?.disabledAt,
          );
        setCampaigns((current) =>
          mergeCampaignSnapshots(
            current,
            enrichSavedCampaigns(result.remote, catalog),
            navigation.activeId,
            navigation.section === "editor",
            result.confirmedMissingId === navigation.activeId,
          ),
        );
        if (unavailable) {
          setActiveId(null);
          setSectionValue("campaigns");
          setModal((value) => (value === "create" ? value : null));
          setDetail((value) => (value?.editable ? null : value));
          setImageEditCode(null);
          setScreenEditCode(null);
          setPriceEdit(null);
          setAiTask(null);
          setExportId((id) => (id === navigation.activeId ? null : id));
          setPendingPrintId(null);
          setToast(
            language === "sq"
              ? "Kjo fushatë nuk është më e disponueshme."
              : "This campaign is no longer available.",
          );
        }
      } catch (error) {
        if (!disposed) console.error(error);
      } finally {
        refreshing = false;
      }
    };
    const timer = setInterval(refresh, 15_000);
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [user?.email, catalog, activeId, section]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const storedCampaign = campaigns.find(
    (item) => item.id === activeId && !item.disabledAt,
  );
  const campaign = useMemo(
    () =>
      storedCampaign
        ? brochureColorVariantCampaign(storedCampaign)
        : undefined,
    [storedCampaign],
  );
  const imageEditProduct = campaign?.products.find(
    (product) => product.code === imageEditCode,
  );
  const screenEditProduct =
    campaign &&
    (campaignTelevisionPhotos(campaign).find(
      (product) =>
        String(product.code) === screenEditCode &&
        normalizeScreenPhotoSource(screenPhotoSource(product)) ===
          screenEditSource,
    ) ||
      campaign.products.find(
        (product: Product) => String(product.code) === screenEditCode,
      ) ||
      campaignTelevisions(campaign).find(
        (product: Product) => String(product.code) === screenEditCode,
      ));
  useEffect(() => {
    if (
      !pendingPrintId ||
      campaign?.id !== pendingPrintId ||
      section !== "editor" ||
      editorTab !== "brochure"
    )
      return;
    let cancelled = false;
    const previousTitle = document.title;
    const timer = requestAnimationFrame(async () => {
      const images = [
        ...document.querySelectorAll<HTMLImageElement>(".print-stack img"),
      ];
      await Promise.all(
        images.map((image) =>
          image.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
              }),
        ),
      );
      await document.fonts.ready;
      if (cancelled) return;
      document.title = `${campaign.name} · NEPTUN`;
      window.print();
      document.title = previousTitle;
      setPendingPrintId(null);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(timer);
      document.title = previousTitle;
    };
  }, [pendingPrintId, campaign?.id, campaign?.name, section, editorTab]);
  async function openReviewNotification(
    target: Pick<
      WorkspaceNotification,
      "id" | "campaignId" | "pageIndex" | "commentId" | "documentKind"
    > & { openComments?: boolean; preserveNavigation?: boolean },
  ) {
    if (section === "stores" && !(await canLeaveSettings())) return;
    if (target.documentKind === "post") {
      if (!access.canViewSocialPosts) {
        setToast(t("You do not have access to social posts."));
        return;
      }
      setRoutePostId(target.campaignId);
      routeComment.current = target.commentId;
      routeCommentDocument.current = target.campaignId;
      setNotificationPostTarget({
        postId: target.campaignId,
        commentId: target.commentId,
      });
      setModal(null);
      setSettingsDirty(false);
      setSectionValue("social");
      setMobileMenuOpen(false);
      return;
    }
    notificationRequest.current?.abort();
    const request = new AbortController();
    notificationRequest.current = request;
    try {
      const fresh = await getCampaign(target.campaignId, request.signal);
      if (request.signal.aborted) return;
      if (fresh.disabledAt) {
        if (activeEditorRef.current.activeId === target.campaignId)
          setNavigationError(t("This brochure has been deleted."));
        setToast(t("This brochure has been deleted."));
        return;
      }
      const thread = reviewCommentsForLayout(fresh).find(
        (item) => item.id === target.commentId,
      );
      setCampaigns((current) =>
        mergeCampaignSnapshots(
          current,
          current.some((item) => item.id === fresh.id)
            ? current.map((item) => (item.id === fresh.id ? fresh : item))
            : [fresh, ...current],
          activeId,
          section === "editor",
        ),
      );
      setNavigationError("");
      // An ordinary refreshed editor URL is already restored before data loads.
      // A late validation response must not replay its initial page or tab over
      // a newer choice the user made while the request was in progress.
      if (target.preserveNavigation) return;
      setNotificationTarget({
        id: `${target.id}:${crypto.randomUUID()}`,
        campaignId: fresh.id,
        openComments: target.openComments,
        pageIndex: thread?.pageIndex ?? target.pageIndex ?? 0,
        commentId: target.commentId,
      });
      setActiveId(fresh.id);
      setRoutePage({
        campaignId: fresh.id,
        index: thread?.pageIndex ?? target.pageIndex ?? 0,
      });
      routeComment.current = target.commentId;
      routeCommentDocument.current = target.campaignId;
      setEditorTab("brochure");
      setModal(null);
      setSettingsDirty(false);
      setSectionValue("editor");
      setMobileMenuOpen(false);
    } catch (error) {
      if (!request.signal.aborted) {
        const requestedEditor =
          activeEditorRef.current.section === "editor" &&
          activeEditorRef.current.activeId === target.campaignId;
        const message = requestedEditor
          ? t(
              "This brochure could not be opened. It may be unavailable or you may not have access.",
            )
          : errorMessage(error);
        if (requestedEditor) setNavigationError(message);
        setToast(message);
      }
    }
  }
  async function runReviewAction(
    action: string,
    details: Record<string, JsonValue | undefined> = {},
  ) {
    if (!activeId) return false;
    try {
      const serializedDetails = Object.fromEntries(
        Object.entries(details).filter(
          (entry): entry is [string, JsonValue] => entry[1] !== undefined,
        ),
      );
      const updated = await reviewCampaign(activeId, action, {
        ...serializedDetails,
        language: getLanguage(),
      });
      window.dispatchEvent(new Event("neptun:notifications-updated"));
      setCampaigns((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      return true;
    } catch (error) {
      setToast(errorMessage(error));
      return false;
    }
  }
  function openAiReview(destination = "manual") {
    if (!campaign) return;
    setAiTask(startCampaignAiReview(campaign, destination));
    setAiDestination(destination);
    setModal("ai");
  }
  function goToBrochure() {
    setEditorTab("brochure");
  }
  function openScreenEditor(product: Product) {
    if (!campaign) return;
    const television = campaignTelevisionPhoto(campaign, product);
    setScreenEditCode(String(television.code));
    setScreenEditSource(
      normalizeScreenPhotoSource(screenPhotoSource(television)),
    );
  }
  function forgetProductPhotoWork(campaignId: string, keys: string[]) {
    const removed = new Set(keys);
    setPhotoProgress((current) => ({
      ...current,
      [campaignId]: Object.fromEntries(
        Object.entries(current[campaignId] || {}).filter(
          ([key]) => !removed.has(key),
        ),
      ),
    }));
  }
  function cancelQueuedProductPhotos(
    campaignId: string,
    targets?: ProductPhotoTarget[],
  ) {
    const cancelled = productPhotoQueue.current.cancelQueued(
      campaignId,
      targets,
    );
    if (cancelled.length)
      forgetProductPhotoWork(
        campaignId,
        cancelled.map((target) => target.key),
      );
  }
  function trackProductPhotoWork(
    campaignId: string,
    key: string,
    state: PhotoProgressItem["state"],
    retry?: { attempt: number; limit: number },
  ) {
    setPhotoProgress((current) => {
      const item = current[campaignId]?.[key];
      return item
        ? {
            ...current,
            [campaignId]: {
              ...current[campaignId],
              [key]: {
                ...item,
                state,
                retryAttempt: retry?.attempt,
                retryLimit: retry?.limit,
              },
            },
          }
        : current;
    });
  }
  async function prepareProductPhotos(
    snapshot: Campaign,
    products = snapshot.products,
    retryFailed = false,
    options: ProductPhotoPreparationOptions = {},
  ) {
    // Only an intentional import/add or preparation action may purchase work.
    // Opening a campaign, switching tabs and refreshing never enqueue it.
    if (!options.userRequested) return Promise.resolve([]);
    const workOptions = { ...options, ...(retryFailed ? { force: true } : {}) };
    if (retryFailed && !options.force) {
      workOptions.targetKeys = [...failedPhotoTargets.current.values()]
        .filter(
          (target) =>
            target.campaignId === snapshot.id &&
            products.some((product) => product.code === target.offerCode) &&
            currentProductPhotoTarget(snapshot, target) &&
            (!options.targetKeys ||
              options.targetKeys.includes(productPhotoSelectionKey(target))),
        )
        .map(productPhotoSelectionKey);
    }
    let pendingTargets = productImagePreparationTargets(
      snapshot,
      products,
      workOptions,
    );
    const reusedOutcomes: PhotoOutcome[] = [];
    if (!workOptions.force) {
      const liveCampaign = latestCampaigns.current.find(
        (item) => item.id === snapshot.id,
      );
      const candidates = pendingTargets.filter(
        (target) =>
          currentProductPhotoTarget(liveCampaign, target) &&
          !productPhotoQueue.current.has(target.key) &&
          !productPhotoQueue.current.hasTarget(target) &&
          !failedPhotoTargets.current.has(target.key),
      );
      if (candidates.length) {
        let reusedSnapshot: Campaign | undefined;
        setPhotoProgress((current) => ({
          ...current,
          [snapshot.id]: {
            ...current[snapshot.id],
            ...Object.fromEntries(
              candidates.map((target) => [
                target.key,
                {
                  key: target.key,
                  code: target.offerCode,
                  name: target.request.name,
                  state: "checking" as const,
                },
              ]),
            ),
          },
        }));
        try {
          const cached = await reusableProductPhotos(candidates);
          cachedPhotoLookupFailures.current.delete(snapshot.id);
          if (cached.size) {
            const applied: ProductPhotoTarget[] = [];
            const changed = updateCampaign(
              (draft) => {
                for (const target of candidates) {
                  const result = cached.get(target.key);
                  if (
                    result &&
                    applyPreparedProductPhoto(draft, target, result)
                  )
                    applied.push(target);
                }
              },
              { id: snapshot.id, group: `product-photos:${snapshot.id}` },
            );
            for (const target of applied)
              trackProductPhotoWork(snapshot.id, target.key, "saving");
            if (changed?.changed) await changed.saved;
            reusedSnapshot = changed?.campaign;
            for (const target of applied) {
              failedPhotoTargets.current.delete(target.key);
              trackProductPhotoWork(snapshot.id, target.key, "ready");
              reusedOutcomes.push({ ok: true, target });
            }
          }
        } catch (error) {
          // If saved photos cannot be checked, do not silently purchase work.
          cachedPhotoLookupFailures.current.add(snapshot.id);
          for (const target of candidates)
            trackProductPhotoWork(snapshot.id, target.key, "failed");
          throw new SavedPhotoLookupError(
            t(
              "Saved photos could not be checked. Try again before preparing new versions.",
            ),
            { cause: error },
          );
        }
        const current = latestCampaigns.current.find(
          (item) => item.id === snapshot.id,
        );
        if (!current) {
          forgetProductPhotoWork(
            snapshot.id,
            candidates.map((target) => target.key),
          );
          return reusedOutcomes;
        }
        snapshot = reusedSnapshot || current;
        const codes = new Set(products.map((product) => product.code));
        products = snapshot.products.filter((product) =>
          codes.has(product.code),
        );
        const reusedKeys = new Set(
          reusedOutcomes.map((outcome) => outcome.target.key),
        );
        // Only exact sources checked above may proceed to paid work. A newly
        // selected photo gets its own cache check on the next explicit action.
        pendingTargets = candidates.filter(
          (target) =>
            !reusedKeys.has(target.key) &&
            currentProductPhotoTarget(current, target),
        );
        const settled = new Set([
          ...pendingTargets.map((target) => target.key),
          ...reusedKeys,
        ]);
        forgetProductPhotoWork(
          snapshot.id,
          candidates
            .filter((target) => !settled.has(target.key))
            .map((target) => target.key),
        );
      }
    }
    if (workOptions.force) {
      pendingTargets = pendingTargets.filter(
        (target) => !productPhotoQueue.current.isRunningTarget(target),
      );
      if (!pendingTargets.length) return [];
      cancelQueuedProductPhotos(snapshot.id, pendingTargets);
      const restoringKeys = pendingTargets.map((target) => target.key);
      setPhotoProgress((current) => ({
        ...current,
        [snapshot.id]: {
          ...current[snapshot.id],
          ...Object.fromEntries(
            pendingTargets.map((target) => [
              target.key,
              {
                key: target.key,
                code: target.offerCode,
                name: target.request.name,
                image: target.source,
                state: "saving" as const,
              },
            ]),
          ),
        },
      }));
      const rejected = new Map(
        pendingTargets.map((target) => [
          productPhotoSelectionKey(target),
          target.expectedImage,
        ]),
      );
      const selectedKeys = pendingTargets.map(productPhotoSelectionKey);
      const changed = updateCampaign(
        (draft) => {
          for (const target of pendingTargets) {
            const current = currentProductPhotoTarget(draft, target);
            if (!current) continue;
            const { offer, product } = current;
            const oldImage = product.image;
            Object.assign(product, discardPreparedProductPhoto(product));
            product.imageChoices = product.imageChoices?.filter(
              (image) => image !== oldImage || image === product.image,
            );
            if (target.memberCode) {
              offer.productArtworks = offer.productArtworks?.map((artwork) =>
                artwork.type === "bundle-product" &&
                artwork.memberCode === target.memberCode &&
                !artwork.usesPrimaryImage
                  ? { ...artwork, image: product.image }
                  : artwork,
              );
              if (
                offer.bundleProducts?.[0] === product &&
                offer.image === oldImage
              )
                Object.assign(
                  offer,
                  discardPreparedProductPhoto({
                    ...offer,
                    aiOriginalImage: target.source,
                  }),
                );
            }
          }
        },
        { id: snapshot.id, group: `product-photos:${snapshot.id}` },
      );
      if (changed) {
        try {
          await changed.saved;
        } catch (error) {
          for (const key of restoringKeys)
            trackProductPhotoWork(snapshot.id, key, "failed");
          setToast(errorMessage(error));
          return [];
        }
        snapshot = changed.campaign;
        const codes = new Set(products.map((product) => product.code));
        products = snapshot.products.filter((product) =>
          codes.has(product.code),
        );
      }
      pendingTargets = productImagePreparationTargets(snapshot, products, {
        ...workOptions,
        targetKeys: selectedKeys,
      });
      for (const target of pendingTargets) {
        const previous = rejected.get(productPhotoSelectionKey(target));
        if (previous && previous !== target.source)
          target.request.rejectedImage = previous;
        target.key = JSON.stringify([
          target.campaignId,
          target.offerCode,
          target.memberCode || "",
          target.expectedImage,
          target.request,
        ]);
      }
      for (const [key, target] of failedPhotoTargets.current)
        if (
          target.campaignId === snapshot.id &&
          selectedKeys.includes(productPhotoSelectionKey(target))
        )
          failedPhotoTargets.current.delete(key);
      forgetProductPhotoWork(snapshot.id, restoringKeys);
    }
    const targets = pendingTargets.filter(
      (target) =>
        !productPhotoQueue.current.has(target.key) &&
        !productPhotoQueue.current.hasTarget(target) &&
        (retryFailed || !failedPhotoTargets.current.has(target.key)),
    );
    if (!targets.length) return reusedOutcomes;
    const retries = new Set(
      retryFailed
        ? targets
            .filter((target) => failedPhotoTargets.current.has(target.key))
            .map((target) => target.key)
        : [],
    );
    for (const target of targets) failedPhotoTargets.current.delete(target.key);
    setPhotoProgress((current) => ({
      ...current,
      [snapshot.id]: {
        ...(Object.values(current[snapshot.id] || {}).some(
          (item) =>
            item.state === "queued" ||
            item.state === "checking" ||
            item.state === "preparing" ||
            item.state === "retrying" ||
            item.state === "saving",
        )
          ? current[snapshot.id]
          : {}),
        ...Object.fromEntries(
          targets.map((target) => [
            target.key,
            {
              key: target.key,
              code: target.offerCode,
              name: target.request.name,
              image: target.source,
              state: "queued" as const,
            },
          ]),
        ),
      },
    }));
    const jobs = targets.map((target) =>
      productPhotoQueue.current
        .enqueue(
          target,
          async (preparedTarget, result) => {
            let applied = false;
            const changed = updateCampaign(
              (draft) => {
                applied = applyPreparedProductPhoto(
                  draft,
                  preparedTarget,
                  result,
                );
              },
              { id: snapshot.id, group: `product-photos:${snapshot.id}` },
            );
            if (!applied) return false;
            if (changed?.changed) await changed.saved;
            return true;
          },
          {
            retry: retries.has(target.key),
            priority: Boolean(workOptions.force),
            shouldRun: (queuedTarget) =>
              Boolean(
                currentProductPhotoTarget(
                  latestCampaigns.current.find(
                    (item) => item.id === snapshot.id,
                  ),
                  queuedTarget,
                ),
              ),
            onPhase: (phase, retry) =>
              trackProductPhotoWork(snapshot.id, target.key, phase, retry),
          },
        )
        .then((outcome) => {
          if (outcome.cancelled) {
            failedPhotoTargets.current.delete(target.key);
            if (!productPhotoQueue.current.has(target.key))
              forgetProductPhotoWork(snapshot.id, [target.key]);
            return outcome;
          }
          const currentCampaign = latestCampaigns.current.find(
            (item) => item.id === snapshot.id,
          );
          if (!outcome.ok && currentProductPhotoTarget(currentCampaign, target))
            failedPhotoTargets.current.set(target.key, target);
          else failedPhotoTargets.current.delete(target.key);
          trackProductPhotoWork(
            snapshot.id,
            target.key,
            outcome.ok
              ? "ready"
              : outcome.usingOriginal
                ? "original"
                : "failed",
          );
          return outcome;
        }),
    );
    return Promise.all(jobs).then((outcomes) => {
      const currentCampaign = latestCampaigns.current.find(
        (item) => item.id === snapshot.id,
      );
      for (const outcome of outcomes)
        if (
          !outcome.ok &&
          !outcome.cancelled &&
          currentProductPhotoTarget(currentCampaign, outcome.target)
        )
          failedPhotoTargets.current.set(outcome.target.key, outcome.target);
      for (const [key, target] of failedPhotoTargets.current)
        if (
          target.campaignId === snapshot.id &&
          !currentProductPhotoTarget(currentCampaign, target)
        )
          failedPhotoTargets.current.delete(key);
      const failed = [...failedPhotoTargets.current.values()].some(
        (target) => target.campaignId === snapshot.id,
      );
      if (
        failed &&
        outcomes.some(
          (outcome) =>
            !outcome.ok && !outcome.cancelled && !outcome.usingOriginal,
        )
      )
        setToast(t("Some product photos could not be prepared. Try again."));
      return [...reusedOutcomes, ...outcomes];
    });
  }
  async function finishAiReview(proposals: AiProposal[], acceptText: boolean) {
    if (!campaign) return;
    const result = updateCampaign(
      (draft: Campaign) => {
        applyAiProposals(
          draft,
          acceptText
            ? proposals
            : proposals
                .filter((item: { type: string }) => item.type === "image")
                .map((item) => ({ ...item, approved: false })),
        );
        if (aiDestination !== "images")
          recordTextReview(
            draft,
            proposals,
            aiTask?.getSnapshot().checkedText ?? [],
          );
      },
      { group: null },
    );
    if (!result) return;
    try {
      const saved = await result.saved;
      if (aiDestination === "complete") {
        const completed = await reviewCampaign(saved.id, "complete");
        setCampaigns((current) =>
          current.map((item) => (item.id === completed.id ? completed : item)),
        );
      }
    } catch (error) {
      setToast(errorMessage(error));
      return;
    }
    setModal(null);
    if (
      aiDestination === "brochure" ||
      aiDestination === "print" ||
      aiDestination === "export"
    )
      setEditorTab("brochure");
    if (aiDestination === "print") setPendingPrintId(activeId);
    if (aiDestination === "export") setExportId(activeId);
    setToast(
      t(
        aiDestination === "complete"
          ? "Campaign completed after AI review."
          : "AI review saved.",
      ),
    );
  }
  async function waitForPhotoWork(tasks: Promise<PhotoOutcome[]>[]) {
    // A failed save must not release the dialog while other paid work is still
    // running. Every task is bounded by the existing AI request/job timeouts.
    const settled = await Promise.allSettled(tasks);
    const rejected = settled.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") throw rejected.reason;
    return settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
  }
  function prepareBeforeOpeningBrochure(
    snapshot: Campaign,
    products: Product[],
    searches: MissingImageTarget[],
    saved: Promise<unknown>,
    retry = false,
    options: { retrySearch?: boolean } = {},
  ) {
    if (!products.length) return;
    const run = ++photoPreparationRun.current;
    const productCodes = products.map((product) => String(product.code));
    setPhotoPreparationStage({
      campaignId: snapshot.id,
      productCodes,
      busy: true,
    });
    void (async () => {
      try {
        await saved;
        if (run !== photoPreparationRun.current) return;
        const searchingKeys = new Set(searches.map(productPhotoSelectionKey));
        const existingPhotoKeys = productImagePreparationTargets(
          snapshot,
          products,
          { force: retry },
        )
          .map(productPhotoSelectionKey)
          .filter((key) => !searchingKeys.has(key));
        const outcomes = await waitForPhotoWork([
          prepareProductPhotos(snapshot, products, retry, {
            userRequested: true,
            targetKeys: existingPhotoKeys,
          }),
          searchImportedImages(
            searches,
            snapshot.id,
            options.retrySearch ?? retry,
            true,
          ),
        ]);
        if (run !== photoPreparationRun.current) return;
        const current =
          latestCampaigns.current.find((item) => item.id === snapshot.id) ||
          snapshot;
        const selected = current.products.filter((product) =>
          productCodes.includes(String(product.code)),
        );
        const missing = selected
          .flatMap((product) =>
            product.bundleProducts?.length ? product.bundleProducts : [product],
          )
          .some(
            (product) =>
              !product.image && !product.localImage && !product.imageUrl,
          );
        if (
          missing ||
          productImagePreparationTargets(current, selected).length > 0 ||
          outcomes.some((outcome) => !outcome.ok && !outcome.cancelled)
        )
          throw new Error(
            t("Some product photos could not be prepared. Try again."),
          );
        setPhotoPreparationStage(null);
        setEditorTab("brochure");
      } catch (error) {
        if (run !== photoPreparationRun.current) return;
        setPhotoPreparationStage({
          campaignId: snapshot.id,
          productCodes,
          busy: false,
          error: errorMessage(error),
          cacheLookupFailed: error instanceof SavedPhotoLookupError,
        });
      }
    })();
  }
  function createCampaign(item: Campaign) {
    if (item.products.some((product) => Number.isInteger(product.brochurePage)))
      materializeProductPages(item);
    const searches = missingImageTargets(item.products).filter((target) =>
      startMissingImageSearch(item, target),
    );
    setCampaigns((current) => [item, ...current]);
    const saved = saveCampaign(item);
    if (item.products.length)
      prepareBeforeOpeningBrochure(item, item.products, searches, saved);
    else void saved.catch((error: unknown) => setToast(errorMessage(error)));
    setActiveId(item.id);
    setSection("editor");
    setEditorTab("brochure");
    setModal(null);
    setToast(
      t(
        item.products.length
          ? "Campaign created. Preparing product photos…"
          : "Campaign created. Add products when you are ready.",
      ),
    );
  }
  async function searchImportedImages(
    targets: MissingImageTarget[],
    campaignId: string,
    retry = false,
    prepareFound = true,
  ) {
    for (const target of targets)
      activeImageSearches.current.add(target.requestId);
    const preparations: Promise<PhotoOutcome[]>[] = [];
    try {
      await findMissingProductImages(
        targets,
        (target, result) => {
          let applied = false;
          const updated = updateCampaign(
            (draft: Campaign) => {
              applied = finishMissingImageSearch(draft, target, result);
            },
            {
              id: campaignId,
              group: `missing-images:${campaignId}:${targets[0]?.requestId || ""}`,
            },
          );
          if (applied && updated) {
            const preparation = updated.saved.then(() =>
              prepareFound && !(result instanceof Error) && result.found
                ? prepareProductPhotos(
                    updated.campaign,
                    updated.campaign.products.filter(
                      (product) => product.code === target.offerCode,
                    ),
                    false,
                    {
                      userRequested: true,
                      targetKeys: [productPhotoSelectionKey(target)],
                    },
                  )
                : [],
            );
            // Observe rejection immediately while the remaining image searches
            // finish; waitForPhotoWork still reports it after every task settles.
            void preparation.catch(() => {});
            preparations.push(preparation);
          }
        },
        retry,
      );
      return await waitForPhotoWork(preparations);
    } finally {
      for (const target of targets)
        activeImageSearches.current.delete(target.requestId);
    }
  }
  function findProductImage(offer: Product) {
    if (!campaign) return;
    const targets = missingImageTargets([offer], true);
    const started: MissingImageTarget[] = [];
    const updated = updateCampaign((draft: Campaign) => {
      for (const target of targets) {
        const liveOffer = draft.products.find(
          (product) => product.code === target.offerCode,
        );
        const live = target.memberCode
          ? liveOffer?.bundleProducts?.find(
              (member) => member.code === target.memberCode,
            )
          : liveOffer;
        if (
          (!live?.imageSearch?.requestId ||
            !activeImageSearches.current.has(live.imageSearch.requestId)) &&
          startMissingImageSearch(draft, target)
        )
          started.push(target);
      }
    });
    if (!updated || !started.length) return;
    const retrySearch = targets.some((target) => {
      const member = target.memberCode
        ? offer.bundleProducts?.find(
            (product) => product.code === target.memberCode,
          )
        : offer;
      return ["not_found", "failed", "found"].includes(
        member?.imageSearch?.status || "",
      );
    });
    setImageEditCode(null);
    prepareBeforeOpeningBrochure(
      updated.campaign,
      updated.campaign.products.filter(
        (product) => product.code === offer.code,
      ),
      started,
      updated.saved,
      false,
      { retrySearch },
    );
  }
  function addProducts(
    products: Product[],
    skipped = 0,
    importOptions: ImportOptions | null = null,
  ) {
    const targets = missingImageTargets(products);
    const started: MissingImageTarget[] = [];
    const updated = updateCampaign((draft: Campaign) => {
      if (importOptions?.brochureImport) {
        const previousCover = coverProducts(draft).map((product) =>
          String(product.code),
        );
        const incomingCover = products
          .filter((product) => product.brochurePage === 1)
          .map((product) => String(product.code));
        if (JSON.stringify(previousCover) !== JSON.stringify(incomingCover)) {
          for (const key of Object.keys(draft.coverElementPlacements || {}))
            if (key.startsWith("product-"))
              delete draft.coverElementPlacements![key];
        }
        draft.products = mergeBrochureImportProducts(
          draft.products,
          products,
          importOptions.replaceImported !== false,
        );
        draft.coverProductCodes = products
          .filter((product: Product) => product.brochurePage === 1)
          .map((product: Product) => String(product.code));
        draft.brochureImportWarnings = importOptions.warnings || [];
        materializeProductPages(draft);
      } else {
        const byCode = new Map(draft.products.map((p) => [p.code, p]));
        products.forEach((product: Product) =>
          byCode.set(product.code, {
            ...byCode.get(product.code),
            ...retainPreparedProductPhoto(byCode.get(product.code), product),
          }),
        );
        draft.products = [...byCode.values()];
      }
      for (const target of targets) {
        const liveOffer = draft.products.find(
          (product) => product.code === target.offerCode,
        );
        const live = target.memberCode
          ? liveOffer?.bundleProducts?.find(
              (member) => member.code === target.memberCode,
            )
          : liveOffer;
        if (
          live?.imageSearch?.status !== "searching" &&
          startMissingImageSearch(draft, target)
        )
          started.push(target);
      }
    });
    if (updated) {
      const importedCodes = new Set(
        products.map((product) => String(product.code)),
      );
      prepareBeforeOpeningBrochure(
        updated.campaign,
        updated.campaign.products.filter((product) =>
          importedCodes.has(String(product.code)),
        ),
        started,
        updated.saved,
      );
    }
    setModal(null);
    setEditorTab("brochure");
    setBrochurePreviewVersion((version) => version + 1);
    setToast(
      `${products.length} ${t(products.length === 1 ? "product" : "products")} ${t(products.length === 1 ? "was added to campaign" : "were added to campaign")}${skipped ? ` · ${skipped} ${t(skipped === 1 ? "row not added" : "rows not added")}` : ""}.`,
    );
  }
  function duplicateCampaign(item: Campaign) {
    if (item.disabledAt) return;
    const copy = structuredClone(item);
    copy.id = crypto.randomUUID();
    copy.status = "in_progress";
    copy.reviewComments = [];
    copy.reviewHistory = [];
    copy.name += ` · ${t("Copy")}`;
    copy.createdAt = copy.updatedAt = new Date().toISOString();
    setCampaigns((current) => [copy, ...current]);
    saveCampaign(copy).catch((error: unknown) => setToast(errorMessage(error)));
    setToast(t("Campaign duplicated."));
  }
  async function confirmDeleteCampaign() {
    if (!deleteTarget || deleteBusy || !access.canDisableBrochures) return;
    setDeleteBusy(true);
    try {
      await removeCampaign(deleteTarget.id, deleteTarget.version);
      const disabled =
        user?.role === "superadmin"
          ? (await getCampaigns()).find((item) => item.id === deleteTarget.id)
          : undefined;
      setCampaigns((current) =>
        disabled
          ? current.map((item) => (item.id === disabled.id ? disabled : item))
          : current.filter((item) => item.id !== deleteTarget.id),
      );
      if (activeId === deleteTarget.id) setActiveId(null);
      setDeleteTarget(null);
      setToast(t("Campaign deleted."));
    } catch (error) {
      setToast(errorMessage(error));
    } finally {
      setDeleteBusy(false);
    }
  }
  async function enableCampaign(item: Campaign) {
    if (user?.role !== "superadmin" || restoringId) return;
    setRestoringId(item.id);
    try {
      const restored = await restoreCampaign(item);
      setCampaigns((current) =>
        current.map((value) => (value.id === restored.id ? restored : value)),
      );
      setToast(t("Campaign restored."));
    } catch (error) {
      setToast(errorMessage(error));
    } finally {
      setRestoringId(null);
    }
  }
  const catalogItems = useMemo(
    () =>
      catalogWithExcelProducts(catalog, campaigns).filter((product) =>
        catalogPathAllowed(productCategoryPath(product), access),
      ),
    [catalog, campaigns, access],
  );
  useEffect(() => {
    if (
      (!catalogItems.length && !catalogSourcePaths.length) ||
      catalogCategoryInitialized.current
    )
      return;
    catalogCategoryInitialized.current = true;
    setCatalogSelection(
      defaultCatalogSelection(catalogItems, catalogSourcePaths),
    );
  }, [catalogItems, catalogSourcePaths]);
  const catalogMatches = useMemo(
    () =>
      searchProducts(
        searchProductCodes(
          filterCatalog(catalogItems, catalogSelection),
          catalogCodeQuery,
        ),
        catalogQuery,
      ),
    [catalogItems, catalogQuery, catalogCodeQuery, catalogSelection],
  );
  const catalogResults = catalogMatches.slice(0, catalogVisible);
  if (!user)
    return (
      <div className="cs-signin">
        <div className="cs-signin-art">
          <img src={logo} alt="NEPTUN" />
          <div>
            <span>{t("CAMPAIGN STUDIO")}</span>
            <h1>
              {t("Every offer has")}
              <br />
              {t("a story to tell.")}
            </h1>
            <p>{t("From product data to a brochure ready to share.")}</p>
          </div>
        </div>
        <div className="cs-signin-panel">
          <LanguageSwitch language={language} onChange={changeLanguage} />
          <span className="cs-eyebrow">NEPTUN KOSOVO</span>
          <h2>
            {t("Welcome to")}
            <br />
            {t("your workspace.")}
          </h2>
          <p>
            {t(
              "Sign in with your Staff or PM account to see shared campaigns and reviews.",
            )}
          </p>
          {!authReady ? (
            <p>{t("Checking session…")}</p>
          ) : (
            <form
              className="cs-team-login"
              onSubmit={async (event) => {
                event.preventDefault();
                setLoginBusy(true);
                setAuthError("");
                try {
                  const result = await login(loginEmail, loginPassword);
                  setUser(result.user);
                  onAuthChange?.(result.user);
                  setLoginPassword("");
                } catch (error) {
                  setAuthError(errorMessage(error));
                } finally {
                  setLoginBusy(false);
                }
              }}
            >
              <label>
                {t("Email")}
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="staff@neptun-ks.com"
                />
              </label>
              <label>
                {t("Password")}
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                />
              </label>
              {authError && (
                <p className="cs-team-auth-error" role="alert">
                  {authError}
                </p>
              )}
              {!authConfigured && (
                <p className="cs-team-auth-error">
                  {t(
                    "Configure Staff and PM accounts in .env.local, then restart the app.",
                  )}
                </p>
              )}
              <Button
                type="submit"
                tone="primary"
                disabled={loginBusy || !authConfigured}
              >
                {loginBusy ? t("Signing in…") : t("Sign in to studio →")}
              </Button>
            </form>
          )}
          <small>
            {t("Shared campaigns and comments are saved on this local server.")}
          </small>
          <PromoAutomationCredit />
        </div>
      </div>
    );
  return (
    <div
      className={`campaign-app ${section === "editor" && !editorMenuExpanded ? "cs-navigation-compact" : ""}`}
      {...interactionHandlers}
    >
      <aside className={`cs-sidebar ${mobileMenuOpen ? "menu-open" : ""}`}>
        <div className="cs-sidebar-brand">
          <img src={logo} alt="NEPTUN" />
          <img
            className="cs-sidebar-brand-mark"
            src="/favicon.svg?v=white-n"
            alt="NEPTUN"
          />
          <span>{t("CAMPAIGN STUDIO")}</span>
        </div>
        <button
          className="cs-mobile-menu-toggle"
          type="button"
          aria-label={t(mobileMenuOpen ? "Close menu" : "Open menu")}
          aria-expanded={mobileMenuOpen}
          aria-controls="studio-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <NavIcon name={mobileMenuOpen ? "close" : "menu"} />
        </button>
        {section === "editor" && (
          <button
            type="button"
            className="cs-navigation-size-toggle"
            aria-expanded={editorMenuExpanded}
            aria-controls="studio-navigation"
            aria-label={t(
              editorMenuExpanded ? "Collapse navigation" : "Expand navigation",
            )}
            title={t(
              editorMenuExpanded ? "Collapse navigation" : "Expand navigation",
            )}
            onClick={() => setEditorMenuExpanded((value) => !value)}
          >
            <NavIcon name="menu" size={19} />
            <span>{t("Collapse navigation")}</span>
          </button>
        )}
        <nav className="cs-sidebar-nav" id="studio-navigation">
          {(
            [
              ["campaigns", "Campaigns"],
              ...(access.canViewCatalog
                ? [["catalog", "Product catalog"]]
                : []),
              ...(access.canViewSocialPosts
                ? [["social", "Social posts"]]
                : []),
              ["stores", "Settings"],
              ...(canManageUsers(user)
                ? [
                    ["users", "Team & access"],
                    ["activity", "Activity log"],
                  ]
                : []),
              ...(user.role === "superadmin"
                ? [["insights", "Usage & storage"]]
                : []),
            ] as [string, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={
                section === id || (section === "editor" && id === "campaigns")
                  ? "active"
                  : ""
              }
              aria-label={t(label)}
              title={t(label)}
              onClick={async () => {
                if (!(await setSection(id))) return;
                setActiveId(null);
                setMobileMenuOpen(false);
              }}
            >
              <NavIcon name={id} />
              <span className="cs-sidebar-nav-label">{t(label)}</span>
            </button>
          ))}
        </nav>
        <SidebarAccount
          user={user}
          onProfile={async () => {
            if (!(await setSection("profile"))) return;
            setActiveId(null);
            setMobileMenuOpen(false);
          }}
          onSignOut={async () => {
            if (section === "stores" && !(await canLeaveSettings())) return;
            await logout();
            setUser(null);
            onAuthChange?.(null);
            setCampaigns([]);
            setActiveId(null);
            setSectionValue("campaigns");
          }}
        />
      </aside>
      <main className="cs-content">
        <header className="cs-topbar">
          <div className="cs-breadcrumb">
            {t("Workspace")} <span>/</span>{" "}
            {section === "editor"
              ? campaign?.name
              : section === "campaigns"
                ? t("Campaigns")
                : section === "catalog"
                  ? t("Product catalog")
                  : section === "social"
                    ? t("Social posts")
                    : section === "users"
                      ? t("Team & access")
                      : section === "activity"
                        ? t("Activity log")
                        : section === "insights"
                          ? t("Usage & storage")
                          : section === "profile"
                            ? t("Profile & security")
                            : t("Settings")}
          </div>
          <div className="cs-topbar-right">
            {access.canViewCatalog && (
              <CatalogRefreshControl
                onUpdated={async () => {
                  const [products, facets] = await Promise.all([
                    loadCatalog(),
                    catalogFacets(),
                  ]);
                  setCatalog(products);
                  setCatalogSourcePaths(
                    facets.sourceCategories.map(
                      (category) => category.categoryPath,
                    ),
                  );
                }}
              />
            )}
            <span>NEPTUN KOSOVO</span>
            <NotificationBell onOpen={openReviewNotification} />
            <AppearanceToggle />
            <LanguageSwitch language={language} onChange={changeLanguage} />
            <div className="cs-avatar">N</div>
          </div>
        </header>
        {section === "campaigns" && (
          <CampaignLibrary
            campaigns={campaigns}
            settings={settings}
            onCreate={() => setModal("create")}
            onOpen={(id: string) => {
              setActiveId(id);
              setEditorTab("brochure");
              setSection("editor");
            }}
            onDuplicate={duplicateCampaign}
            onDelete={setDeleteTarget}
            canManageDisabled={user.role === "superadmin"}
            canDisable={access.canDisableBrochures}
            loading={campaignsLoading}
            restoringId={restoringId}
            onRestore={enableCampaign}
            onPrint={(id: string) => {
              setExportPage(0);
              setActiveId(id);
              setSection("editor");
              setEditorTab("brochure");
              setExportId(id);
            }}
          />
        )}
        {section === "catalog" && access.canViewCatalog && (
          <div className="cs-main-panel">
            <div className="cs-section-head">
              <div>
                <span className="cs-eyebrow">{t("PRODUCT SOURCE")}</span>
                <h1>{t("Product catalog")}</h1>
                <p>
                  {catalog.length}{" "}
                  {t("products · prices shown are regular catalog prices.")}
                </p>
              </div>
            </div>
            <CatalogNavigator
              products={catalogItems}
              sourcePaths={catalogSourcePaths}
              selection={catalogSelection}
              onChange={(value) => {
                catalogCategoryInitialized.current = true;
                setCatalogSelection(value);
                setCatalogVisible(60);
              }}
              onClear={() => {
                setCatalogQuery("");
                setCatalogCodeQuery("");
              }}
            >
              <div className="cs-catalog-searches">
                <label className="cs-catalog-search-field">
                  <span>{t("Search products")}</span>
                  <div className="cs-search cs-catalog-search">
                    <NavIcon name="search" />
                    <input
                      type="search"
                      value={catalogQuery}
                      onChange={(event) => {
                        if (
                          !catalogQuery.trim() &&
                          !catalogCodeQuery.trim() &&
                          event.target.value.trim()
                        )
                          setCatalogSelection({
                            categoryPath: "",
                            brand: "",
                            availability: "all",
                          });
                        setCatalogQuery(event.target.value);
                        setCatalogVisible(60);
                      }}
                      placeholder={t("Name, brand, model or category")}
                    />
                  </div>
                </label>
                <label className="cs-catalog-search-field">
                  <span>{t("Product codes only")}</span>
                  <div className="cs-search cs-catalog-search">
                    <span aria-hidden="true">#</span>
                    <input
                      type="search"
                      value={catalogCodeQuery}
                      onChange={(event) => {
                        if (
                          !catalogQuery.trim() &&
                          !catalogCodeQuery.trim() &&
                          event.target.value.trim()
                        )
                          setCatalogSelection({
                            categoryPath: "",
                            brand: "",
                            availability: "all",
                          });
                        setCatalogCodeQuery(event.target.value);
                        setCatalogVisible(60);
                      }}
                      placeholder={t("Enter or paste product codes")}
                    />
                  </div>
                </label>
              </div>
              <p className="cs-catalog-search-hint">
                {t(
                  "Search ignores case and spaces. Use commas to look up several codes; choose filters to narrow the results.",
                )}
              </p>
            </CatalogNavigator>
            {catalogLoading && (
              <p role="status" className="cs-catalog-loading">
                {t("Loading the complete product catalog…")}
              </p>
            )}
            <p className="cs-catalog-result-count" role="status">
              {catalogResults.length} {t("of")} {catalogMatches.length}{" "}
              {t("products shown")}
            </p>
            {!catalogLoading && !catalogMatches.length && (
              <div className="cs-empty-mini">
                {t("No matching products. Try another code or filter.")}{" "}
                <Button
                  onClick={() => {
                    setCatalogQuery("");
                    setCatalogCodeQuery("");
                    setCatalogSelection({
                      categoryPath: "",
                      brand: "",
                      availability: "all",
                    });
                    setCatalogVisible(60);
                  }}
                >
                  {t("Clear search")}
                </Button>
              </div>
            )}
            <div className="cs-catalog-grid">
              {catalogResults.map((product: Product) => (
                <button
                  type="button"
                  className="cs-catalog-card"
                  key={product.code}
                  onClick={() => {
                    const imported = product.catalogMissing
                      ? campaignContainingExcelProduct(campaigns, product.code)
                      : undefined;
                    if (imported) {
                      setActiveId(imported.campaign.id);
                      setSection("editor");
                      setEditorTab("brochure");
                      setDetail({ product: imported.offer, editable: true });
                    } else setDetail({ product, editable: false });
                  }}
                >
                  <div>
                    <ProductImage product={product} preferRemote />
                  </div>
                  <span>
                    {product.brand} · {product.code}
                  </span>
                  <strong>{product.name}</strong>
                  <MissingCatalogNotice product={product} variant="badge" />
                  <small title={product.categoryPath}>
                    {product.categoryPath || product.subcategory}
                  </small>
                  {product.sourceMissing && (
                    <span className="cs-source-missing">
                      {t(
                        "Kept in catalog · not found on neptun-ks.com at last sync",
                      )}
                    </span>
                  )}
                  <b>
                    {hasRegularPrice(product)
                      ? money(Number(product.regular))
                      : money(Number(product.sale))}{" "}
                    €
                  </b>
                </button>
              ))}
            </div>
            {catalogMatches.length > catalogVisible && (
              <div className="cs-catalog-more">
                <Button
                  onClick={() => setCatalogVisible((value) => value + 60)}
                >
                  {t("Show more products")} ↓
                </Button>
              </div>
            )}
          </div>
        )}
        {section === "social" && access.canViewSocialPosts && (
          <StudioPageBoundary onReturn={() => setSection("campaigns")}>
            <React.Suspense
              fallback={
                <div className="cs-main-panel cs-page-loading" role="status">
                  {language === "sq"
                    ? "Duke ngarkuar postimet sociale…"
                    : "Loading social posts…"}
                </div>
              }
            >
              <SocialStudio
                initialPostId={routePostId}
                onActivePostChange={setRoutePostId}
                focusedCommentId={notificationPostTarget?.commentId}
                user={user}
                members={members}
                canViewCatalog={access.canViewCatalog}
                settings={settings}
                catalog={catalog}
                campaigns={campaigns.filter((item) => !item.disabledAt)}
                canManageDisabled={user.role === "superadmin"}
                seed={socialSeed}
                onSeedUsed={() => setSocialSeed(null)}
              />
            </React.Suspense>
          </StudioPageBoundary>
        )}
        {section === "users" && canManageUsers(user) && (
          <UsersPage
            currentUser={user}
            onMembersChanged={() => {
              void getMembers()
                .then(setMembers)
                .catch((error) => setToast(errorMessage(error)));
            }}
          />
        )}
        {section === "profile" && (
          <ProfilePage
            user={user}
            onPasswordChanged={(message, signInRequired) => {
              if (signInRequired) {
                setUser(null);
                onAuthChange?.(null, message);
                setCampaigns([]);
                setActiveId(null);
                setSection("campaigns");
              } else setToast(message);
            }}
          />
        )}
        {section === "activity" && canManageUsers(user) && (
          <ActivityPage user={user} />
        )}
        {section === "insights" && user.role === "superadmin" && (
          <InsightsPage user={user} />
        )}
        {section === "stores" && (
          <SettingsPage
            canViewCatalog={access.canViewCatalog}
            initialSnapshot={settingsSnapshot}
            draftKey={settingsDraftKey}
            onSnapshotChange={setSettingsSnapshot}
            previewProducts={catalog}
            onSaved={setSettings}
            onDirtyChange={setSettingsDirty}
            onBusyChange={setSettingsBusy}
          />
        )}
        {section === "not-found" && (
          <div className="cs-main-panel cs-empty">
            <h2>{t("Page not found")}</h2>
            <Button onClick={() => setSection("campaigns")}>
              {t("All campaigns")}
            </Button>
          </div>
        )}
        {section === "editor" && !campaign && (
          <div className="cs-main-panel cs-empty">
            <h2>
              {t(
                navigationError
                  ? "Brochure unavailable"
                  : "Campaign is loading",
              )}
            </h2>
            <p>
              {navigationError ||
                t(
                  "Your campaign is being saved or refreshed. You can return to the campaign list and reopen it.",
                )}
            </p>
            <Button
              onClick={() => {
                setSection("campaigns");
                setActiveId(null);
              }}
            >
              {t("All campaigns")}
            </Button>
          </div>
        )}
        {section === "editor" && campaign && (
          <div className="cs-main-panel cs-editor">
            <CampaignEditorHeader
              campaign={campaign}
              pageCount={brochurePageCount(
                campaign,
                splitPages(campaign).length,
              )}
              now={campaignNow}
              onAllCampaigns={() => {
                setSection("campaigns");
                setActiveId(null);
              }}
              onNewCampaign={() => setModal("confirm-new")}
              onMakeSocial={
                access.canViewSocialPosts
                  ? () => {
                      setSocialSeed({
                        campaignId: campaign.id,
                        products: campaign.products.slice(0, 3),
                      });
                      setSection("social");
                    }
                  : undefined
              }
            >
              {(user.role === "staff" || canManageUsers(user)) &&
                ["in_progress", "changes_requested"].includes(
                  campaign.status || "in_progress",
                ) && (
                  <>
                    <button
                      type="button"
                      disabled={(campaign.reviewComments || []).some(
                        (comment) => !comment.fixed,
                      )}
                      onClick={() => runReviewAction("submit")}
                    >
                      {t("Send for PM review")}
                    </button>
                    <button
                      type="button"
                      disabled={(campaign.reviewComments || []).some(
                        (comment) => !comment.fixed,
                      )}
                      onClick={() => runReviewAction("complete")}
                    >
                      {t("Mark complete")}
                    </button>
                  </>
                )}
              {(user.role === "pm" || canManageUsers(user)) &&
                campaign.status === "in_review" && (
                  <button
                    type="button"
                    onClick={() => runReviewAction("complete")}
                  >
                    {t("Mark complete")}
                  </button>
                )}
              {(user.role === "staff" || canManageUsers(user)) &&
                campaign.status === "completed" && (
                  <button
                    type="button"
                    onClick={() => runReviewAction("reopen")}
                  >
                    {t("Continue editing")}
                  </button>
                )}
            </CampaignEditorHeader>
            <div className="cs-editor-tabs">
              <button
                type="button"
                className={editorTab === "brochure" ? "active" : ""}
                onClick={goToBrochure}
              >
                01 <span>{t("Brochure design")}</span>
              </button>
              <button
                type="button"
                className={editorTab === "products" ? "active" : ""}
                onClick={() => setEditorTab("products")}
              >
                02 <span>{t("Products & prices")}</span>
              </button>
              {photoPreparationStage?.campaignId !== campaign.id && (
                <PhotoPreparationProgress
                  variant="inline"
                  items={Object.values(photoProgress[campaign.id] || {})}
                  campaign={campaign}
                  onRetry={() =>
                    void prepareProductPhotos(
                      campaign,
                      campaign.products,
                      !cachedPhotoLookupFailures.current.has(campaign.id),
                      {
                        userRequested: true,
                      },
                    ).catch((error: unknown) => setToast(errorMessage(error)))
                  }
                  onCancelWaiting={() => cancelQueuedProductPhotos(campaign.id)}
                  onEdit={setImageEditCode}
                />
              )}
              <CampaignHistoryControls
                undoCount={historyCounts.undo}
                redoCount={historyCounts.redo}
                onUndo={undoCampaign}
                onRedo={redoCampaign}
                language={language}
              />
            </div>
            {photoPreparationStage?.campaignId === campaign.id ? (
              <PhotoPreparationModal
                campaign={campaign}
                items={Object.values(photoProgress[campaign.id] || {})}
                busy={photoPreparationStage.busy}
                error={photoPreparationStage.error}
                onRetry={() => {
                  const snapshot = structuredClone(campaign);
                  const products = snapshot.products.filter((product) =>
                    photoPreparationStage.productCodes.includes(
                      String(product.code),
                    ),
                  );
                  const searches = missingImageTargets(products).filter(
                    (target) => startMissingImageSearch(snapshot, target),
                  );
                  const changed = updateCampaign((draft) => {
                    for (const target of searches)
                      startMissingImageSearch(draft, target);
                  });
                  const next = changed?.campaign || snapshot;
                  prepareBeforeOpeningBrochure(
                    next,
                    next.products.filter((product) =>
                      photoPreparationStage.productCodes.includes(
                        String(product.code),
                      ),
                    ),
                    searches,
                    changed?.changed ? changed.saved : saveCampaign(next),
                    !photoPreparationStage.cacheLookupFailed,
                  );
                }}
                onOpenBrochure={() => {
                  setPhotoPreparationStage(null);
                  setEditorTab("brochure");
                }}
              />
            ) : (
              <>
                {editorTab === "products" ? (
                  <ProductEditor
                    canMakeSocial={access.canViewSocialPosts}
                    canUseCatalog={access.canViewCatalog}
                    campaign={campaign}
                    onUpdate={updateCampaign}
                    onImport={() => setModal("import")}
                    onManual={() => setModal("manual")}
                    onAiReview={() => openAiReview("manual")}
                    onReCut={() => setModal("repair-photos")}
                    onNext={goToBrochure}
                    onMakeSocial={(products: Product[]) => {
                      setSocialSeed({ campaignId: campaign.id, products });
                      setSection("social");
                    }}
                    onDetails={(product: Product) =>
                      setDetail({ product, editable: true })
                    }
                    onImageEdit={(product: Product) =>
                      setImageEditCode(String(product.code))
                    }
                  />
                ) : (
                  <BrochureEditor
                    canMakeSocial={access.canViewSocialPosts}
                    canUseCatalog={access.canViewCatalog}
                    key={`${campaign.id}-${brochurePreviewVersion}`}
                    campaign={campaign}
                    settings={settings}
                    user={user}
                    members={members}
                    onReviewAction={runReviewAction}
                    notificationTarget={notificationTarget}
                    initialPage={
                      routePage.campaignId === campaign.id ? routePage.index : 0
                    }
                    onPageChange={rememberBrochurePage}
                    onUpdate={updateCampaign}
                    onPreparePhotos={prepareProductPhotos}
                    onToast={setToast}
                    onAiReview={() => openAiReview("manual")}
                    onReCut={() => setModal("repair-photos")}
                    onAddProducts={() => setModal("manual")}
                    onImportProducts={() => setModal("import")}
                    onEditImage={(product: Product) =>
                      setImageEditCode(String(product.code))
                    }
                    onEditScreen={(product: Product) =>
                      openScreenEditor(product)
                    }
                    onEditDetails={(
                      product: Product,
                      focusDetailKey?: string,
                    ) => setDetail({ product, editable: true, focusDetailKey })}
                    onEditPrice={(product: Product) =>
                      setPriceEdit({
                        code: String(product.code),
                        focusSavings: false,
                      })
                    }
                    onEditSavings={(product: Product) =>
                      setPriceEdit({
                        code: String(product.code),
                        focusSavings: true,
                      })
                    }
                    onMakeSocial={(products: Product[]) => {
                      setSocialSeed({ campaignId: campaign.id, products });
                      setSection("social");
                    }}
                    onPrint={() => {
                      window.print();
                    }}
                    onExport={(pageIndex: React.SetStateAction<number>) => {
                      setExportPage(pageIndex);
                      setExportId(campaign.id);
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}
        <footer className="pa-app-footer" data-export-hide="true">
          <PromoAutomationCredit />
        </footer>
      </main>
      {deleteTarget && (
        <Modal
          title={t("Delete campaign")}
          kicker={t("CONFIRM DELETION")}
          onClose={() => {
            if (!deleteBusy) setDeleteTarget(null);
          }}
        >
          <div className="cs-delete-dialog">
            <div className="cs-delete-icon">
              <NavIcon name="trash" size={25} />
            </div>
            <strong>{deleteTarget.name}</strong>
            <p>{t("This brochure will be removed from your campaigns.")}</p>
            {user?.role === "superadmin" && (
              <p>
                {t(
                  "You can restore this brochure from Deleted brochures if it was removed by mistake.",
                )}
              </p>
            )}
            <div className="cs-delete-actions">
              <Button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteBusy}
              >
                {t("Cancel")}
              </Button>
              <button
                className="cs-delete-confirm"
                type="button"
                disabled={deleteBusy}
                onClick={confirmDeleteCampaign}
              >
                <NavIcon name="trash" size={16} />
                {deleteBusy ? t("Deleting…") : t("Delete campaign")}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "confirm-new" && campaign && (
        <Modal
          title={t("New campaign")}
          kicker={t("START FRESH")}
          onClose={() => {
            if (!newBusy) setModal(null);
          }}
        >
          <div className="cs-new-confirm">
            <p>
              {t(
                "Your current campaign is saved. Start a new campaign from scratch?",
              )}
            </p>
            <div className="cs-delete-actions">
              <Button onClick={() => setModal(null)} disabled={newBusy}>
                {t("Cancel")}
              </Button>
              <Button
                tone="primary"
                disabled={newBusy}
                onClick={async () => {
                  setNewBusy(true);
                  try {
                    await saveCampaign({
                      ...campaign,
                      status: campaign.status || "in_progress",
                    });
                    setModal("create");
                  } catch (error) {
                    console.error(error);
                    setToast(
                      t("Could not save this campaign. Please try again."),
                    );
                  } finally {
                    setNewBusy(false);
                  }
                }}
              >
                {newBusy ? t("Saving…") : t("＋ New campaign")}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "create" && (
        <CreateCampaign
          settings={settings}
          catalog={catalog}
          onCreate={createCampaign}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "import" && campaign && (
        <ImportSales
          catalog={catalog}
          onApply={addProducts}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "manual" && campaign && access.canViewCatalog && (
        <ManualPicker
          catalog={catalog}
          existing={campaign.products}
          onApply={addProducts}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "repair-photos" && campaign && (
        <ProductPhotoRepair
          campaign={campaign}
          failedTargetKeys={[...failedPhotoTargets.current.values()]
            .filter((target) => target.campaignId === campaign.id)
            .map(productPhotoSelectionKey)}
          busyTargetKeys={productImagePreparationTargets(campaign, undefined, {
            force: true,
          })
            .filter((target) =>
              productPhotoQueue.current.isRunningTarget(target),
            )
            .map(productPhotoSelectionKey)}
          queuedTargetKeys={productImagePreparationTargets(
            campaign,
            undefined,
            {
              force: true,
            },
          )
            .filter((target) =>
              productPhotoQueue.current.isQueuedTarget(target),
            )
            .map(productPhotoSelectionKey)}
          onCancelQueued={() => cancelQueuedProductPhotos(campaign.id)}
          onPrepare={({ targetKeys, instructions }) => {
            void prepareProductPhotos(campaign, campaign.products, true, {
              force: true,
              targetKeys,
              instructions,
              userRequested: true,
            });
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "ai" && campaign && (
        <AiReview
          task={aiTask ?? undefined}
          campaign={campaign}
          mode={
            aiDestination === "print" || aiDestination === "export"
              ? "brochure"
              : aiDestination
          }
          onApply={(proposals) => finishAiReview(proposals, true)}
          onDecline={(proposals) => finishAiReview(proposals, false)}
          onClose={() => setModal(null)}
        />
      )}
      {exportId && campaigns.find((item) => item.id === exportId) && (
        <BrochureExport
          campaign={campaigns.find((item) => item.id === exportId)!}
          settings={settings}
          initialPage={exportPage}
          onClose={() => setExportId(null)}
        />
      )}
      {detail && (
        <Details
          focusDetailKey={detail.focusDetailKey}
          canLoadCatalogPhotos={catalogPathAllowed(
            productCategoryPath(detail.product),
            access,
          )}
          product={
            detail.editable
              ? campaign?.products.find(
                  (product: Product) =>
                    String(product.code) === String(detail.product.code),
                ) || detail.product
              : detail.product
          }
          campaign={detail.editable ? (campaign ?? undefined) : undefined}
          onAppearanceChange={
            detail.editable
              ? (
                  field: "offerStyle" | "priceStyle" | "savingMode",
                  value?: string,
                ) =>
                  updateCampaign((draft: Campaign) => {
                    draft.products = draft.products.map((product: Product) => {
                      if (String(product.code) !== String(detail.product.code))
                        return product;
                      const copy = { ...product };
                      if (value) copy[field] = value;
                      else delete copy[field];
                      return copy;
                    });
                  })
              : undefined
          }
          onProductChange={
            detail.editable
              ? (
                  field: keyof Product | Partial<Product>,
                  value?: Product[keyof Product],
                ) =>
                  updateCampaign((draft: Campaign) => {
                    const current = draft.products.find(
                      (product: Product) =>
                        String(product.code) === String(detail.product.code),
                    );
                    if (current) {
                      const changes =
                        typeof field === "object" ? field : { [field]: value };
                      Object.assign(current, changes);
                      if (Object.hasOwn(changes, "specs"))
                        current.autoSpecsDisabled = true;
                    }
                  })
              : undefined
          }
          onImageEdit={
            detail.editable
              ? () => {
                  setImageEditCode(String(detail.product.code));
                  setDetail(null);
                }
              : undefined
          }
          onClose={() => setDetail(null)}
        />
      )}
      {imageEditCode && campaign && imageEditProduct && (
        <ProductImageEditor
          settings={settings}
          product={imageEditProduct}
          onEditArtwork={() => {
            setImageEditCode(null);
            setDetail({
              product: imageEditProduct,
              editable: true,
              focusDetailKey: "__artwork",
            });
          }}
          onEditScreen={() => {
            setImageEditCode(null);
            openScreenEditor(imageEditProduct);
          }}
          catalogProduct={catalog.find(
            (product: Product) => String(product.code) === imageEditCode,
          )}
          backgroundContext={productImageBackgroundContext(
            campaign,
            imageEditProduct,
          )}
          canResumeSearch={Boolean(
            campaign.products.find(
              (item: Product) => String(item.code) === imageEditCode,
            )?.imageSearch?.status === "searching" &&
            !activeImageSearches.current.has(
              campaign.products.find(
                (item: Product) => String(item.code) === imageEditCode,
              )?.imageSearch?.requestId || "",
            ),
          )}
          onFindImage={() => {
            const product = campaign.products.find(
              (item: Product) => String(item.code) === imageEditCode,
            );
            if (product) findProductImage(product);
          }}
          onSave={({
            image,
            aiOriginalImage,
            skipAiCutout,
            ...preparationMetadata
          }) =>
            updateCampaign((draft: Campaign) => {
              const current = draft.products.find(
                (product: Product) => String(product.code) === imageEditCode,
              );
              if (!current) return;
              current.screenArtwork = screenArtworkForPhotoChange(
                current.screenArtwork,
                current.image,
                image,
              );
              if (current.image !== image) delete current.imageSearch;
              current.image = image;
              if (aiOriginalImage) current.aiOriginalImage = aiOriginalImage;
              else delete current.aiOriginalImage;
              current.skipAiCutout = skipAiCutout;
              if (skipAiCutout) current.aiReviewedImageSource = image;
              else delete current.aiReviewedImageSource;
              for (const field of [
                "aiInchesEmbedded",
                "aiPreparedScreenInches",
                "aiAnnotationStyle",
                "aiPreparationRevision",
                "aiBackgroundSignature",
                "aiReviewedPreparationRevision",
                "aiReviewedBackgroundSignature",
              ])
                delete current[field as keyof Product];
              Object.assign(current, preparationMetadata);
            })
          }
          onClose={() => setImageEditCode(null)}
        />
      )}
      {screenEditCode && screenEditProduct && (
        <ScreenImageEditor
          settings={settings}
          product={campaignTelevisionPhoto(campaign, screenEditProduct)}
          tvCount={campaignTelevisions(campaign).length}
          televisions={campaignTelevisionPhotos(campaign)}
          onSelectTelevision={openScreenEditor}
          onSave={async (screenArtwork, scope, fitPlan) => {
            const changed = updateCampaign(
              (draft: Campaign) => {
                if (fitPlan) {
                  const televisions = campaignTelevisionPhotos(draft);
                  if (
                    fitPlan.fits.some((fitted) => {
                      return !televisions.some(
                        (item) =>
                          String(item.code) === fitted.code &&
                          normalizeScreenPhotoSource(
                            screenPhotoSource(item),
                          ) === normalizeScreenPhotoSource(fitted.detectedFor),
                      );
                    })
                  )
                    throw new Error(
                      t(
                        "The product photo changed while fitting. Open the screen editor again.",
                      ),
                    );
                }
                applyTvWallpaper(
                  draft,
                  screenEditCode,
                  screenArtwork,
                  scope,
                  fitPlan,
                );
              },
              { id: campaign.id },
            );
            if (changed) await changed.saved;
          }}
          onClose={() => setScreenEditCode(null)}
        />
      )}
      {priceEdit &&
        campaign &&
        campaign.products.some(
          (product: Product) => String(product.code) === priceEdit.code,
        ) && (
          <ProductPriceEditor
            key={`${campaign.id}-${priceEdit.code}`}
            product={campaign.products.find(
              (product: Product) => String(product.code) === priceEdit.code,
            )!}
            campaign={campaign}
            focusSavings={priceEdit.focusSavings}
            onSave={({
              regular,
              sale,
              savingMode,
              confirmedAboveRegular,
            }: Pick<
              Product,
              "regular" | "sale" | "savingMode" | "confirmedAboveRegular"
            >) =>
              updateCampaign((draft: Campaign) => {
                const product = draft.products.find(
                  (item) => String(item.code) === priceEdit.code,
                );
                if (!product) return;
                product.regular = regular;
                product.sale = sale;
                product.savingMode = savingMode;
                product.confirmedAboveRegular = confirmedAboveRegular;
              })
            }
            onClose={() => setPriceEdit(null)}
          />
        )}
      {toast && (
        <div className="cs-toast" role="status">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
