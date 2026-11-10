import React from "react";
import { t } from "./i18n";
import "../../styles/details-placement-choices.css";

export type DetailsPlacement = "left" | "right" | "bottom";
const choices = [
  { value: "left", label: "Left", description: "Left of image" },
  { value: "right", label: "Right", description: "Right of image" },
  { value: "bottom", label: "Bottom", description: "Below image" },
] as const;

export function DetailsPlacementChoices({
  value,
  onChange,
}: {
  value: DetailsPlacement;
  onChange: (value: DetailsPlacement) => void;
}) {
  return (
    <section className="cs-details-placement-choices">
      <strong>{t("Product details position")}</strong>
      <div role="group" aria-label={t("Product details position")}>
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            aria-label={t(choice.description)}
            aria-pressed={value === choice.value}
            onClick={() => onChange(choice.value)}
          >
            <svg
              viewBox="0 0 54 38"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
            >
              <rect x="1" y="1" width="52" height="36" rx="4" opacity=".3" />
              {choice.value === "bottom" ? (
                <>
                  <rect
                    x="12"
                    y="5"
                    width="30"
                    height="20"
                    rx="2"
                    fill="currentColor"
                    opacity=".16"
                  />
                  {[6, 21, 36].map((x) => (
                    <rect key={x} x={x} y="29" width="12" height="4" rx="1" />
                  ))}
                </>
              ) : (
                <>
                  <rect
                    x={choice.value === "left" ? 20 : 6}
                    y="5"
                    width="28"
                    height="28"
                    rx="2"
                    fill="currentColor"
                    opacity=".16"
                  />
                  {[8, 16, 24].map((y) => (
                    <rect
                      key={y}
                      x={choice.value === "left" ? 5 : 39}
                      y={y}
                      width="10"
                      height="5"
                      rx="1"
                    />
                  ))}
                </>
              )}
            </svg>
            <span>{t(choice.label)}</span>
          </button>
        ))}
      </div>
      <small>
        {t(
          "Choose the details position. You can still drag each block on the page.",
        )}
      </small>
    </section>
  );
}
