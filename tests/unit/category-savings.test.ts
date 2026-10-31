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
  it("uses the offer price below €30, keeps the boundary in euros and respects product overrides", () => {
    const campaign = campaignDefaults(resolveSettings(null));
    expect(resolvedSavingsMode(campaign, { regular: 50, sale: 29.99 })).toBe(
      "percentage",
    );
    expect(resolvedSavingsMode(campaign, { regular: 99, sale: 29.99 })).toBe(
      "percentage",
    );
    expect(resolvedSavingsMode(campaign, { regular: 50, sale: 30 })).toBe(
      "amount",
    );
    expect(resolvedSavingsMode(campaign, { regular: 50, sale: 40 })).toBe(
      "amount",
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
    expect(
      resolvedSavingsMode(campaign, {
        name: "ABC123",
        categoryPath: "Home > Small appliances > COFFEE MACHINES",
        regular: 50,
        sale: 19.99,
      }),
    ).toBe("amount");
    campaign.automaticSavings!.amountThreshold = 500;
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
    expect(snapshot.automaticSavings!.amountThreshold).toBe(30);
    expect(snapshot.categoryPathSavingModes).toEqual({});
  });
  it("keeps coffee machines and vacuums in euros in Albanian and English, with explicit overrides first", () => {
    const campaign = campaignDefaults(resolveSettings(null));
    for (const label of [
      "Aparat kafeje",
      "APARAT PËR KAFE",
      "Coffee machine",
      "Espresso machine",
      "Fshesë elektrike",
      "Fshesat",
      "Vacuum cleaner",
      "Robot vacuum",
    ]) {
      const product = { name: label, regular: 50, sale: 19.99 };
      expect(resolvedSavingsMode(campaign, product), label).toBe("amount");
      expect(
        resolvedSavingsMode(campaign, { ...product, savingMode: "percentage" }),
        label,
      ).toBe("percentage");
    }
    expect(
      resolvedSavingsMode(campaign, {
        name: "Cable",
        categoryPath: "IT > Accessories",
        regular: 40,
        sale: 19.99,
      }),
    ).toBe("percentage");
    expect(
      resolvedSavingsMode(
        { categoryPathSavingModes: { IT: "amount" } },
        { categoryPath: "IT > Accessories", regular: 40, sale: 19.99 },
      ),
    ).toBe("amount");
  });
  it("preserves the meaning of explicit older custom savings-amount rules", () => {
    const settings = resolveSettings({
      automaticSavings: { enabled: true, amountThreshold: 50 },
    });
    expect(settings.automaticSavings.basis).toBe("savings-amount");
    expect(
      resolvedSavingsMode(campaignDefaults(settings), {
        regular: 199,
        sale: 159,
      }),
    ).toBe("percentage");
    expect(
      resolvedSavingsMode(
        {
          automaticSavings: {
            enabled: false,
            amountThreshold: 30,
            basis: "offer-price",
          },
        },
        { regular: 50, sale: 19.99 },
      ),
    ).toBe("amount");
  });
});
