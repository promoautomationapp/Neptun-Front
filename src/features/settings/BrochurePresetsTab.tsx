import { t } from "../brochure/i18n";
import { useState } from "react";
import { PresetDesignModal } from "./PresetDesignModal";
import type { CategoryFacet } from "./categoryHierarchy";
import type { Product } from "../../domain/models";
import type { SettingsTabProps } from "./SettingsEditor";
import {
  BrochurePresetPicker,
  BrochurePresetPreview,
} from "../brochure/BrochurePresetPicker";
import {
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
  facets = [],
  facetsError,
  brands = [],
  previewProducts = [],
}: SettingsTabProps & {
  selectedId: string;
  onSelect: (id: string) => void;
  facets?: CategoryFacet[];
  facetsError?: string;
  brands?: string[];
  previewProducts?: Product[];
}) {
  const presets = availableBrochurePresets(draft);
  const selected =
    presets.find((preset) => preset.id === selectedId) ?? presets[0]!;
  const [preview, setPreview] = useState<BrochurePreset | null>(null);
  const [editing, setEditing] = useState<BrochurePreset | null>(null);
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  function choose(preset: BrochurePreset) {
    onSelect(preset.id);
    setConfirmDelete(false);
    setMessage("Design selected. Choose Edit design to change its settings.");
  }
  function newDesign(fromCurrent: boolean, fromWorkspace = false) {
    const id = `custom-${crypto.randomUUID()}`;
    const name = fromCurrent
      ? `${t(selected.name)} ${t("copy")}`
      : t("Untitled design");
    const definition = fromCurrent
      ? fromWorkspace
        ? brochurePresetFromSettings(draft, id, name)
        : { ...selected, design: structuredClone(selected.design), id, name }
      : brochurePresetFromSettings(
          resolveSettings({
            ...structuredClone(draft),
            brochure: {
              ...structuredClone(draft.brochure),
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
      next.brochurePresets.push(
        definition as WorkspaceSettings["brochurePresets"][number],
      );
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
        <button
          type="button"
          className="cs-preset-primary"
          onClick={() => setEditing(selected)}
        >
          {t("Edit design")}
        </button>
        <label>
          {t("Design name")}
          <input
            type="text"
            aria-label={t("Brochure preset name")}
            maxLength={120}
            key={`${selected.id}-${selected.builtin ? t(selected.name) : selected.name}`}
            defaultValue={selected.builtin ? t(selected.name) : selected.name}
            onBlur={(event) => {
              const name = event.target.value.trim();
              const displayed = selected.builtin
                ? t(selected.name)
                : selected.name;
              if (name === displayed) return;
              if (!name) {
                event.target.value = displayed;
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
            "Open Edit design to change colors, product layouts, prices, logos and stores. Save settings shares the library with the team.",
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
                  // Store the original snapshot explicitly; legacy workspace
                  // defaults must not be reapplied over a reset design.
                  next.brochurePresets = next.brochurePresets.filter(
                    (item) => item.id !== selected.id,
                  );
                  next.brochurePresets.push({
                    id: original.id,
                    name: original.name,
                    design: structuredClone(original.design),
                  } as WorkspaceSettings["brochurePresets"][number]);
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
                update((next) => {
                  next.brochurePresets = next.brochurePresets.filter(
                    (item) => item.id !== selected.id,
                  );
                  if (next.defaultBrochurePresetId === selected.id)
                    next.defaultBrochurePresetId = "neptun-current";
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
        <button type="button" onClick={() => newDesign(true, true)}>
          {t("Save current settings as a new design")}
        </button>
        <button type="button" onClick={() => newDesign(false)}>
          {t("New design from scratch")}
        </button>
      </div>
      {message && <p role="status">{t(message)}</p>}
      {editing && (
        <PresetDesignModal
          key={editing.id}
          preset={editing}
          settings={draft}
          facets={facets}
          facetsError={facetsError}
          brands={brands}
          previewProducts={previewProducts}
          onClose={() => setEditing(null)}
          onCommit={(captured, working) => {
            update((next) => {
              const entry = {
                id: captured.id,
                name: captured.name,
                design: structuredClone(captured.design),
              } as WorkspaceSettings["brochurePresets"][number];
              const index = next.brochurePresets.findIndex(
                (item) => item.id === entry.id,
              );
              if (index < 0) next.brochurePresets.push(entry);
              else next.brochurePresets[index] = entry;
              for (const asset of working.logoLibrary)
                if (!next.logoLibrary.some((item) => item.id === asset.id))
                  next.logoLibrary.push(structuredClone(asset));
            });
            setEditing(null);
            setMessage(
              "Design updated. Save settings to share it with the team.",
            );
          }}
        />
      )}
      {preview && (
        <BrochurePresetPreview
          preset={presets.find((item) => item.id === preview.id) || preview}
          settings={draft}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
