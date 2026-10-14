import type { Campaign, CampaignMutator, Product } from "../../domain/models";
import React from "react";
import { t } from "./i18n";

type SavingChoice = "" | "amount" | "percentage";

interface ModeChoicesProps {
  value: string;
  onChange: (value: SavingChoice) => void;
  label: string;
}

export interface CategorySavingsControlsProps {
  campaign: Campaign;
  onUpdate: (update: CampaignMutator) => void;
}

const choices: readonly { value: SavingChoice; label: string }[] = [
  { value: "", label: "Use parent default" },
  { value: "amount", label: "Kurseni €" },
  { value: "percentage", label: "Zbritje %" },
];

function ModeChoices({ value, onChange, label }: ModeChoicesProps) {
  return (
    <div className="cs-category-saving-options" role="group" aria-label={label}>
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          className={value === choice.value ? "chosen" : ""}
          aria-pressed={value === choice.value}
          onClick={() => onChange(choice.value)}
        >
          {t(choice.label)}
        </button>
      ))}
    </div>
  );
}

export function CategorySavingsControls({
  campaign,
  onUpdate,
}: CategorySavingsControlsProps) {
  const groups = (campaign.products || []).reduce<Record<string, Product[]>>(
    (result, product) => {
      (result[product.category || "Other"] ||= []).push(product);
      return result;
    },
    {},
  );
  if (!Object.keys(groups).length) return null;
  const update = (
    category: string,
    subcategory: string | null,
    value: SavingChoice,
  ) =>
    onUpdate((draft) => {
      draft.categorySavingModes ||= {};
      const rule = draft.categorySavingModes[category] || {
        mode: "",
        subcategories: {},
      };
      if (subcategory == null) rule.mode = value;
      else {
        rule.subcategories ||= {};
        if (value) rule.subcategories[subcategory] = value;
        else delete rule.subcategories[subcategory];
      }
      if (!rule.mode && !Object.keys(rule.subcategories || {}).length)
        delete draft.categorySavingModes[category];
      else draft.categorySavingModes[category] = rule;
    });
  return (
    <details className="cs-category-savings">
      <summary>
        <strong>{t("Savings labels by category")}</strong>
        <span>
          {t(
            "Set a default for each category or subcategory. A product choice always wins.",
          )}
        </span>
      </summary>
      {Object.entries(groups).map(([category, products]) => {
        const rule = campaign.categorySavingModes?.[category];
        const subcategories = [
          ...new Set(
            products
              .map((product) => product.subcategory)
              .filter((value): value is string => Boolean(value)),
          ),
        ].sort((a, b) => a.localeCompare(b));
        return (
          <div className="cs-category-saving-group" key={category}>
            <div className="cs-category-saving-line">
              <strong>{category}</strong>
              <ModeChoices
                label={category}
                value={rule?.mode || ""}
                onChange={(value) => update(category, null, value)}
              />
            </div>
            {subcategories.map((subcategory) => (
              <div
                className="cs-category-saving-line subcategory"
                key={subcategory}
              >
                <span>{subcategory}</span>
                <ModeChoices
                  label={`${category} / ${subcategory}`}
                  value={rule?.subcategories?.[subcategory] || ""}
                  onChange={(value) => update(category, subcategory, value)}
                />
              </div>
            ))}
          </div>
        );
      })}
    </details>
  );
}
