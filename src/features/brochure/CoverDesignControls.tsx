import { t } from "./i18n";
import type {
  Campaign,
  CampaignMutator,
  Gradient,
  Placement,
} from "../../domain/models";
import React from "react";
import { coverProducts } from "./campaignPages";
import {
  COVER_TEXT_COLORS,
  coverTextColor,
  coverMessageVisible,
  resetCoverProductPositions,
  featureCoverProduct,
  makeCoverImageLayer,
} from "./coverPresentation";
import { readImage } from "./utils";
import { coverElementPlacement, COVER_GRADIENT_REGIONS } from "./coverElements";
import "../../styles/cover-elements.css";

const toggles = [
  ["showCoverLogo", "Logo"],
  ["showCoverBand", "UUU / hajde!"],
  ["showCoverHeadline", "Title"],
  ["showCoverMessage", "Message"],
] as const;
export interface CoverDesignControlsProps {
  campaign: Campaign;
  onUpdate: (mutate: CampaignMutator) => void;
  onToast?: (message: string) => void;
}
export function CoverDesignControls({
  campaign,
  onUpdate,
  onToast,
}: CoverDesignControlsProps) {
  const [selected, setSelected] = React.useState("logo");
  const update = <Field extends keyof Campaign>(
    field: Field,
    value: Campaign[Field],
  ) =>
    onUpdate((draft: Campaign) => {
      draft[field] = value;
      if (COVER_TEXT_COLORS.some(([colorField]) => colorField === field)) {
        draft.coverTextColorOverrides ||= {};
        draft.coverTextColorOverrides[String(field)] = true;
      }
      if (
        ["showCoverBand", "showCoverMessage", "coverProductLayout"].includes(
          field,
        )
      ) {
        resetCoverProductPositions(draft);
        if (field === "showCoverBand" && value) {
          const photo = draft.pageArtworks?.cover?.find((item) => item.id === "cover-lifestyle");
          if (photo && photo.x === 4 && photo.width === 92) Object.assign(photo, { x: 0, y: 0, width: 100, height: 49, imageFit: "cover" });
        }
        if (field === "showCoverBand" && value)
          draft.coverBannerProductCode = "";
      }
      if (field === "coverLogoSource")
        draft.coverLogoStyle =
          value === "/api/assets/legacy/assets/neptun-logo-framed.png"
            ? "framed"
            : value === "/api/assets/legacy/assets/neptun-cover-logo.png"
              ? "original"
              : "custom";
    });
  const place = (next: Partial<Placement>) =>
    onUpdate((draft: Campaign) => {
      draft.coverElementPlacements ||= {};
      draft.coverElementPlacements[selected] = {
        ...coverElementPlacement(draft, selected),
        ...next,
      };
    });
  const placement = coverElementPlacement(campaign, selected);
  async function upload(file: File | undefined, field: "coverLogoSource") {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      onToast?.("Choose an image under 12 MB.");
      return;
    }
    try {
      update(field, await readImage(file));
    } catch {
      onToast?.("Could not read this image.");
    }
  }
  const gradient: Partial<Gradient> & { opacity?: number } =
    campaign.coverOverlayGradient || {
      from: "#0d5192",
      to: "#58a5ce",
      angle: 90,
      opacity: 0.85,
    };
  const coordinates: Array<"x" | "y" | "width" | "height"> =
    selected === "gradient"
      ? ["x", "y", "width", "height"]
      : ["x", "y", "width"];
  return (
    <div className="cs-cover-design-controls">
      <p>
        Choose the background above. Drag or resize each visible element on the
        cover.
      </p>
      <div className="cs-cover-visibility">
        {toggles.map(([field, label]) => (
          <label key={field}>
            <input
              type="checkbox"
              checked={
                field === "showCoverBand"
                  ? campaign[field] === true
                  : field === "showCoverMessage"
                    ? coverMessageVisible(campaign)
                    : campaign[field] !== false
              }
              onChange={(event) => update(field, event.target.checked)}
            />
            {label}
          </label>
        ))}
      </div>
      <label>
        Product layout
        <select
          aria-label="Cover product layout"
          value={
            campaign.coverProductLayout ||
            (coverProducts(campaign).length >= 3 ? "hero" : "pair")
          }
          onChange={(event) => update("coverProductLayout", event.target.value)}
        >
          <option value="pair">Two products beside each other</option>
          <option value="hero">One featured product above two</option>
          <option value="row">Products in one row</option>
        </select>
      </label>
      {campaign.showCoverBand !== true && (
        <label>
          {t("Product in the banner area")}
          <select
            aria-label="Product in cover banner area"
            value={campaign.coverBannerProductCode || ""}
            onChange={(event) =>
              onUpdate((draft) =>
                featureCoverProduct(draft, event.target.value),
              )
            }
          >
            <option value="">Use the chosen product layout</option>
            {coverProducts(campaign).map((product) => (
              <option key={product.code} value={String(product.code)}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p>
        Move or resize complete product blocks on the cover to create your own
        arrangement.
      </p>
      <label>
        Logo
        <select
          aria-label="Cover logo artwork"
          value={campaign.coverLogoSource || "default"}
          onChange={(event) =>
            update(
              "coverLogoSource",
              event.target.value === "default" ? "" : event.target.value,
            )
          }
        >
          <option value="default">NEPTUN full logo</option>
          <option value="/api/assets/legacy/assets/social/neptun-white.png">
            NEPTUN white N
          </option>
          <option value="/api/assets/legacy/assets/social/neptun-blue.png">
            NEPTUN blue N
          </option>
          <option value="/api/assets/legacy/assets/neptun-cover-logo.png">
            NEPTUN framed logo
          </option>
          {campaign.coverLogoSource &&
            ![
              "/api/assets/legacy/assets/social/neptun-white.png",
              "/api/assets/legacy/assets/social/neptun-blue.png",
              "/api/assets/legacy/assets/neptun-cover-logo.png",
            ].includes(campaign.coverLogoSource) && (
              <option value={campaign.coverLogoSource}>Uploaded logo</option>
            )}
        </select>
      </label>
      <label className="cs-cover-file">
        Upload logo
        <input
          type="file"
          accept="image/*"
          aria-label="Upload cover logo"
          onChange={(event) => {
            upload(event.target.files?.[0], "coverLogoSource");
            event.target.value = "";
          }}
        />
      </label>
      <label>
        Title
        <input
          aria-label="Editable cover title"
          value={campaign.coverHeadline ?? campaign.name ?? ""}
          onChange={(event) => update("coverHeadline", event.target.value)}
        />
      </label>
      <label>
        Optional message
        <textarea
          rows={2}
          aria-label="Editable cover message"
          value={campaign.tagline ?? ""}
          onChange={(event) => update("tagline", event.target.value)}
        />
      </label>
      <div className="cs-cover-gradient-colors">
        {COVER_TEXT_COLORS.map(([field, label]) => (
          <label key={field}>
            {t(label)}
            <input
              type="color"
              aria-label={label}
              value={coverTextColor(campaign, field)}
              onInput={(event) => update(field, event.currentTarget.value)}
              onChange={(event) => update(field, event.target.value)}
            />
          </label>
        ))}
      </div>
      {(campaign.coverImage || campaign.coverBackgroundImage) && (
        <button
          type="button"
          onClick={() =>
            onUpdate((draft) => makeCoverImageLayer(draft, crypto.randomUUID()))
          }
        >
          {t("Edit cover photo as a movable layer")}
        </button>
      )}
      <details>
        <summary>UUU artwork & gradient</summary>
        <label className="cs-cover-file">
          Replace UUU artwork
          <input
            type="file"
            accept="image/*"
            aria-label="Upload UUU artwork"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (
                file?.type.startsWith("image/") &&
                file.size <= 12 * 1024 * 1024
              )
                readImage(file)
                  .then((image) =>
                    onUpdate((draft: Campaign) => {
                      draft.brandAssets ||= {};
                      draft.brandAssets.coverBand = image;
                    }),
                  )
                  .catch(() => onToast?.("Could not read this image."));
              event.target.value = "";
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={campaign.showCoverGradient === true}
            onChange={(event) =>
              update("showCoverGradient", event.target.checked)
            }
          />
          Show gradient layer
        </label>
        {campaign.showCoverGradient && (
          <>
            <label>
              Gradient area
              <select
                aria-label="Cover gradient area"
                value={campaign.coverGradientRegion || "between"}
                onChange={(event) => {
                  const region = event.target.value;
                  onUpdate((draft: Campaign) => {
                    draft.coverGradientRegion = region;
                    draft.coverElementPlacements ||= {};
                    if (COVER_GRADIENT_REGIONS[region])
                      draft.coverElementPlacements.gradient = {
                        ...COVER_GRADIENT_REGIONS[region],
                      };
                  });
                }}
              >
                <option value="between">Under logo, above UUU</option>
                <option value="whole">Whole background</option>
                <option value="right">Right side</option>
                <option value="bottom">Bottom half</option>
                <option value="custom">Custom · drag and resize</option>
              </select>
            </label>
            <div className="cs-cover-gradient-colors">
              {(["from", "to"] as const).map((key) => (
                <label key={key}>
                  {key === "from" ? "Start" : "End"}
                  <input
                    type="color"
                    aria-label={`Cover gradient ${key}`}
                    value={gradient[key]}
                    onChange={(event) =>
                      update("coverOverlayGradient", {
                        ...gradient,
                        [key]: event.target.value,
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Gradient angle
              <input
                type="range"
                min="0"
                max="360"
                value={gradient.angle}
                onChange={(event) =>
                  update("coverOverlayGradient", {
                    ...gradient,
                    angle: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              Gradient opacity
              <input
                type="range"
                min="0"
                max="1"
                step=".05"
                value={gradient.opacity ?? 0.85}
                onChange={(event) =>
                  update("coverOverlayGradient", {
                    ...gradient,
                    opacity: Number(event.target.value),
                  })
                }
              />
            </label>
          </>
        )}
      </details>
      <details>
        <summary>Position & size</summary>
        <label>
          Element
          <select
            aria-label="Cover element to position"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="logo">Logo</option>
            <option value="headline">Title</option>
            <option value="band">UUU</option>
            <option value="message">Message</option>
            <option value="gradient">Gradient</option>
          </select>
        </label>
        <div className="cs-cover-position-fields">
          {coordinates.map((key) => (
            <label key={key}>
              {key}
              <input
                type="number"
                min="0"
                max="100"
                step=".5"
                aria-label={`Cover element ${key}`}
                value={placement[key]}
                onChange={(event) =>
                  place({
                    [key]: Math.max(
                      0,
                      Math.min(100, Number(event.target.value)),
                    ),
                  })
                }
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            onUpdate((draft: Campaign) => {
              if (draft.coverElementPlacements)
                delete draft.coverElementPlacements[selected];
            })
          }
        >
          Reset selected position
        </button>
      </details>
    </div>
  );
}
