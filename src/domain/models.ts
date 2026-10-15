import type {
  BrochureDefaults,
  LogoAsset,
  IconDefault,
  CampaignType,
} from "../features/settings/settings.schema";
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export interface PageLayout {
  showFooter?: boolean;
  showFooterPageNumber?: boolean;
  spacing?: Record<string, JsonValue>;
  layout?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  image?: string;
  backgroundGradient?: Gradient | null;
  [key: string]: JsonValue | Gradient | undefined;
}
export interface Gradient {
  from: string;
  to: string;
  angle: number;
}
export interface Store {
  id?: string;
  visible?: boolean;
  city: string;
  name: string;
  address: string;
  phone: string;
}
export interface Settings {
  stores: Store[];
  contact: Record<string, string>;
  offerStyle?: string;
  savingMode?: string;
  brochure?: BrochureDefaults;
  logoLibrary?: LogoAsset[];
  brandAssets?: Record<string, string>;
  brandLogos?: Record<string, string>;
  iconDefaults?: Record<string, IconDefault>;
  automaticSavings?: { enabled: boolean; amountThreshold: number };
  categoryPathSavingModes?: Record<string, "amount" | "percentage">;
  categorySavingModes?: Record<string, CategorySavingRule>;
  campaignTypes?: CampaignType[];
  defaultCampaignTypeId?: string;
}
export type CampaignMutator = (draft: Campaign) => void;
export interface Campaign {
  campaignAssets?: Record<
    string,
    { image?: string; hidden?: boolean; placement?: Placement }
  >;
  pricePalette?: {
    red: string;
    blue: string;
    blueBand: string;
    saving: string;
  };
  defaultsVersion?: number;
  coverLogoStyle?: string;
  showCoverMessage?: boolean;
  showCoverGradient?: boolean;
  iconDefaults?: Record<string, IconDefault>;
  storeFields?: {
    city: boolean;
    name: boolean;
    address: boolean;
    phone: boolean;
    icon: boolean;
  };
  contactVisibility?: Record<string, boolean>;
  storesHiddenElements?: string[];
  pageArtworks?: Record<string, Artwork[]>;
  coverElementPlacements?: Record<string, Placement>;
  coverOverlayGradient?: Partial<Gradient> & { opacity?: number };
  coverProductLayout?: string;
  coverBannerProductCode?: string;
  coverTextColorOverrides?: Record<string, boolean>;
  coverMessageColor?: string;
  coverHeadlineColor?: string;
  coverTypeColor?: string;
  coverFooterColor?: string;
  coverGradientRegion?: string;
  storeOrder?: number[];
  automaticSavings?: { enabled: boolean; amountThreshold: number };
  categoryPathSavingModes?: Record<string, "amount" | "percentage">;
  categorySavingModes?: Record<string, CategorySavingRule>;
  storePositions?: Record<string, Placement>;
  storesElementPlacements?: Record<string, Placement>;
  storeFooterElementPlacements?: Record<string, Placement>;
  storeFooterHiddenElements?: string[];
  includeStoresFooter?: boolean;
  showInteriorFooter?: boolean;
  showFooterPageNumber?: boolean;
  coverLogoSource?: string;
  coverBackgroundImage?: string;
  productBackgroundColor?: string;
  productBackgroundGradient?: Gradient | null;
  productBackgroundImage?: string;
  storesBackgroundColor?: string;
  storesBackgroundGradient?: Gradient | null;
  storesBackgroundImage?: string;
  compactStoresFooterHeight?: number | string;
  brandLogos?: Record<string, string>;
  aiBackgroundChanged?: boolean;
  aiReviewedFieldHistory?: Record<string, string[]>;
  brochureImportWarnings?: Array<BrochureImportWarning | string>;

