import type {
  BrochurePresetDefinition,
  Campaign,
  Settings,
} from "../../domain/models";
import { campaignDefaults } from "../settings/campaign-defaults";
import { materializeCampaignColorVariants } from "./campaignColorVariants";
import {
  BLACK_FRIDAY_ID,
  blackFridayDesignDefaults,
  blackFridayPageArtworks,
  isBlackFridayBrochure,
} from "./blackFridayDesign";
import {
  repairAutomaticCollectionCoverLayout,
  resetDefaultCoverProductPositions,
} from "./coverElements";
import {
  BROCHURE_DESIGN_KEYS,
  resolveSettings,
} from "../settings/settings.schema";
import type {
  ProductDesignDefaults,
  WorkspaceSettings,
} from "../settings/settings.schema";

export interface BrochurePreset extends BrochurePresetDefinition {
  builtin?: boolean;
  customized?: boolean;
  description?: string;
}

/** Identity, catalog products, dates and review data never enter a design. */
export function brochureDesignSnapshot(
  input: Partial<Campaign>,
): Partial<Campaign> {
  const snapshot: Record<string, unknown> = {};
  for (const key of BROCHURE_DESIGN_KEYS) {
    if (input[key] !== undefined) snapshot[key] = structuredClone(input[key]);
  }
  return snapshot as Partial<Campaign>;
}

function settingsDesignSnapshot(settings: Settings): Partial<Campaign> {
  const design = brochureDesignSnapshot(campaignDefaults(settings));
  // Campaign-type logos are chosen when creating a campaign, separately from a design.
  delete design.pageArtworks;
  // Designs own store data, never a nested copy of the workspace/preset library.
  design.storesSnapshot = {
    stores: structuredClone(settings.stores),
    contact: structuredClone(settings.contact),
  };
  return design;
}
const currentDesign = settingsDesignSnapshot(resolveSettings(null));
// Built-ins inherit the team's current locations until explicitly customized.
delete currentDesign.storesSnapshot;
delete currentDesign.selectedStoreIndexes;
delete currentDesign.storeOrder;
const blueProductDesign: ProductDesignDefaults = {
  ...currentDesign.productDesign!,
  details: {
    ...currentDesign.productDesign!.details,
    placement: "automatic",
    fill: "outline",
  },
  typography: { ...currentDesign.productDesign!.typography, font: "SkolaSans" },
};
const blueDesign: Partial<Campaign> = {
  brochureVisualStyle: "october",
  brochureFormat: "neptun1080x1350",
  layout: "duo4",
  autoProductLayout: true,
  productDesign: blueProductDesign,
  coverTemplate: "blueClean",
  coverProductLayout: "hero",
  coverProductLayoutManual: false,
  coverLogoSource: "/brochure-presets/october/neptun-cover.svg",
  coverBrandTagline: "Jeto më mirë, çdo ditë.",
  brandAssets: {
    neptun: "/brochure-presets/october/neptun-footer.svg",
    storesHajde: "/brochure-presets/october/hajde.svg",
    balfin: "/brochure-presets/october/balfin.svg",
    bestbuy: "/brochure-presets/october/bestbuy.png",
    qudal: "/brochure-presets/october/qudal.png",
    service: "/brochure-presets/october/service.svg",
  },
  showCoverBand: true,
  showCoverLogo: true,
  showCoverHeadline: false,
  showCoverMessage: true,
  showCoverGradient: false,
  coverMessageColor: "#ffffff",
  coverTextColorOverrides: {
    coverMessageColor: true,
    coverHeadlineColor: true,
    coverTypeColor: true,
  },
  tagline: "Çmimet flasin vetë!",
  coverImage: "",
  coverBackgroundImage: "",
  coverBandVariant: "uuu",
  coverBackgroundGradient: null,
  coverBackgroundColor: "#1b4075",
  productBackgroundColor: "#1b4075",
  productBackgroundGradient: null,
  productBackgroundImage: "",
  storesBackgroundColor: "#e3e3e3",
  storesBackgroundGradient: null,
  storesBackgroundImage: "",
  offerStyle: "card",
  savingMode: "amount",
  automaticSavings: {
    enabled: true,
    amountThreshold: 30,
    basis: "offer-price",
  },
  categoryPathSavingModes: {},
  categorySavingModes: {},
  pricePalette: {
    red: "#ff4228",
    blue: "#003870",
    blueBand: "#e6e8e8",
    saving: "#003870",
  },
  priceLogo: "symbol",
  installments: 12,
  includeStoresPage: true,
  includeStoresFooter: false,
  showOnlineStore: true,
  showInteriorFooter: true,
  showFooterPageNumber: true,
  brochureFooter: { visible: false },
  pageDecorationDefaults: {
    showHeader: true,
    showOnlineLogo: true,
    showFooterLogo: true,
    showFooterLine: true,
    footerLineColor: "#ffffff",
    footerLogoColor: "#ffffff",
    headerColor: "#007dc5",
    headerTextColor: "#ffffff",
  },
};

