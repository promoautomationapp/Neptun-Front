import React from "react";
import type { Artwork } from "../../domain/models";
import { ColorField } from "./ColorField";
import { t } from "./i18n";

export function PageBannerFields({
  artwork,
  onChange,
}: {
  artwork: Artwork;
  onChange: (change: Partial<Artwork>) => void;
}) {
  return (
    <span className="page-banner-fields">
      <ColorField
        compact
        label={t("Banner background")}
        value={artwork.backgroundColor || "#00000000"}
        onChange={(backgroundColor) => onChange({ backgroundColor })}
      />
      <button
        type="button"
        className="page-banner-transparent"
        aria-label={t("Transparent banner background")}
        title={t("Transparent banner background")}
        aria-pressed={
          !artwork.backgroundColor ||
          /^#[0-9a-f]{6}00$/i.test(artwork.backgroundColor)
        }
        onClick={() => onChange({ backgroundColor: "#00000000" })}
      >
        ∅
      </button>
      {(["width", "height"] as const).map((key) => (
        <label
          key={key}
          title={t(key === "width" ? "Banner width" : "Banner height")}
        >
          <span>{key === "width" ? "W" : "H"}</span>
          <input
            type="number"
            min="1"
            max={key === "width" ? "100" : "70"}
            step=".5"
            aria-label={t(key === "width" ? "Banner width" : "Banner height")}
            value={artwork[key] || 7}
            onChange={(event) =>
              onChange({
                [key]: Math.max(
                  1,
                  Math.min(
                    key === "width" ? 100 : 70,
                    Number(event.target.value) || 1,
                  ),
                ),
              })
            }
          />
          <small>%</small>
        </label>
      ))}
    </span>
  );
}