  version?: number;
  brochureFormat?: string;
  aiReviewedFields?: Record<string, string>;
  aiReviewedTextSnapshot?: string;
  brandAssets?: Record<string, string>;
  coverBackgroundColor?: string;
  coverBackgroundGradient?: Gradient | null;
  coverHeadline?: string;
  coverHeadlinePosition?: string;
  coverHeadlineStyle?: string;
  coverImage?: string;
  coverProductCodes?: string[];
  coverTemplate?: string;
  createdAt?: string;
  customPriceLogo?: string;
  endDate?: string;
  id: string;
  includeStoresPage?: boolean;
  installments?: number;
  layout?: string;
  name: string;
  autoProductLayout?: boolean;
  neptunLogoOption?: string;
  offerStyle?: string;
  pages?: Record<string, PageLayout>;
  paymentText?: string;
  priceLogo?: string;
  products: Product[];
  reviewComments?: CampaignReviewCommentsItem[];
  reviewPagePlacements?: Record<string, number>;
  reviewHistory?: CampaignReviewHistoryItem[];
  savingMode?: string;
  selectedStoreIndexes?: number[];
  showCoverBand?: boolean;
  showCoverHeadline?: boolean;
  showCoverLogo?: boolean;
  showOnlineStore?: boolean;
  startDate?: string;
  status?: string;
  storesSnapshot?: Settings;
  tagline?: string;
  theme?: string;
  type?: string;
  updatedAt?: string;
}

export interface CampaignCoverBackgroundGradient {
  angle?: number;
  from?: string;
  to?: string;
}

export interface CampaignProductsItemBrochureImagePlacement {
  scale?: number;
  x?: number;
  y?: number;
}

export interface CampaignReviewCommentsItem {
  position?: { x: number; y: number } | null;
  replies?: ReviewReply[];
  mention?: string | null;

  authorEmail?: string;
  createdAt?: string;
  fixed?: boolean;
  fixedAt?: string;
  fixedBy?: string;
  id?: string;
  pageIndex?: number;
  pageLabel?: string;
  text?: string;
}

export interface CampaignReviewHistoryItem {
  action?: string;
  actor?: string;
  at?: string;
  commentId?: string | null;
  id?: string;
  role?: string;
}

export interface CampaignStoresSnapshot {
  contact?: Record<string, string>;
  offerStyle?: string;
  savingMode?: string;
  stores?: CampaignStoresSnapshotStoresItem[];
}

export interface CampaignStoresSnapshotStoresItem {
  address?: string;
  city?: string;
  name?: string;
  phone?: string;
}

export interface SocialPost {
  backgroundPrompt?: string;
  artworks?: Artwork[];
  logoCoords?: Record<string, Placement>;

  version?: number;
  aiReviewedFields?: Record<string, string>;
  background: Background;
  createdAt?: string;
  customHeight?: number;
  customLogo?: string;
  customLogoPosition?: string;
  customLogoScale?: number;
  customWidth?: number;
  detailStyle?: string;
  eventLogo?: string;
  eventLogoUpload?: string;
  eventPosition?: string;
  eventScale?: number;
  id: string;
  logoLayout?: string;
  logoPosition?: string;
  logoScale?: number;
  logoVariant?: string;
  name: string;
  neptunLogoUpload?: string;
  preset?: string;
  priceStyle?: string;
  products: Product[];
  quality?: string;
  revision?: number;
  savingMode?: string;
  showCustomLogo?: boolean;
  showDetails?: boolean;
  showEventLogo?: boolean;
  showInches?: boolean;
  showInstallments?: boolean;
  showNeptunLogo?: boolean;
  showPrice?: boolean;
  showRegular?: boolean;
  showSaving?: boolean;
  showSpecs?: boolean;
  sourceCampaignId?: string | null;
  template?: string;
  textHtml?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SocialPostBackground {
  angle?: number;
  color?: string;
  from?: string;
  image?: string;
  to?: string;
  type?: string;
}

export interface ProductImageSearch {
  status: "searching" | "found" | "not_found" | "failed";
  requestKey: string;
  requestId: string;
  sourceUrl?: string;
  imageUrl?: string;
  matchedName?: string;
  message?: string;
}

export interface BrochureImportWarning {
  position?: string;
  row: number;
  code: string;
  name: string;
  message: string;
}

export interface Product {
  /** Imported offers remain editable even when their code is absent from the catalog. */
  catalogMissing?: boolean;
  missingCatalogCodes?: string[];
  excelSource?: { row: number; cells: Record<string, string>; placeholderName?: string };
  imageSearch?: ProductImageSearch;
  bundleCodes?: string[];
  bundleProducts?: Product[];
  brochureDetails?: Array<string | { key: string; text: string }>;
  brochureVariants?: BrochureVariant[];
  productArtworks?: Artwork[];
  screenArtwork?: ScreenArtwork;
  brochurePage?: number;
  brochureOrder?: number;
  brochureCardSize?: { width: number; height: number };
  brochureContentPlacement?: Record<string, Placement>;
  bundlePanelColor?: string;
  bundleMemberDetails?: Record<string, string>;
  setSourceRows?: number[];
  detailPlacement?: string;
  detailBlockPlacements?: Record<string, Placement>;
  detailBlockStyles?: Record<
    string,
    DetailStyle | "filled" | "outline" | "auto"
  >;
  offerPlacements?: Record<string, Placement>;
  offerStyle?: string;
  priceStyle?: string;
  savingMode?: string;
  aiReviewedImageSource?: string;
  aiReviewedPreparationRevision?: number;
  aiReviewedBackgroundSignature?: string;
  aiInchesEmbedded?: boolean;
  aiPreparationRevision?: number;
  aiPreparedScreenInches?: number | null;
  aiAnnotationStyle?: string;
  aiBackgroundSignature?: string;
  aiCutoutProvider?: string;
  aiAnnotationCleanup?: boolean;
  aiCutoutReviewRevision?: number;
  aiCutoutReviewAccepted?: boolean;
  originalImage?: string;
  autoSpecsDisabled?: boolean;
  hideWarranty?: boolean;
  hideColors?: boolean;
  postImagePlacement?: Placement;
  screenAnnotationPlacement?: Placement;
  features?: JsonValue;

