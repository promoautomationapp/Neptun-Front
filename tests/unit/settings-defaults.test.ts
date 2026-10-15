import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  resolveSettings,
  workspaceSettingsSchema,
} from "../../src/features/settings/settings.schema";
import {
  campaignDefaults,
  defaultCampaignType,
  moveItem,
  repairDefaultType,
  visibleCampaignTypes,
} from "../../src/features/settings/campaign-defaults";
import { savingModeFor } from "../../src/features/brochure/offerStyles";
import {
  defaultProductArtworks,
  effectiveProductArtworks,
} from "../../src/features/brochure/productArtwork";
import {
  visibleContact,
  visibleStoreLines,
} from "../../src/features/settings/brochure-display";
import legacy from "../../src/config/stores.defaults.json";
describe("shared brochure defaults", () => {
  it("keeps the original dimensions, artwork, stores, contact text and savings design", () => {
    const settings = resolveSettings(null);
    const campaign = campaignDefaults(settings);
    expect(
      settings.stores.map(({ city, name, address, phone }) => ({
        city,
        name,
        address,
        phone,
      })),
    ).toEqual(legacy.stores);
    expect(settings.contact).toEqual(legacy.contact);
    expect(campaign).toMatchObject({
      brochureFormat: "neptun1080x1350",
      layout: "grid6portrait",
      coverTemplate: "blueRibbon",
      coverProductLayout: "pair",
      priceLogo: "symbol",
      offerStyle: "current",
      savingMode: "amount",
      installments: 12,
      showCoverLogo: true,
      showCoverBand: false,
      showCoverHeadline: false,
      showCoverMessage: false,
      productBackgroundColor: "#1c4075",
      coverBackgroundColor: "#1c4075",
      includeStoresPage: true,
      includeStoresFooter: false,
      showOnlineStore: true,
    });
    expect(defaultCampaignType(settings).name).toBe("Black Friday");
    expect(settings.campaignTypes).toHaveLength(12);
  });
  it("uses identical contracts and original default data on both sides of the API", () => {
    const front = "src/features/settings/";
    const back = "../Neptun-Backend/src/modules/settings/domain/";
    for (const file of ["defaults.json", "settings.schema.ts"])
      expect(readFileSync(front + file, "utf8")).toBe(
        readFileSync(back + file, "utf8"),
      );
  });
  it("copies choices into an independent brochure snapshot, preserving hidden store order", () => {
    const settings = resolveSettings(null);
    settings.stores = moveItem(settings.stores, 2, 0);
    settings.stores[1]!.visible = false;
    settings.brochure.format = "a4";
    settings.brochure.storesDisplay = "footer";
    settings.brochure.storeFields.phone = false;
    settings.brochure.contactVisibility.email = false;
    settings.categorySavingModes.TV = {
      mode: "percentage",
      subcategories: { OLED: "amount" },
    };
    const snapshot = campaignDefaults(settings, 4);
    settings.stores[0]!.name = "Changed later";
    settings.categorySavingModes.TV!.mode = "amount";
    settings.brochure.format = "square1080";
    expect(snapshot).toMatchObject({
      defaultsVersion: 4,
      brochureFormat: "a4",
      includeStoresPage: false,
      includeStoresFooter: true,
    });
    expect(snapshot.selectedStoreIndexes).not.toContain(1);
    expect(snapshot.storeOrder?.[0]).toBe(0);
    expect(snapshot.storesSnapshot?.stores[0]?.name).toBe("Royal Mall");
    expect(
      savingModeFor(snapshot, { category: "TV", subcategory: "LCD" }),
    ).toBe("percentage");
    expect(
      savingModeFor(snapshot, { category: "TV", subcategory: "OLED" }),
    ).toBe("amount");
    expect(
      savingModeFor(snapshot, { category: "TV", savingMode: "amount" }),
    ).toBe("amount");
    expect(visibleStoreLines(snapshot, legacy.stores[0] ?? {}).phone).toBe("");
    expect(visibleContact(snapshot, settings.contact).email).toBe("");
  });
  it("does not restore deleted or hidden campaign types and repairs their default", () => {
    const settings = resolveSettings(null);
    settings.campaignTypes[0]!.visible = false;
    repairDefaultType(settings);
    expect(defaultCampaignType(settings).name).toBe("Happy Hour");
    expect(
      visibleCampaignTypes(settings).some(
        (item) => item.name === "Black Friday",
      ),
    ).toBe(false);
    settings.campaignTypes = [];
    repairDefaultType(settings);
    expect(resolveSettings(settings).campaignTypes).toEqual([]);
    expect(defaultCampaignType(settings).name).toBe("Custom campaign");
    const explicitNone = resolveSettings(null);
    explicitNone.defaultCampaignTypeId = "";
    explicitNone.campaignTypes.push({
      id: "new",
      name: "New",
      tagline: "",
      visible: true,
    });
    repairDefaultType(explicitNone);
    expect(explicitNone.defaultCampaignTypeId).toBe("");
    expect(defaultCampaignType(explicitNone).name).toBe("Custom campaign");
  });
  it("applies configured feature icons only to inherited artwork and respects product edits and deletions", () => {
    const product = {
      code: "AC1",
      name: "Kondicioner WiFi inverter A++",
      category: "Kondicioner",
    };
    const campaign = {
      iconDefaults: {
        wifi: { image: "/api/assets/custom-wifi", visible: true },
        inverter: { image: "", visible: false },
      },
    };
    const inherited = defaultProductArtworks(product, campaign);
    expect(inherited.find((item) => item.type === "wifi")?.image).toBe(
      "/api/assets/custom-wifi",
    );
    expect(inherited.some((item) => item.type === "inverter")).toBe(false);
    const custom = [
      {
        id: "personal",
        image: "/api/assets/personal",
        type: "wifi",
        x: 0,
        y: 0,
        width: 10,
      },
    ];
    expect(
      effectiveProductArtworks(
        { ...product, productArtworks: custom },
        campaign,
      ),
    ).toEqual(custom);
    expect(
      effectiveProductArtworks({ ...product, productArtworks: [] }, campaign),
    ).toEqual([]);
  });
  it("preserves unknown reference fields and validates custom logo choices and duplicate types", () => {
    const resolved = resolveSettings({
      ...legacy,
      referenceDetail: { keep: "all of this" },
    });
    expect(resolved.referenceDetail).toEqual({ keep: "all of this" });
    expect(
      workspaceSettingsSchema.safeParse({
        ...resolved,
        brochure: {
          ...resolved.brochure,
          priceLogo: "custom",
          customPriceLogo: "",
        },
      }).success,
    ).toBe(false);
    expect(
      workspaceSettingsSchema.safeParse({
        ...resolved,
        campaignTypes: [resolved.campaignTypes[0], resolved.campaignTypes[0]],
      }).success,
    ).toBe(false);
    expect(
      workspaceSettingsSchema.safeParse({
        ...resolved,
        brandAssets: { neptun: "https://external.example/logo.png" },
      }).success,
    ).toBe(false);
  });
});
