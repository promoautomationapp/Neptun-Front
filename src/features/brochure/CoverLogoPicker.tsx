import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { resolveAsset } from "../../api/client";
import { FileUpload } from "../../components/FileUpload";
import { Modal } from "../../components/Modal";
import type { Settings } from "../../domain/models";
import { reusableImages } from "../settings/ReusableImages";
import type { LogoAsset } from "../settings/settings.schema";
import { t } from "./i18n";
import { readImage } from "./utils";
import "./cover-logo-picker.css";

export interface CoverLogoPickerProps {
  settings?: Settings;
  currentSource?: string;
  title?: string;
  kind?: "logo" | "image";
  onSelect: (source: string) => void;
  onClose: () => void;
}

export function CoverLogoPicker({
  settings,
  currentSource = "",
  title,
  kind = "logo",
  onSelect,
  onClose,
}: CoverLogoPickerProps) {
  const isImage = kind === "image";
  const libraryLabel = t(isImage ? "Saved images" : "Saved logos");
  const searchLabel = t(isImage ? "Search images" : "Search logos");
  const uploadLabel = t(isImage ? "Upload image" : "Upload logo");
  const previewLabel = t(isImage ? "Image preview" : "Logo preview");
  const assets = useMemo(() => {
    const choices = reusableImages(settings);
    const add = (url: string | undefined, name: string) => {
      if (url && !choices.some((asset) => asset.url === url))
        choices.push({ id: `cover-logo-${choices.length}`, name, url });
    };
    add(settings?.brandAssets?.neptun, "NEPTUN");
    add(settings?.brochure?.coverLogoSource, t("Saved cover logo"));
    add(currentSource, t(isImage ? "Current image" : "Current logo"));
    return choices;
  }, [settings, currentSource, isImage]);
  const [selected, setSelected] = useState(
    currentSource || assets[0]?.url || "",
  );
  const [uploaded, setUploaded] = useState<LogoAsset | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  React.useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const choices = uploaded
    ? [uploaded, ...assets.filter((asset) => asset.url !== uploaded.url)]
    : assets;
  const filtered = choices.filter((asset) =>
    asset.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  async function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
      setError(t("Choose an image under 12 MB."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const source = await readImage(file);
      if (active.current) {
        setUploaded({
          id: "uploaded-cover-logo",
          name: file.name,
          url: source,
        });
        setSelected(source);
        setQuery("");
      }
    } catch {
      if (active.current) setError(t("Could not read this image."));
    } finally {
      if (active.current) setBusy(false);
    }
  }
  const modal = (
    <Modal
      title={title || t(isImage ? "Change image" : "Change cover logo")}
      onClose={onClose}
      wide
    >
      <div className="cs-cover-logo-picker">
        <p>
          {t(
            isImage
              ? "Choose a saved image or upload a new one."
              : "Choose a saved logo or upload a new one.",
          )}
        </p>
        <div className="cs-cover-logo-layout">
          <section className="cs-cover-logo-library" aria-label={libraryLabel}>
            <div className="cs-cover-logo-library-head">
              <strong>{libraryLabel}</strong>
              <span>{choices.length}</span>
            </div>
            <input
              type="search"
              aria-label={searchLabel}
              placeholder={searchLabel}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="cs-cover-logo-choices">
              {filtered.map((asset) => (
                <button
                  key={asset.url}
                  type="button"
                  aria-label={`${t(isImage ? "Select image" : "Select logo")}: ${asset.name}`}
                  aria-pressed={selected === asset.url}
                  onClick={() => {
                    setSelected(asset.url);
                    setError("");
                  }}
                >
                  <span className="cs-cover-logo-thumbnail">
                    <img src={resolveAsset(asset.url)} alt="" />
                  </span>
                  <span>{asset.name}</span>
                </button>
              ))}
              {!filtered.length && <p>{t("No matches found")}</p>}
            </div>
            <FileUpload
              accept="image/*"
              aria-label={uploadLabel}
              busy={busy}
              onChange={(event) => upload(event.target.files?.[0])}
            >
              {uploadLabel}
            </FileUpload>
            <small>PNG, JPG, WebP, SVG · 12 MB</small>
          </section>
          <section className="cs-cover-logo-preview" aria-label={previewLabel}>
            <strong>{previewLabel}</strong>
            {(["light", "dark"] as const).map((background) => (
              <figure key={background}>
                <div className={`cs-cover-logo-preview-${background}`}>
                  {selected && (
                    <img
                      src={resolveAsset(selected)}
                      alt={t(isImage ? "Selected image" : "Selected logo")}
                    />
                  )}
                </div>
                <figcaption>
                  {t(
                    background === "light"
                      ? "Light background"
                      : "Dark background",
                  )}
                </figcaption>
              </figure>
            ))}
          </section>
        </div>
        {error && (
          <p className="cs-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="cs-modal-actions">
        <button type="button" className="cs-button" onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          type="button"
          className="cs-button primary"
          disabled={!selected || busy}
          onClick={() => {
            onSelect(selected);
            onClose();
          }}
        >
          {t(isImage ? "Use this image" : "Use this logo")}
        </button>
      </div>
    </Modal>
  );
  return typeof document === "undefined"
    ? modal
    : createPortal(modal, document.body);
}
