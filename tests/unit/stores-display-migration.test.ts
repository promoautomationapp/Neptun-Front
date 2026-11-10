import { describe, expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { campaignSchema } from "../../src/domain/schemas";
import {
  blackFridayDesignDefaults,
  blackCollectionDesignDefaults,
} from "../../src/features/brochure/blackFridayDesign";
import { brochureDesignSnapshot } from "../../src/features/brochure/brochurePresets";
import {
  brochurePageCount,
  includesStoresFooter,
  includesStoresPage,
  migrateStoresDisplaySelection,
  needsStoresDisplayMigration,
} from "../../src/features/brochure/storesSelection";

function legacy(clean = false): Campaign {
  return {
    id: "legacy",
    name: "Legacy black campaign",
    products: [],
    brochureReferenceDesign: clean ? "black-collection" : "black-friday",
    includeStoresPage: false,
    includeStoresFooter: true,
  };
}

describe("saved stores display choices", () => {
  it.each([false, true])(
    "repairs the old forced footer immediately and persists the included final page once (clean=%s)",
    (clean) => {
      const campaign = legacy(clean);
      expect(needsStoresDisplayMigration(campaign)).toBe(true);
      expect(includesStoresPage(campaign)).toBe(true);
      expect(includesStoresFooter(campaign)).toBe(false);
      expect(brochurePageCount(campaign, 11)).toBe(13);
      expect(migrateStoresDisplaySelection(campaign)).toBe(true);
      expect(campaign).toMatchObject({
        includeStoresPage: true,
        includeStoresFooter: false,
        storesDisplayVersion: 1,
      });
      expect(migrateStoresDisplaySelection(campaign)).toBe(false);
      expect(campaignSchema.parse(campaign).storesDisplayVersion).toBe(1);
    },
  );

  it.each(["page", "footer", "none"])(
    "preserves a deliberate %s choice after reopening",
    (choice) => {
      const campaign = {
        ...legacy(),
        includeStoresPage: choice === "page",
        includeStoresFooter: choice === "footer",
        storesDisplayVersion: 1,
      };
      expect(needsStoresDisplayMigration(campaign)).toBe(false);
      expect(migrateStoresDisplaySelection(campaign)).toBe(false);
      expect(includesStoresPage(campaign)).toBe(choice === "page");
      expect(includesStoresFooter(campaign)).toBe(choice === "footer");
    },
  );

  it("leaves regular-design footer and legacy no-stores choices intact", () => {
    const regular = { ...legacy(), brochureReferenceDesign: undefined };
    expect(needsStoresDisplayMigration(regular)).toBe(false);
    expect(includesStoresFooter(regular)).toBe(true);
    const none = { ...legacy(), includeStoresFooter: false };
    expect(needsStoresDisplayMigration(none)).toBe(false);
    expect(includesStoresPage(none)).toBe(false);
    expect(
      needsStoresDisplayMigration({ ...legacy(), storesDisplayVersion: 2 }),
    ).toBe(false);
  });

  it.each([blackFridayDesignDefaults, blackCollectionDesignDefaults])(
    "new black design defaults carry the display choice receipt through the preset snapshot",
    (defaults) => {
      const design = brochureDesignSnapshot(defaults());
      expect(design).toMatchObject({
        includeStoresPage: true,
        includeStoresFooter: false,
        storesDisplayVersion: 1,
      });
    },
  );
});
