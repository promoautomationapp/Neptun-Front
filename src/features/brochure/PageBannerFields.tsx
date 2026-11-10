import React from "react";
import type { Artwork } from "../../domain/models";
import { ColorField } from "./ColorField";
import { t } from "./i18n";
import { FileUpload } from "../../components/FileUpload";
import { EditorIcon } from "./EditorIcon";
import { LayerOpacityControl } from "./LayerOpacityControl";
import { bannerImageOverlayStyle } from "./pageBanners";
import { readImage } from "./utils";
import "../../styles/page-banners.css";

export function BannerImage({ artwork }: { artwork: Artwork }) {
  return (
    <span className="page-banner-image">
      <img
        src={artwork.image}
        alt={artwork.name || t("Image banner")}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: artwork.imageFit || "cover",
        }}
      />
      {artwork.bannerOverlay && (
        <span
          className="page-banner-image-overlay"
          style={bannerImageOverlayStyle(artwork.bannerOverlay)}
          aria-hidden="true"
        >
          {artwork.bannerOverlay.type === "image" &&
            artwork.bannerOverlay.image && (
              <img src={artwork.bannerOverlay.image} alt="" draggable={false} />
            )}
        </span>
      )}
    </span>
  );
}

/** Image effects are separate from the original banner and can always be removed. */
export function BannerImageFields({
  artwork,
  onChange,
}: {
  artwork: Artwork;
  onChange: (change: Partial<Artwork>) => void;
}) {
  const overlay = artwork.bannerOverlay;
  function update(change: Partial<NonNullable<Artwork["bannerOverlay"]>>) {
    onChange({
      bannerOverlay: {
        type: "color",
        color: "#000000",
        opacity: 0.4,
        ...overlay,
        ...change,
      },
    });
  }
  return (
    <fieldset className="banner-image-settings">
      <legend>
        <EditorIcon name="layers" /> {t("Banner image overlay")}
      </legend>
      <div className="banner-image-settings-preview">
        <BannerImage artwork={artwork} />
      </div>
      <div
        className="banner-overlay-types"
        role="group"
        aria-label={t("Overlay style")}
      >
        {(["none", "color", "gradient", "image"] as const).map((type) => (
          <button
            type="button"
            key={type}
            aria-pressed={(overlay?.type || "none") === type}
            onClick={() =>
              type === "none"
                ? onChange({ bannerOverlay: undefined })
                : update({ type })
            }
          >
            <i className={`banner-overlay-sample ${type}`} aria-hidden="true" />
            {t(
              {
                none: "None",
                color: "Color",
                gradient: "Gradient",
                image: "Image",
              }[type],
            )}
          </button>
        ))}
      </div>
      {overlay && (
        <>
          {overlay.type !== "image" && (
            <div className="banner-overlay-colors">
              <label>
                {t(
                  overlay.type === "gradient"
                    ? "Gradient start"
                    : "Overlay color",
                )}
                <ColorField
                  label={t("Overlay color")}
                  value={overlay.color || "#000000"}
                  onChange={(color) => update({ color })}
                />
              </label>
              {overlay.type === "gradient" && (
                <label>
                  {t("Gradient end")}
                  <ColorField
                    label={t("Gradient end")}
                    value={overlay.endColor || "#00000000"}
                    onChange={(endColor) => update({ endColor })}
                  />
                </label>
              )}
            </div>
          )}
          {overlay.type === "gradient" && (
            <label className="banner-overlay-angle">
              {t("Gradient direction")}
              <input
                type="number"
                aria-label={t("Gradient direction")}
                min="0"
                max="360"
                step="15"
                value={overlay.angle ?? 180}
                onChange={(event) =>
                  update({
                    angle: Math.min(
                      360,
                      Math.max(0, Number(event.target.value) || 0),
                    ),
                  })
                }
              />
              <small>°</small>
            </label>
          )}
          {overlay.type === "image" && (
            <FileUpload
              accept="image/*"
              aria-label={t("Upload overlay image")}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (
                  !file.type.startsWith("image/") ||
                  file.size > 12 * 1024 * 1024
                )
                  throw Error(t("Choose an image under 12 MB."));
                update({ image: await readImage(file) });
              }}
            >
              <EditorIcon name="image" />{" "}
              {t(
                overlay.image
                  ? "Replace overlay image"
                  : "Upload overlay image",
              )}
            </FileUpload>
          )}
          <LayerOpacityControl
            label={t("Overlay opacity")}
            value={overlay.opacity ?? 0.4}
            onChange={(opacity) => update({ opacity })}
          />
          <p>
            {t(
              "The overlay changes only this banner. The original image is preserved.",
            )}
          </p>
        </>
      )}
    </fieldset>
  );
}

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
            max="100"
            step=".5"
            aria-label={t(key === "width" ? "Banner width" : "Banner height")}
            value={artwork[key] || 7}
            onChange={(event) =>
              onChange({
                [key]: Math.max(
                  1,
                  Math.min(100, Number(event.target.value) || 1),
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
