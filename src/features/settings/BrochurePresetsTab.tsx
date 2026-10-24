import { t } from "../brochure/i18n";
import { useState } from "react";
import type { SettingsTabProps } from "./SettingsEditor";
import {
  BrochurePresetPicker,
  BrochurePresetPreview,
} from "../brochure/BrochurePresetPicker";
import {
  applyPresetToSettings,
  availableBrochurePresets,
  brochurePresetFromSettings,
  builtInBrochurePresets,
  captureEditedBrochurePreset,
} from "../brochure/brochurePresets";
import type { BrochurePreset } from "../brochure/brochurePresets";
import type { WorkspaceSettings } from "./settings.schema";
import { resolveSettings } from "./settings.schema";

export function BrochurePresetsTab({
  draft,
  update,
  selectedId,
  onSelect,
}: SettingsTabProps & { selectedId: string; onSelect: (id: string) => void }) {
  const presets = availableBrochurePresets(draft);
  const selected =
    presets.find((preset) => preset.id === selectedId) ?? presets[0]!;
  const [preview, setPreview] = useState<BrochurePreset | null>(null);
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  function remember(next: WorkspaceSettings, preset: BrochurePreset) {
    const captured = captureEditedBrochurePreset(
      next,
      preset,
    ) as WorkspaceSettings["brochurePresets"][number];
    const index = next.brochurePresets.findIndex(
      (item) => item.id === preset.id,
    );
    if (index < 0) next.brochurePresets.push(captured);
    else next.brochurePresets[index] = captured;
  }
  function choose(preset: BrochurePreset) {
    if (preset.id === selected.id) return;
    update((next) => {
      remember(next, selected);
      applyPresetToSettings(next, preset);
    });
    onSelect(preset.id);
    setConfirmDelete(false);
    setMessage(
      "Design loaded. Edit its colors, images, prices and layout in the other settings sections, then save settings to update this design.",
    );
  }
  function newDesign(fromCurrent: boolean) {
    const id = `custom-${crypto.randomUUID()}`;
    const name = fromCurrent
      ? `${selected.name} ${t("copy")}`
      : t("Untitled design");
    const definition = fromCurrent
      ? { ...captureEditedBrochurePreset(draft, selected), id, name }
      : brochurePresetFromSettings(
          resolveSettings({
            brochure: {
              productBackground: { color: "#ffffff", gradient: null },
              coverBackground: { color: "#ffffff", gradient: null },
              storesBackground: { color: "#ffffff", gradient: null },
              coverTemplate: "blueClean",
              layout: "duo4",
              showCoverBand: false,
            },
          }),
          id,
          name,
        );
    update((next) => {
      remember(next, selected);
      next.brochurePresets.push(
        definition as WorkspaceSettings["brochurePresets"][number],
      );
      applyPresetToSettings(next, definition);
    });
    onSelect(id);
    setMessage(
      fromCurrent
        ? "A separate copy is ready to edit. Save settings when you finish."
        : "A blank design is ready. Set its background, logos, pricing and layout, then save settings.",
    );
  }
  return (
    <section className="ns-section cs-preset-management">
      <h2>{t("Brochure presets")}</h2>
      <p>
        {t(
          "Keep ready brochure designs for the team. New brochures receive an independent copy; saved brochures keep their own edits.",
        )}
      </p>
      <BrochurePresetPicker
        presets={presets}
        value={selected.id}
        onChange={choose}
        onPreview={setPreview}
      />
      <div className="cs-preset-edit">
        <label>
          {t("Design name")}
          <input
            type="text"
            aria-label={t("Brochure preset name")}
            maxLength={120}
            key={`${selected.id}-${selected.name}`}
            defaultValue={selected.name}
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (!name) {
                event.target.value = selected.name;
                return;
              }
              update((next) => {
                const entry = next.brochurePresets.find(
                  (preset) => preset.id === selected.id,
                );
                if (entry) entry.name = name;
                else
                  next.brochurePresets.push({
                    ...selected,
                    name,
                  } as WorkspaceSettings["brochurePresets"][number]);
              });
            }}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.defaultBrochurePresetId === selected.id}
            onChange={() =>
              update((next) => {
                next.defaultBrochurePresetId = selected.id;
              })
            }
          />
          {t("Automatically select this design for new brochures")}
        </label>
        <p>
          {t(
            "The design open here is updated when you use Save settings. Cover photographs are supplied separately for each brochure.",
          )}
        </p>
        <div className="cs-preset-management-actions">
          <button
            type="button"
            className="cs-preset-primary"
            onClick={() => {
              update((next) => {
                const captured = captureEditedBrochurePreset(
                  next,
                  selected,
                ) as WorkspaceSettings["brochurePresets"][number];
                const index = next.brochurePresets.findIndex(
                  (item) => item.id === selected.id,
                );
                if (index < 0) next.brochurePresets.push(captured);
                else next.brochurePresets[index] = captured;
              });
              setMessage(
                "Current settings added to this design. Save settings to share it with the team.",
              );
            }}
          >
            {t("Update design from current settings")}
          </button>
          <button type="button" onClick={() => newDesign(true)}>
            {t("Duplicate design")}
          </button>
          {selected.builtin ? (
            <button
              type="button"
              onClick={() => {
                const original = builtInBrochurePresets.find(
                  (item) => item.id === selected.id,
                )!;
                update((next) => {
                  next.brochurePresets = next.brochurePresets.filter(
                    (item) => item.id !== selected.id,
                  );
                  applyPresetToSettings(next, original);
                });
                setMessage(
                  "Original design restored. Save settings to keep it.",
                );
              }}
            >
              {t("Reset original design")}
            </button>
          ) : (
            <button
              type="button"
              className="cs-preset-danger"
              onClick={() => setConfirmDelete(true)}
            >
              {t("Delete design")}
            </button>
          )}
        </div>
        {confirmDelete && (
          <div className="cs-preset-delete-confirm" role="alert">
            <span>
              {t("Delete")} {selected.name}?{" "}
              {t("Existing brochures keep their design.")}
            </span>
            <button
              type="button"
              onClick={() => {
                const fallback = presets.find(
                  (item) => item.id === "neptun-current",
                )!;
                update((next) => {
                  next.brochurePresets = next.brochurePresets.filter(
                    (item) => item.id !== selected.id,
                  );
                  if (next.defaultBrochurePresetId === selected.id)
                    next.defaultBrochurePresetId = "neptun-current";
                  applyPresetToSettings(next, fallback);
                });
                onSelect("neptun-current");
                setConfirmDelete(false);
                setMessage(
                  "Design removed from the library. Save settings to keep this change.",
                );
              }}
            >
              {t("Delete this design")}
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              {t("Cancel")}
            </button>
          </div>
        )}
      </div>
      <div className="cs-preset-management-actions">
        <button type="button" onClick={() => newDesign(true)}>
          {t("Save current settings as a new design")}
        </button>
        <button type="button" onClick={() => newDesign(false)}>
          {t("New design from scratch")}
        </button>
      </div>
      {message && <p role="status">{t(message)}</p>}
      {preview && (
        <BrochurePresetPreview
          preset={
            preview.id === selected.id
              ? captureEditedBrochurePreset(draft, selected)
              : preview
          }
          settings={draft}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
