import React, { useRef } from "react";
import type { Product } from "../../domain/models";
import { RedReferencePrice } from "./RedReferencePrice";
import { ReferencePriceCard } from "./ReferencePriceCard";
import { t } from "./i18n";
import "../../styles/price-design-choices.css";

export type DefaultPriceStyle = "current" | "card";

export interface PriceDesignChoicesProps {
  value: DefaultPriceStyle;
  onChange: (style: DefaultPriceStyle) => void;
  className?: string;
}

const sample: Product = {
  code: "price-design-preview",
  name: "Price design preview",
  regular: 399,
  sale: 299,
};
const choices = [
  { value: "current", label: "Orange price" },
  { value: "card", label: "Blue price" },
] as const;

/** Show the actual default artwork, so the choice matches the exported price. */
export function PriceDesignChoices({
  value,
  onChange,
  className = "",
}: PriceDesignChoicesProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div
      className={`cs-price-design-choices ${className}`.trim()}
      role="radiogroup"
      aria-label={t("Default price design")}
    >
      {choices.map((choice, index) => {
        const selected = value === choice.value;
        return (
          <button
            key={choice.value}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-label={t(choice.label)}
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className="cs-price-design-choice"
            onClick={() => onChange(choice.value)}
            onKeyDown={(event) => {
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? choices.length - 1
                    : [
                          "ArrowLeft",
                          "ArrowRight",
                          "ArrowUp",
                          "ArrowDown",
                        ].includes(event.key)
                      ? (index + 1) % choices.length
                      : null;
              if (next === null) return;
              event.preventDefault();
              onChange(choices[next]!.value);
              buttons.current[next]?.focus();
            }}
          >
            <span className="cs-price-design-preview" aria-hidden="true">
              <span className={`cs-price-design-native ${choice.value}`}>
                {choice.value === "current" ? (
                  <RedReferencePrice product={sample} />
                ) : (
                  <ReferencePriceCard product={sample} showSaving={false} />
                )}
              </span>
            </span>
            <span className="cs-price-design-caption">
              <span className="cs-price-design-radio" aria-hidden="true" />
              <span>{t(choice.label)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