const verticalGradient = { from: "#234173", to: "#86b3de", angle: 180 };
const horizontalGradient = { ...verticalGradient, angle: 90 };
const classicGradient: Partial<Campaign> = {
  ...currentDesign,
  brochureVisualStyle: "current",
  coverTemplate: "blueClean",
  coverProductLayout: "hero",
  coverProductLayoutManual: false,
  coverBandVariant: "hajde",
  showCoverBand: false,
  showCoverLogo: true,
  showCoverMessage: true,
  showCoverHeadline: false,
  coverLogoSource: "/brochure-presets/october/neptun-cover.svg",
  coverBrandTagline: "Jeto më mirë, çdo ditë.",
  tagline: "Çmimet flasin vetë!",
  coverTextColorOverrides: {
    coverMessageColor: true,
    coverHeadlineColor: true,
    coverTypeColor: true,
  },
  coverMessageColor: "#ffffff",
  brandAssets: {
    ...blueDesign.brandAssets,
    storesHajde: "/brochure-presets/october/hajde-white.svg",
    service: "/brochure-presets/october/service-white.svg",
    balfin: "/brochure-presets/october/balfin-white.svg",
  },
  coverImage: "",
  coverBackgroundImage: "",
  coverBackgroundColor: "",
  coverBackgroundGradient: verticalGradient,
  productBackgroundColor: "#e3e3e3",
  productBackgroundGradient: null,
  productBackgroundImage: "",
  storesBackgroundColor: "#1c4075",
  storesBackgroundGradient: null,
  storesBackgroundImage: "/brochure-presets/unified/stores-background.svg",
  brochureFooter: { style: "reference", visible: true },
  showInteriorFooter: true,
};
export const builtInBrochurePresets: readonly BrochurePreset[] = [
  {
    id: "neptun-current",
    name: "Featured Product Collection",
    description: "Vertical gradient cover · three products · gray inside pages",
    builtin: true,
    design: {
      ...classicGradient,
      showInteriorFooter: false,
      showFooterPageNumber: false,
      pageDecorationDefaults: {
        ...classicGradient.pageDecorationDefaults,
        showFooterLogo: false,
        showFooterLine: false,
      },
    },
  },
  {
    id: "neptun-uuu-gray",
    name: "UUU · Catalogue Edition",
    description: "Horizontal gradient cover · gray inside pages",
    builtin: true,
    design: {
      ...currentDesign,
      ...blueDesign,
      coverBackgroundColor: "",
      coverBackgroundGradient: horizontalGradient,
      productBackgroundColor: "#e3e3e3",
      brochureFooter: {
        style: "bar",
        visible: true,
        showAwards: false,
        fadeEnd: true,
        bottom: 19,
        height: 4,
        dateWidth: 55,
        dateSize: 2.8,
        paymentSize: 1.85,
        from: "#ff4228",
      },
      pageDecorationDefaults: {
        ...blueDesign.pageDecorationDefaults,
        footerLineColor: "#003870",
        footerLogoColor: "#003870",
      },
    },
  },
  {
    id: "neptun-gradient-all",
    name: "Unified Collection",
    description:
      "Three cover products · the same vertical gradient on every page",
    builtin: true,
    design: {
      ...classicGradient,
      productBackgroundColor: "",
      productBackgroundGradient: verticalGradient,
      storesBackgroundColor: "#1c4075",
      storesBackgroundGradient: null,
      storesBackgroundImage: "/brochure-presets/unified/stores-background.svg",
      brandAssets: {
        ...blueDesign.brandAssets,
        storesHajde: "/brochure-presets/october/hajde-white.svg",
        service: "/brochure-presets/october/service-white.svg",
        balfin: "/brochure-presets/october/balfin-white.svg",
      },
    },
  },
  {
    id: "neptun-online",
    name: "Hajde! · Online Offers",
    description: "Hajde! and Blej ONLINE · gray inside pages",
    builtin: true,
    design: {
      ...currentDesign,
      ...blueDesign,
      showCoverBand: false,
      coverBandVariant: "online",
      tagline: "Blej ONLINE",
      coverBackgroundColor: "",
      coverBackgroundGradient: horizontalGradient,
      productBackgroundColor: "#e3e3e3",
      pageDecorationDefaults: {
        ...blueDesign.pageDecorationDefaults,
        footerLineColor: "#003870",
        footerLogoColor: "#003870",
      },
    },
  },
  {
    id: "neptun-october",
    name: "UUU · Brand Edition",
    description: "UUU cover · solid Neptun blue inside pages",
    builtin: true,
    design: { ...currentDesign, ...blueDesign },
  },
  {
    id: BLACK_FRIDAY_ID,
    name: "Black Friday · November Edition",
    description:
      "Original Black Friday brochure · A3 · editable banners and artwork",
    builtin: true,
    design: {
      ...currentDesign,
      ...blackFridayDesignDefaults(),
      productDesign: {
        ...currentDesign.productDesign!,
        photo: {
          mode: "automatic",
          x: 50,
          y: 50,
          scale: 1,
          automaticTvSizing: false,
        },
        details: { placement: "bottom", fill: "automatic" },
        typography: {
          ...currentDesign.productDesign!.typography,
          font: "automatic",
        },
      },
    },
  },
];

