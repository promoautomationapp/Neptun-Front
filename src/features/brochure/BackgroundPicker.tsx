import React, { useEffect, useRef, useState } from "react";
import type { Gradient } from "../../domain/models";
import { t } from "./i18n";
import {
  BACKGROUND_PRESETS,
  lightBackground,
  pageBackgroundContrastColor,
  validBackgroundColor,
  validBackgroundGradient,
} from "./pageBackground";
import { ColorField } from "./ColorField";
import { GRADIENT_DIRECTIONS } from "./gradientDirections";
import { readImage } from "./utils";

export interface BackgroundPickerProps {
  color?: string;
  defaultColor?: string;
  onChange: (color: string) => void;
  onReset?: () => void;
  onAllPages?: () => void;
  gradient?: Partial<Gradient> | null;
  onGradientChange?: (gradient: Gradient) => void;
  image?: string;
  onImageChange?: (image: string) => void | Promise<void>;
  compact?: boolean;
  scopeLabel?: string;
}

export function BackgroundPicker({
  color,
  defaultColor = "#245b89",
  onChange,
  onReset,
  onAllPages,
  gradient,
  onGradientChange,
  image = "",
  onImageChange,
  compact = false,
  scopeLabel = "Changes this page only",
}: BackgroundPickerProps) {
  const selected =
    validBackgroundColor(color) ||
    validBackgroundColor(defaultColor) ||
    "#245b89";
  const selectedGradient = validBackgroundGradient(gradient);
  const activeGradient = selectedGradient || {
    from: "#174877",
    to: "#62addb",
    angle: 135,
  };
  const activeMode = image ? "image" : selectedGradient ? "gradient" : "color";
  const [mode, setMode] = useState(activeMode);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  useEffect(() => setMode(activeMode), [activeMode]);
  const contrastColor = pageBackgroundContrastColor(
    {
      productBackgroundColor: selected,
      productBackgroundGradient: selectedGradient,
    },
    "product",
  );
  const fill = selectedGradient
    ? `linear-gradient(${selectedGradient.angle}deg, ${selectedGradient.from}, ${selectedGradient.to})`
    : selected;
  function chooseColor(value: string) {
    setMode("color");
    onChange(value);
  }
  function chooseGradient(value: Gradient) {
    setMode("gradient");
    onGradientChange?.(value);
  }
  async function uploadImage(file: File | undefined) {
    if (!file || !onImageChange) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError(t("Choose a PNG, JPG or WebP image."));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError(t("Choose a background image smaller than 12 MB."));
      return;
    }
    setUploading(true);
    setError("");
    try {
      await onImageChange(await readImage(file));
      setMode("image");
    } catch {
      setError(t("Could not read that image. Please try another file."));
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className={`cs-background-picker ${compact ? "compact" : ""}`}>
      <div className="cs-background-picker-heading">
        <span className="cs-label">{t("Background")}</span>
        {scopeLabel && <small>{t(scopeLabel)}</small>}
      </div>
      <div
        className="cs-background-preview"
        style={{
          background: fill,
          color: lightBackground(contrastColor) ? "#173856" : "#fff",
        }}
        aria-label={t("Background preview")}
      >
        {image && <img src={image} alt="" />}
        <span>Aa</span>
        <small>
          {t(
            activeMode === "image"
              ? "Image background"
              : activeMode === "gradient"
                ? "Gradient"
                : "Solid color",
          )}
        </small>
      </div>
      <div
        className="cs-background-modes"
        role="group"
        aria-label={t("Background type")}
      >
        <button
          type="button"
          className={mode === "color" ? "chosen" : ""}
          aria-pressed={mode === "color"}
          onClick={() => chooseColor(selected)}
        >
          {t("Solid color")}
        </button>
        {onGradientChange && (
          <button
            type="button"
            className={mode === "gradient" ? "chosen" : ""}
            aria-pressed={mode === "gradient"}
            onClick={() => chooseGradient(activeGradient)}
          >
            {t("Gradient")}
          </button>
        )}
        {onImageChange && (
          <button
            type="button"
            className={mode === "image" ? "chosen" : ""}
            aria-pressed={mode === "image"}
            onClick={() => setMode("image")}
          >
            {t("Image")}
          </button>
        )}
      </div>
      {mode === "color" && (
        <>
          {!compact && (
            <div
              className="cs-background-featured"
              role="group"
              aria-label={t("Page background presets")}
            >
              {BACKGROUND_PRESETS.slice(0, 2).map((preset) => (
                <button
                  type="button"
                  key={preset.color}
                  className={
                    activeMode === "color" && selected === preset.color
                      ? "chosen"
                      : ""
                  }
                  aria-pressed={
                    activeMode === "color" && selected === preset.color
                  }
                  onClick={() => chooseColor(preset.color)}
                >
                  <i style={{ backgroundColor: preset.color }} />
                  <span>{t(preset.label)}</span>
                  <b aria-hidden="true">✓</b>
                </button>
              ))}
            </div>
          )}
          <div
            className="cs-background-palette"
            role="group"
            aria-label={t("More background colors")}
          >
            {(compact ? BACKGROUND_PRESETS : BACKGROUND_PRESETS.slice(2)).map(
              (preset) => (
                <button
                  type="button"
                  key={preset.color}
                  title={t(preset.label)}
                  aria-label={`${t(preset.label)} ${preset.color}`}
                  aria-pressed={
                    activeMode === "color" && selected === preset.color
                  }
                  className={
                    activeMode === "color" && selected === preset.color
                      ? "chosen"
                      : ""
                  }
                  style={{ backgroundColor: preset.color }}
                  onClick={() => chooseColor(preset.color)}
                />
              ),
            )}
          </div>
          <div className="cs-background-color-control">
            <span>{t("Custom color")}</span>
            <ColorField
              label={t("Background color")}
              value={selected}
              onChange={chooseColor}
            />
          </div>
        </>
      )}
      {mode === "gradient" && onGradientChange && (
        <div className="cs-background-gradient">
          <div className="cs-gradient-colors">
            <div>
              <span>{t("From")}</span>
              <ColorField
                label={t("Gradient start")}
                value={activeGradient.from}
                onChange={(value) =>
                  chooseGradient({ ...activeGradient, from: value })
                }
              />
            </div>
            <div>
              <span>{t("To")}</span>
              <ColorField
                label={t("Gradient end")}
                value={activeGradient.to}
                onChange={(value) =>
                  chooseGradient({ ...activeGradient, to: value })
                }
              />
            </div>
          </div>
          <span>{t("Direction")}</span>
          <div
            className="cs-gradient-directions"
            role="group"
            aria-label={t("Gradient direction")}
          >
            {GRADIENT_DIRECTIONS.map((direction) => (
              <button
                type="button"
                key={direction.angle}
                className={
                  Number(activeGradient.angle) === direction.angle
                    ? "chosen"
                    : ""
                }
                title={t(direction.label)}
                aria-label={t(direction.label)}
                aria-pressed={Number(activeGradient.angle) === direction.angle}
                onClick={() =>
                  chooseGradient({ ...activeGradient, angle: direction.angle })
                }
              >
                <i
                  style={{
                    background: `linear-gradient(${direction.angle}deg, ${activeGradient.from}, ${activeGradient.to})`,
                  }}
                />
                <b>{direction.icon}</b>
              </button>
            ))}
          </div>
        </div>
      )}
      {onImageChange && (
        <div
          className={`cs-background-image-control ${mode === "image" ? "active" : ""}`}
        >
          <input
            ref={imageInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label={t("Upload background image")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              uploadImage(file);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => imageInput.current?.click()}
          >
            {uploading
              ? t("Loading image…")
              : `↑ ${t(image ? "Replace background image" : "Upload background image")}`}
          </button>
          {image && (
            <button
              type="button"
              className="remove"
              disabled={uploading}
              aria-label={t("Remove background image")}
              onClick={() => {
                onImageChange("");
                setMode("color");
              }}
            >
              {t("Remove")}
            </button>
          )}
          {mode === "image" && !image && (
            <small>
              {t(
                "PNG, JPG or WebP, up to 12 MB. Fills the page behind products and text.",
              )}
            </small>
          )}
        </div>
      )}
      {error && (
        <p className="cs-error" role="alert">
          {error}
        </p>
      )}
      {(onReset || onAllPages) && (
        <div className="cs-background-picker-foot">
          {onReset && (
            <button type="button" onClick={onReset}>
              {t("Use default")}
            </button>
          )}
          {onAllPages && (
            <button
              type="button"
              className="cs-background-apply-all"
              onClick={() => onAllPages()}
            >
              {t("Apply to all product pages")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
