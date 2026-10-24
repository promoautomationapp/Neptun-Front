import type {
  BrochurePresetDefinition,
  Campaign,
  Settings,
} from "../../domain/models";
import { campaignDefaults } from "../settings/campaign-defaults";
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
  return design;
}
const currentDesign = settingsDesignSnapshot(resolveSettings(null));
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
  coverProductLayout: "pair",
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
  coverBackgroundColor: "",
  coverBackgroundGradient: { from: "#144c83", to: "#70acdc", angle: 90 },
  productBackgroundColor: "#e3e3e3",
  productBackgroundGradient: null,
  productBackgroundImage: "",
  storesBackgroundColor: "#e3e3e3",
  storesBackgroundGradient: null,
  storesBackgroundImage: "",
  offerStyle: "card",
  savingMode: "amount",
  automaticSavings: { enabled: false, amountThreshold: 50 },
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
    footerLineColor: "#003870",
    footerLogoColor: "#003870",
    headerColor: "#007dc5",
    headerTextColor: "#ffffff",
  },
};

export const builtInBrochurePresets: readonly BrochurePreset[] = [
  {
    id: "neptun-current",
    name: "Neptun Classic",
    builtin: true,
    design: { ...currentDesign, brochureVisualStyle: "current" },
  },
  {
    id: "neptun-october",
    name: "Neptun Blue",
    builtin: true,
    design: { ...currentDesign, ...blueDesign },
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
    const design =
      preset.id === "neptun-current"
        ? {
            ...(settings.defaultBrochurePresetId === "neptun-current"
              ? defaults
              : currentDesign),
            brochureVisualStyle: "current" as const,
          }
        : {
            ...defaults,
            ...blueDesign,
            brandAssets: {
              ...defaults.brandAssets,
              ...blueDesign.brandAssets,
            },
          };
    return {
      ...preset,
      customized: Boolean(override),
      // Retire the former generated name while preserving deliberately named team designs.
      name:
        override?.name === "Neptun October"
          ? preset.name
          : (override?.name ?? preset.name),
      design: brochureDesignSnapshot({
        ...design,
        ...(override?.design as Partial<Campaign> | undefined),
      }),
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
  Object.assign(campaign, brochureDesignSnapshot(preset.design), {
    brochurePresetId: preset.id,
  });
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
): void {
  const d = preset.design;
  const b = settings.brochure;
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