/** Built-ins can be customized without losing their original reset point. */
export function availableBrochurePresets(input: Settings): BrochurePreset[] {
  const settings = resolveSettings(input);
  const defaults = settingsDesignSnapshot(settings);
  const overrides = new Map(
    settings.brochurePresets.map((preset) => [preset.id, preset]),
  );
  const result = builtInBrochurePresets.map((preset) => {
    const override = overrides.get(preset.id);
    const design: Partial<Campaign> = {
      ...defaults,
      ...preset.design,
      brandAssets: { ...defaults.brandAssets, ...preset.design.brandAssets },
    };
    if (
      preset.id === "neptun-current" &&
      settings.defaultBrochurePresetId === preset.id
    ) {
      const customized = Object.fromEntries(
        Object.entries(defaults).filter(
          ([key, value]) =>
            !["storesSnapshot", "selectedStoreIndexes", "storeOrder"].includes(
              key,
            ) &&
            JSON.stringify(value) !==
              JSON.stringify(currentDesign[key as keyof Campaign]),
        ),
      );
      Object.assign(design, customized);
      if (Object.keys(customized).length) delete design.tagline;
    }
    if (preset.design.brochureReferenceDesign === undefined)
      delete design.brochureReferenceDesign;
    // Manufacturer choices belong to the workspace unless this saved design explicitly overrides them.
    if (!Object.keys(preset.design.brandLogos || {}).length)
      design.brandLogos = structuredClone(defaults.brandLogos || {});
    const snapshot = brochureDesignSnapshot({
      ...design,
      ...(override?.design as Partial<Campaign> | undefined),
    });
    if (
      ["neptun-current", "neptun-gradient-all"].includes(preset.id) &&
      snapshot.coverProductLayoutManual !== true &&
      snapshot.coverProductLayout !== "row"
    )
      snapshot.coverProductLayout = "hero";
    return {
      ...preset,
      customized: Boolean(override),
      // Retire the former generated name while preserving deliberately named team designs.
      name:
        override &&
        [
          "Neptun October",
          "Neptun Classic",
          "Neptun Blue",
          "UUU · Gray pages",
          "Full gradient",
          "Hajde · Online",
        ].includes(override.name)
          ? preset.name
          : (override?.name ?? preset.name),
      design: snapshot,
    };
  });
  for (const preset of settings.brochurePresets) {
    if (builtInBrochurePresets.some((builtin) => builtin.id === preset.id))
      continue;
    result.push({
      ...preset,
      builtin: false,
      customized: true,
      design: brochureDesignSnapshot(preset.design as Partial<Campaign>),
    });
  }
  return result;
}

/** Snapshots presentation into a campaign; later settings cannot alter it. */
export function applyBrochurePreset(
  campaign: Campaign,
  preset: BrochurePresetDefinition,
): void {
  if (
    isBlackFridayBrochure(campaign) &&
    !isBlackFridayBrochure({ ...preset.design, brochurePresetId: preset.id })
  ) {
    const sourceIds = new Set(
      Object.values(blackFridayPageArtworks()).flatMap((artworks) =>
        artworks.map((artwork) => artwork.id),
      ),
    );
    if (campaign.pageArtworks)
      campaign.pageArtworks = Object.fromEntries(
        Object.entries(campaign.pageArtworks).map(([key, artworks]) => [
          key,
          artworks.filter((artwork) => !sourceIds.has(artwork.id)),
        ]),
      );
  }
  delete campaign.brochureReferenceDesign;
  materializeCampaignColorVariants(campaign);
  Object.assign(campaign, repairAutomaticCollectionCoverLayout(campaign));
  resetDefaultCoverProductPositions(campaign);
  Object.assign(campaign, brochureDesignSnapshot(preset.design), {
    brochurePresetId: preset.id,
    coverProductLayoutManual: preset.design.coverProductLayoutManual === true,
  });
  Object.assign(campaign, repairAutomaticCollectionCoverLayout(campaign));
}

