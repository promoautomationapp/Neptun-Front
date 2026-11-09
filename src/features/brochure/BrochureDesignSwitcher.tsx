import React, { useEffect, useState } from "react";
import type { Campaign, Settings } from "../../domain/models";
import { Modal } from "../../components/Modal";
import {
  BrochurePresetPicker,
  BrochurePresetPreview,
} from "./BrochurePresetPicker";
import {
  availableBrochurePresets,
  type BrochurePreset,
} from "./brochurePresets";
import { t } from "./i18n";
import { EditorIcon } from "./EditorIcon";
import "../../styles/brochure-design-switcher.css";

export function BrochureDesignSwitcher({
  campaign,
  settings,
  onApply,
  open,
  onOpenChange,
}: {
  campaign: Campaign;
  settings: Settings;
  onApply: (preset: BrochurePreset) => void | Promise<void>;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const presets = availableBrochurePresets(settings);
  const [chosen, setChosen] = useState<BrochurePreset | null>(null);
  const [preview, setPreview] = useState<BrochurePreset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) {
      setChosen(null);
      setPreview(null);
      setError("");
    }
  }, [open]);
  const selected =
    chosen ||
    presets.find((preset) => preset.id === campaign.brochurePresetId) ||
    presets[0];
  const close = () => {
    if (!busy) {
      onOpenChange(false);
      setChosen(null);
      setError("");
    }
  };
  return (
    <>
      <button
        type="button"
        className="cs-button secondary cs-brochure-design-switch"
        disabled={busy}
        onClick={() => {
          setChosen(null);
          onOpenChange(true);
        }}
        aria-haspopup="dialog"
        title={t("Change brochure design")}
      >
        <EditorIcon name="layers" />
        <span>{t("Change design")}</span>
      </button>
      {open && (
        <Modal wide title={t("Choose a brochure design")} onClose={close}>
          <p className="cs-preset-gallery-note">
            {t(
              "Your products, prices, text and manual positions are kept. The selected design supplies the backgrounds and default appearance.",
            )}
          </p>
          <fieldset
            className="cs-design-switch-gallery"
            disabled={busy}
            aria-busy={busy}
          >
            <BrochurePresetPicker
              presets={presets}
              value={selected?.id || ""}
              onChange={setChosen}
              onPreview={setPreview}
            />
          </fieldset>
          {error && (
            <p role="alert" className="cs-error">
              {error}
            </p>
          )}
          <div className="cs-modal-actions">
            <button
              type="button"
              className="cs-button secondary"
              disabled={busy}
              onClick={close}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="cs-button primary"
              disabled={busy || !selected}
              onClick={async () => {
                if (!selected) return;
                setBusy(true);
                setError("");
                try {
                  await onApply(selected);
                  onOpenChange(false);
                  setChosen(null);
                } catch {
                  setError(t("Could not change the design. Please try again."));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy && (
                <span className="cs-design-switch-spinner" aria-hidden="true" />
              )}
              <span aria-live="polite">
                {t(busy ? "Applying design…" : "Apply design")}
              </span>
            </button>
          </div>
        </Modal>
      )}
      {preview && (
        <BrochurePresetPreview
          preset={preview}
          settings={settings}
          onClose={() => setPreview(null)}
          onUse={() => {
            setChosen(preview);
            setPreview(null);
          }}
        />
      )}
    </>
  );
}
