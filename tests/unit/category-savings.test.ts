import { describe, expect, it } from "vitest";
import {
  categoryNodes,
  productCategoryPath,
} from "../../src/features/settings/categoryHierarchy";
import { resolvedSavingsMode } from "../../src/features/settings/savingsPolicy";
import { campaignDefaults } from "../../src/features/settings/campaign-defaults";
import { resolveSettings } from "../../src/features/settings/settings.schema";
describe("dynamic category savings", () => {
  it("keeps all hierarchy levels and removes only navigation bullets", () => {
    const facet = {
      category: "SHTEPIA",
      subcategory: "KABLLO",
      categoryPath: "Ballina > SHTEPIA > •TV & AUDIO > -AKSESORË > KABLLO",
    };
    expect(productCategoryPath(facet)).toBe("TV & AUDIO > AKSESORË > KABLLO");
    expect(categoryNodes([facet]).map((node) => node.depth)).toEqual([0, 1, 2]);
  });
  it("uses percentages for small discounts, euros for large discounts and product overrides first", () => {
    const campaign = campaignDefaults(resolveSettings(null));
    expect(resolvedSavingsMode(campaign, { regular: 50, sale: 40 })).toBe(
      "percentage",
    );
    expect(resolvedSavingsMode(campaign, { regular: 499, sale: 399 })).toBe(
      "amount",
    );
    expect(
      resolvedSavingsMode(campaign, {
        regular: 50,
        sale: 40,
        savingMode: "amount",
      }),
    ).toBe("amount");
    expect(
      resolvedSavingsMode(campaign, {
        category: "ELEKTROSHTËPIAKE TË MËDHA",
        categoryPath: "ELEKTROSHTËPIAKE TË MËDHA > AKSESORË",
        regular: 19.99,
        sale: 14.99,
      }),
    ).toBe("percentage");
    campaign.automaticSavings!.amountThreshold = 150;
    expect(resolvedSavingsMode(campaign, { regular: 499, sale: 399 })).toBe(
      "percentage",
    );
  });
  it("inherits the most specific branch without confusing same-named leaves in different branches", () => {
    const campaign = {
      automaticSavings: { enabled: true, amountThreshold: 50 },
      categoryPathSavingModes: {
        TECH: "percentage" as const,
        "TECH > TV > AKSESORË": "amount" as const,
        "TECH > TV > AKSESORË > KABLLO": "percentage" as const,
      },
    };
    expect(
      resolvedSavingsMode(campaign, {
        categoryPath: "TECH > TV > AKSESORË > MBAJTËSE",
        regular: 50,
        sale: 40,
      }),
    ).toBe("amount");
    expect(
      resolvedSavingsMode(campaign, {
        categoryPath: "TECH > TV > AKSESORË > KABLLO",
        regular: 499,
        sale: 399,
      }),
    ).toBe("percentage");
    expect(
      resolvedSavingsMode(campaign, {
        categoryPath: "TECH > KOMPJUTERË > AKSESORË",
        regular: 499,
        sale: 399,
      }),
    ).toBe("percentage");
  });
  it("preserves legacy campaign behavior and snapshots defaults independently", () => {
    expect(
      resolvedSavingsMode({ savingMode: "amount" }, { regular: 50, sale: 40 }),
    ).toBe("amount");
    const settings = resolveSettings(null);
    const snapshot = campaignDefaults(settings);
    settings.automaticSavings.amountThreshold = 500;
    settings.categoryPathSavingModes["SHTEPIA > TV"] = "percentage";
    expect(snapshot.automaticSavings!.amountThreshold).toBe(50);
    expect(snapshot.categoryPathSavingModes).toEqual({});
  });
});
