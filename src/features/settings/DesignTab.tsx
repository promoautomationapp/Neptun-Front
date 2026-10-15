import { SettingsGroup } from "./components";
import { resolveAsset } from "../../api/client";
import { Field, Toggle, AssetPicker } from "./components";
import { COVER_OPTIONS } from "./options";
import { BACKGROUND_PRESETS } from "../brochure/pageBackground";
import {
  availableBrochureFormats,
  DEFAULT_BROCHURE_FORMAT,
} from "../brochure/brochureFormat";
import type { SettingsTabProps } from "./SettingsEditor";
import type { BrochureDefaults } from "./settings.schema";
export function FormatsTab({ draft, update }: SettingsTabProps) {
  const b = draft.brochure;
  return (
    <section className="ns-section">
      <h2>Brochure format and layout</h2>
      <p>
        New brochures start with these choices. Their size and layout can still
        be changed in the brochure.
      </p>
      <Field label="Default brochure format">
        <select
          value={b.format}
          onChange={(event) =>
            update((next) => {
              next.brochure.format = event.target
                .value as BrochureDefaults["format"];
            })
          }
        >
          {availableBrochureFormats(draft.customFormats).map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <SettingsGroup title={<> Custom dimensions </>}>
        <p>
          Name your own sizes in pixels. Changing a size affects future
          brochures; existing brochures retain their saved dimensions.
        </p>
        <small>Each side: 64–8192 px. Maximum: 40 megapixels.</small>
        {draft.customFormats.map((item, index) => (
          <SettingsGroup
            key={item.id}
            title={<> {item.name || `Custom size ${index + 1}`} </>}
          >
            <div className="ns-grid">
              <Field label={`Custom size ${index + 1} name`}>
                <input
                  maxLength={120}
                  value={item.name}
                  onChange={(event) =>
                    update((next) => {
                      const target = next.customFormats[index];
                      if (target) target.name = event.target.value;
                    })
                  }
                />
              </Field>
              <Field label={`Custom size ${index + 1} width (px)`}>
                <input
                  type="number"
                  min={64}
                  max={8192}
                  step={1}
                  value={item.width}
                  onChange={(event) =>
                    update((next) => {
                      const target = next.customFormats[index];
                      if (target) target.width = Number(event.target.value);
                    })
                  }
                />
              </Field>
              <Field label={`Custom size ${index + 1} height (px)`}>
                <input
                  type="number"
                  min={64}
                  max={8192}
                  step={1}
                  value={item.height}
                  onChange={(event) =>
                    update((next) => {
                      const target = next.customFormats[index];
                      if (target) target.height = Number(event.target.value);
                    })
                  }
                />
              </Field>
            </div>
            <div className="ns-row-actions">
              <Toggle
                label={`Show ${item.name} when choosing brochure size`}
                checked={item.visible}
                onChange={(visible) =>
                  update((next) => {
                    const target = next.customFormats[index];
                    if (target) target.visible = visible;
                    if (!visible && next.brochure.format === item.id)
                      next.brochure.format = DEFAULT_BROCHURE_FORMAT;
                  })
                }
              />
              {item.visible && (
                <button
                  type="button"
                  disabled={b.format === item.id}
                  onClick={() =>
                    update((next) => {
                      next.brochure.format = item.id;
                    })
                  }
                >
                  {b.format === item.id
                    ? "Default size"
                    : `Use ${item.name} as default`}
                </button>
              )}
              <button
                type="button"
                aria-label={`Delete custom size ${item.name}`}
                onClick={() =>
                  update((next) => {
                    next.customFormats.splice(index, 1);
                    if (next.brochure.format === item.id)
                      next.brochure.format = DEFAULT_BROCHURE_FORMAT;
                  })
                }
              >
                Delete size
              </button>
            </div>
          </SettingsGroup>
        ))}
        <button
          type="button"
          disabled={draft.customFormats.length >= 100}
          onClick={() =>
            update((next) => {
              let name = "Custom size";
              let number = 2;
              while (
                next.customFormats.some(
                  (item) =>
                    item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
                )
              )
                name = `Custom size ${number++}`;
              next.customFormats.push({
                id: `custom-${crypto.randomUUID()}`,
                name,
                width: 1080,
                height: 1350,
                visible: true,
              });
            })
          }
        >
          + Add custom dimensions
        </button>
      </SettingsGroup>
      <Field label="Default products per page">
        <select
          value={b.layout}
          onChange={(event) =>
            update((next) => {
              next.brochure.layout = event.target
                .value as BrochureDefaults["layout"];
            })
          }
        >
          <option value="grid6portrait">Six offers · 2 × 3 (default)</option>
          <option value="grid6">Six offers · 3 × 2</option>
          <option value="classic8">
            Eight offers · 3 × 3 with one open slot
          </option>
          <option value="grid9">Nine offers · 3 × 3</option>
          <option value="duo4">Four offers · two columns</option>
        </select>
      </Field>
      <Toggle
        label="Show interior footer"
        checked={b.showInteriorFooter}
        onChange={(value) =>
          update((next) => {
            next.brochure.showInteriorFooter = value;
          })
        }
      />
      <Toggle
        label="Show page numbers"
        checked={b.showFooterPageNumber}
        onChange={(value) =>
          update((next) => {
            next.brochure.showFooterPageNumber = value;
          })
        }
      />
    </section>
  );
}
export function DesignTab({ draft, update }: SettingsTabProps) {
  const b = draft.brochure;
  return (
    <section className="ns-section">
      <h2>Cover and colors</h2>
      <Field label="Default cover style">
        <select
          value={b.coverTemplate}
          onChange={(event) =>
            update((next) => {
              next.brochure.coverTemplate = event.target
                .value as BrochureDefaults["coverTemplate"];
            })
          }
        >
          {COVER_OPTIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="ns-cover-options">
        {COVER_OPTIONS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={item.id === b.coverTemplate ? "selected" : ""}
            aria-pressed={item.id === b.coverTemplate}
            onClick={() =>
              update((next) => {
                next.brochure.coverTemplate = item.id;
              })
            }
          >
            <img src={resolveAsset(item.image)} alt="" />
            {item.label}
          </button>
        ))}
      </div>
      <Field label="Default cover product arrangement">
        <select
          value={b.coverProductLayout}
          onChange={(event) =>
            update((next) => {
              next.brochure.coverProductLayout = event.target
                .value as BrochureDefaults["coverProductLayout"];
            })
          }
        >
          <option value="pair">Pairs</option>
          <option value="hero">One large product above the others</option>
          <option value="row">Row</option>
        </select>
      </Field>
      <div className="ns-grid">
        {(
          [
            "showCoverLogo",
            "showCoverBand",
            "showCoverHeadline",
            "showCoverMessage",
            "showCoverGradient",
          ] as const
        ).map((key, index) => (
          <Toggle
            key={key}
            label={
              [
                "Show cover logo",
                "Show UUU / hajde! band",
                "Show cover headline",
                "Show campaign message",
                "Show cover overlay gradient",
              ][index] ?? key
            }
            checked={b[key]}
            onChange={(value) =>
              update((next) => {
                next.brochure[key] = value;
              })
            }
          />
        ))}
      </div>
      <SettingsGroup title={<> Cover text colors </>}>
        <div className="ns-grid">
          {(
            [
              ["coverMessageColor", "Campaign message"],
              ["coverHeadlineColor", "Headline"],
              ["coverTypeColor", "Campaign type"],
              ["coverFooterColor", "Cover footer"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={`${label} color`}>
              <input
                type="color"
                value={b[key] || "#ffffff"}
                onChange={(event) =>
                  update((next) => {
                    next.brochure[key] = event.target.value;
                  })
                }
              />
            </Field>
          ))}
        </div>
      </SettingsGroup>
      {(
        ["coverBackground", "productBackground", "storesBackground"] as const
      ).map((key, index) => {
        const background = b[key];
        const label =
          [
            "Cover background",
            "Product pages background",
            "Stores page background",
          ][index] ?? key;
        return (
          <SettingsGroup key={key} title={<> {label} </>}>
            <Field label={`${label} type`}>
              <select
                value={
                  background.image
                    ? "image"
                    : background.gradient
                      ? "gradient"
                      : background.color
                        ? "solid"
                        : "automatic"
                }
                onChange={(event) =>
                  update((next) => {
                    const target = next.brochure[key];
                    const mode = event.target.value;
                    if (mode !== "image") target.image = "";
                    target.gradient =
                      mode === "gradient"
                        ? {
                            from: target.color || "#1c4075",
                            to: "#1680a8",
                            angle: 180,
                          }
                        : null;
                    if (mode === "automatic") target.color = "";
                    else if (!target.color) target.color = "#1c4075";
                  })
                }
              >
                <option value="automatic">Follow brochure theme</option>
                <option value="solid">Solid color</option>
                <option value="gradient">Gradient</option>
                {background.image && (
                  <option value="image" disabled>
                    Selected background image
                  </option>
                )}
              </select>
            </Field>
            <div className="ns-swatches">
              {BACKGROUND_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.color}
                  aria-label={`${label}: ${preset.label}`}
                  title={preset.label}
                  style={{ background: preset.color }}
                  onClick={() =>
                    update((next) => {
                      next.brochure[key] = {
                        ...next.brochure[key],
                        color: preset.color,
                        gradient: null,
                        image: "",
                      };
                    })
                  }
                />
              ))}
            </div>
            <Field label={`${label} color`}>
              <input
                type="color"
                value={background.color || "#1c4075"}
                onChange={(event) =>
                  update((next) => {
                    next.brochure[key].color = event.target.value;
                    next.brochure[key].gradient = null;
                    next.brochure[key].image = "";
                  })
                }
              />
            </Field>
            {background.gradient && (
              <div className="ns-grid">
                <Field label={`${label} gradient start`}>
                  <input
                    type="color"
                    value={background.gradient.from}
                    onChange={(event) =>
                      update((next) => {
                        if (next.brochure[key].gradient)
                          next.brochure[key].gradient.from = event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label={`${label} gradient end`}>
                  <input
                    type="color"
                    value={background.gradient.to}
                    onChange={(event) =>
                      update((next) => {
                        if (next.brochure[key].gradient)
                          next.brochure[key].gradient.to = event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label={`${label} gradient angle`}>
                  <input
                    type="number"
                    min={0}
                    max={360}
                    value={background.gradient.angle}
                    onChange={(event) =>
                      update((next) => {
                        if (next.brochure[key].gradient)
                          next.brochure[key].gradient.angle = Number(
                            event.target.value,
                          );
                      })
                    }
                  />
                </Field>
              </div>
            )}
            <p>Choose a default photo in the Background images tab.</p>
          </SettingsGroup>
        );
      })}
    </section>
  );
}