export function brochurePresetFromSettings(
  settings: Settings,
  id: string,
  name: string,
): BrochurePreset {
  return { id, name, design: settingsDesignSnapshot(settings) };
}

/** Load a design into the ordinary Settings draft, then use its existing save flow. */
export function applyPresetToSettings(
  settings: WorkspaceSettings,
  preset: BrochurePresetDefinition,
  { includeStores = true }: { includeStores?: boolean } = {},
): void {
  const d = preset.design;
  const b = settings.brochure;
  if (d.brochureReferenceDesign)
    b.brochureReferenceDesign = d.brochureReferenceDesign;
  else delete b.brochureReferenceDesign;
  if (includeStores && d.storesSnapshot) {
    settings.stores = structuredClone(d.storesSnapshot.stores).map((store) => ({
      ...store,
      visible: store.visible !== false,
    }));
    settings.contact = structuredClone(d.storesSnapshot.contact);
  }
  b.brochureVisualStyle =
    d.brochureVisualStyle ??
    (preset.id === "neptun-october" ? "october" : "current");
  if (d.pageDecorationDefaults)
    b.pageDecorationDefaults = structuredClone(d.pageDecorationDefaults);
  else delete b.pageDecorationDefaults;
  const copy = <K extends keyof Campaign>(key: K) =>
    d[key] === undefined ? undefined : structuredClone(d[key]);
  const direct = [
    "coverTemplate",
    "coverProductLayout",
    "coverBandVariant",
    "coverRibbonColors",
    "coverLogoStyle",
    "coverLogoSource",
    "neptunLogoOption",
    "priceLogo",
    "customPriceLogo",
    "pricePalette",
    "installments",
    "paymentText",
    "showCoverLogo",
    "showCoverBand",
    "showCoverHeadline",
    "showCoverMessage",
    "showCoverGradient",
    "coverMessageColor",
    "coverHeadlineColor",
    "coverTypeColor",
    "coverFooterColor",
    "showOnlineStore",
    "showInteriorFooter",
    "showFooterPageNumber",
    "storeFields",
    "contactVisibility",
    "storesHiddenElements",
    "storeFooterHiddenElements",
  ] as const;
  for (const key of direct)
    if (d[key] !== undefined) Object.assign(b, { [key]: copy(key) });
  if (d.brochureFormat) b.format = d.brochureFormat;
  if (d.layout) b.layout = d.layout as typeof b.layout;
  if (d.autoProductLayout !== undefined)
    b.automaticProductLayout = d.autoProductLayout;
  if (d.offerStyle)
    settings.offerStyle =
      d.offerStyle === "card" || d.offerStyle === "compact"
        ? "card"
        : "current";
  if (d.savingMode)
    settings.savingMode = d.savingMode as typeof settings.savingMode;
  if (d.brochureFooter?.style) b.footerStyle = d.brochureFooter.style;
  b.showCoverFooter = d.brochureFooter?.visible ?? true;
  for (const [prefix, target] of [
    ["cover", "coverBackground"],
    ["product", "productBackground"],
    ["stores", "storesBackground"],
  ] as const) {
    const color = d[`${prefix}BackgroundColor`];
    const gradient = d[`${prefix}BackgroundGradient`];
    const image = d[`${prefix}BackgroundImage`];
    if (color !== undefined) b[target].color = color;
    if (gradient !== undefined) b[target].gradient = structuredClone(gradient);
    if (image !== undefined) b[target].image = image;
  }
  b.storesDisplay = d.includeStoresFooter
    ? "footer"
    : d.includeStoresPage === false
      ? "none"
      : "page";
  for (const key of [
    "productDesign",
    "automaticSavings",
    "categoryPathSavingModes",
    "categorySavingModes",
    "logoRules",
    "brandAssets",
    "brandLogos",
    "iconDefaults",
  ] as const) {
    if (d[key] !== undefined) Object.assign(settings, { [key]: copy(key) });
  }
}

export function captureEditedBrochurePreset(
  settings: Settings,
  preset: BrochurePresetDefinition,
): BrochurePresetDefinition {
  return {
    id: preset.id,
    name: preset.name,
    design: brochureDesignSnapshot({
      ...preset.design,
      ...brochurePresetFromSettings(settings, preset.id, preset.name).design,
      brochureFooter: {
        ...preset.design.brochureFooter,
        ...brochurePresetFromSettings(settings, preset.id, preset.name).design
          .brochureFooter,
      },
      brochureVisualStyle: preset.design.brochureVisualStyle ?? "current",
    }),
  };
}