  id?: string;
  thumbnail?: string;
  preview?: string;
  localImage?: string;
  currency?: string;
  categoryPath?: string;
  sourceMissing?: boolean;
  sourceMissingSince?: string | null;
  availability?: string;
  url?: string;
  aiOriginalImage?: string;
  brand?: string;
  brandLogo?: string;
  hideBrandLogo?: boolean;
  brochureImagePlacement?: ProductBrochureImagePlacement | null;
  category?: string;
  code: string;
  confirmedAboveRegular?: boolean;
  cutoutStatus?: string;
  description?: string;
  image?: string;
  imageChoices?: string[];
  imageUrl?: string;
  images?: string[];
  name: string;
  positioned?: boolean;
  postDetails?: string;
  regular?: number | string | null;
  sale?: string | number;
  scale?: number;
  showImage?: boolean;
  skipAiCutout?: boolean;
  source?: string;
  specs?: Record<string, string>;
  subcategory?: string;
  warranty?: string;
  x?: number;
  y?: number;
}

export interface ProductBrochureImagePlacement {
  scale?: number;
  x?: number;
  y?: number;
}

export interface Placement {
  textPosition?: "balanced" | "original";
  hidden?: boolean;
  horizontalLength?: number;
  verticalLength?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  rotation?: number;
}
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface Artwork {
  imageFit?: "cover" | "contain";
  id: string;
  name?: string;
  color?: string;
  fade?: string;
  shadow?: boolean;
  shadowColor?: string;
  fontSize?: number;
  text?: string;
  type?: string;
  label?: string;
  image?: string;
  x: number;
  y: number;
  width: number;
  height?: number;
  relativeTo?: string;
  usesPrimaryImage?: boolean;
  memberCode?: string;
  zIndex?: number;
  rotation?: number;
  opacity?: number;
  hidden?: boolean;
}
export interface ScreenArtwork {
  fit?: "contain" | "cover";
  image?: string;
  box?: Box;
  scale?: number;
  x?: number;
  y?: number;
  detectedFor?: string;
}
export interface DetailStyle {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: string;
}
export interface BrochureVariant {
  code?: string;
  color?: { name: string; hex: string };
  [key: string]: JsonValue | { name: string; hex: string } | undefined;
}
export interface Background {
  type?: string;
  color?: string;
  from?: string;
  to?: string;
  angle?: number;
  image?: string;
}
export interface CategorySavingRule {
  mode?: string;
  subcategories?: Record<string, string>;
}
export interface ReviewReply {
  id: string;
  text: string;
  authorEmail: string;
  createdAt: string;
  mention?: string | null;
}
