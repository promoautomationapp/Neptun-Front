import type { Campaign, Settings } from "../../domain/models";
import { resolveSettings } from "./settings.schema";
import { brochureFormatSelection } from "../brochure/brochureFormat";
import type { CampaignType, WorkspaceSettings } from "./settings.schema";

export function visibleCampaignTypes(settings: Settings): CampaignType[] {
  return resolveSettings(settings).campaignTypes.filter((item) => item.visible);
}
export function defaultCampaignType(settings: Settings): CampaignType {
  const resolved = resolveSettings(settings);
  if (!resolved.defaultCampaignTypeId)
    return {
      id: "custom",
      name: "Custom campaign",
      tagline: "",
      visible: true,
    };
  return (
    resolved.campaignTypes.find(
      (item) => item.id === resolved.defaultCampaignTypeId && item.visible,
    ) ??
    resolved.campaignTypes.find((item) => item.visible) ?? {
      id: "custom",
      name: "Custom campaign",
      tagline: "",
      visible: true,
    }
  );
}
export function repairDefaultType(settings: WorkspaceSettings): void {
  if (!settings.defaultCampaignTypeId) return;
  if (
    !settings.campaignTypes.some(
      (item) => item.id === settings.defaultCampaignTypeId && item.visible,
    )
  )
    settings.defaultCampaignTypeId =
      settings.campaignTypes.find((item) => item.visible)?.id ?? "";
}
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const result = [...items];
  if (from < 0 || to < 0 || from >= result.length || to >= result.length)
    return result;
  const [item] = result.splice(from, 1);
  if (item !== undefined) result.splice(to, 0, item);
  return result;
}
/** Copies a complete snapshot. Renderers never consult future team defaults. */
export function campaignDefaults(
  input: Settings,
  version?: number,
  typeName?: string,
): Partial<Campaign> {
  const settings = resolveSettings(input);
  const b = settings.brochure;
  const type = typeName
    ? settings.campaignTypes.find((item) => item.name === typeName)
    : defaultCampaignType(settings);
  return {
    ...(version !== undefined ? { defaultsVersion: version } : {}),
    ...brochureFormatSelection(b.format, settings.customFormats),
    layout: b.layout,
    autoProductLayout: b.automaticProductLayout,
    productDesign: structuredClone(settings.productDesign),
    coverTemplate: b.coverTemplate,
    coverProductLayout: b.coverProductLayout,
    coverLogoStyle: b.coverLogoStyle,
    coverLogoSource: b.coverLogoSource,
    neptunLogoOption: b.neptunLogoOption,
    priceLogo: b.priceLogo,
    customPriceLogo: b.customPriceLogo,
    offerStyle: settings.offerStyle,
    savingMode: settings.savingMode,
    pricePalette: structuredClone(b.pricePalette),
    installments: b.installments,
    paymentText: b.paymentText,
    showCoverLogo: b.showCoverLogo,
    showCoverBand: b.showCoverBand,
    showCoverHeadline: b.showCoverHeadline,
    showCoverMessage: b.showCoverMessage,
    showCoverGradient: b.showCoverGradient,
    coverMessageColor: b.coverMessageColor,
    coverHeadlineColor: b.coverHeadlineColor,
    coverTypeColor: b.coverTypeColor,
    coverFooterColor: b.coverFooterColor,
    productBackgroundColor: b.productBackground.gradient
      ? ""
      : b.productBackground.color,
    productBackgroundGradient: structuredClone(b.productBackground.gradient),
    productBackgroundImage: b.productBackground.image,
    coverBackgroundColor: b.coverBackground.gradient
      ? ""
      : b.coverBackground.color,
    coverBackgroundGradient: structuredClone(b.coverBackground.gradient),
    coverBackgroundImage: b.coverBackground.image,
    storesBackgroundColor: b.storesBackground.gradient
      ? ""
      : b.storesBackground.color,
    storesBackgroundGradient: structuredClone(b.storesBackground.gradient),
    storesBackgroundImage: b.storesBackground.image,
    includeStoresPage: b.storesDisplay === "page",
    includeStoresFooter: b.storesDisplay === "footer",
    showOnlineStore: b.showOnlineStore,
    selectedStoreIndexes: settings.stores.flatMap((store, index) =>
      store.visible ? [index] : [],
    ),
    storeOrder: settings.stores.map((_, index) => index),
    storeFields: structuredClone(b.storeFields),
    contactVisibility: structuredClone(b.contactVisibility),
    storesHiddenElements: [...b.storesHiddenElements],
    storeFooterHiddenElements: [...b.storeFooterHiddenElements],
    showInteriorFooter: b.showInteriorFooter,
    showFooterPageNumber: b.showFooterPageNumber,
    automaticSavings: structuredClone(settings.automaticSavings),
    categoryPathSavingModes: structuredClone(settings.categoryPathSavingModes),
    categorySavingModes: structuredClone(settings.categorySavingModes),
    logoRules: structuredClone(settings.logoRules),
    logoRuleDefaults: {
      cover: b.coverLogoSource,
      pages: settings.brandAssets.neptun || "",
    },
    brandAssets: structuredClone(settings.brandAssets),
    brandLogos: structuredClone(settings.brandLogos),
    iconDefaults: structuredClone(settings.iconDefaults),
    storesSnapshot: structuredClone(settings),
  };
}
