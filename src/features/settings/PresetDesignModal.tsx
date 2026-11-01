import { useState } from "react";
import { Modal } from "../../components/Modal";
import { Field } from "./components";
import { SettingsEditor } from "./SettingsEditor";
import type { WorkspaceSettings } from "./settings.schema";
import type { CategoryFacet } from "./categoryHierarchy";
import type { Product } from "../../domain/models";
import {
  applyPresetToSettings,
  captureEditedBrochurePreset,
  type BrochurePreset,
} from "../brochure/brochurePresets";
import { t } from "../brochure/i18n";
import "./preset-design-modal.css";

/** A private settings draft; closing never writes into the parent library. */
export function PresetDesignModal({
  preset,
  settings,
  facets,
  facetsError,
  brands,
  previewProducts,
  onCommit,
  onClose,
}: {
  preset: BrochurePreset;
  settings: WorkspaceSettings;
  facets?: CategoryFacet[];
  facetsError?: string;
  brands?: string[];
  previewProducts?: Product[];
  onCommit: (preset: BrochurePreset, working: WorkspaceSettings) => void;
  onClose: () => void;
}) {
  const [initial] = useState(() => {
    const working = structuredClone(settings);
    applyPresetToSettings(working, preset);
    working.defaultBrochurePresetId = preset.id;
    const entry = {
      id: preset.id,
      name: preset.name,
      design: structuredClone(preset.design),
    } as WorkspaceSettings["brochurePresets"][number];
    working.brochurePresets = [
      ...working.brochurePresets.filter((item) => item.id !== preset.id),
      entry,
    ];
    return working;
  });
  const [busy, setBusy] = useState(false);
  const [initialName] = useState(() =>
    preset.builtin ? t(preset.name) : preset.name,
  );
  const [name, setName] = useState(initialName);
  return (
    <div className="cs-preset-editor-modal">
      <Modal
        title={t("Edit design")}
        kicker={t(preset.name)}
        wide
        onClose={() => {
          if (!busy) onClose();
        }}
      >
        <div className="cs-preset-editor-intro">
          <Field label="Design name">
            <input
              aria-label={t("Design name")}
              value={name}
              maxLength={120}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <p className="cs-preset-editor-note">
            {t(
              "Edit this design with a live preview. Other designs and existing brochures keep their settings.",
            )}
          </p>
        </div>
        <SettingsEditor
          initial={initial}
          designScope={{
            name,
            changed: name !== initialName,
            onCancel: onClose,
          }}
          facets={facets}
          facetsError={facetsError}
          brands={brands}
          previewProducts={previewProducts}
          onBusyChange={setBusy}
          onSave={async (working) => {
            if (!name.trim()) throw new Error(t("Enter a design name."));
            onCommit(
              {
                ...preset,
                ...captureEditedBrochurePreset(working, {
                  ...preset,
                  name: name.trim() === initialName ? preset.name : name.trim(),
                }),
              },
              working,
            );
            return working;
          }}
        />
      </Modal>
    </div>
  );
}
