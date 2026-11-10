import { ColorField } from "../brochure/ColorField";
import { t } from "../brochure/i18n";
import { SearchableSelect } from "../../components/SearchableSelect";
import { SettingsGroup, SettingsPreviewContext } from "./components";
import { useContext } from "react";
import { resolveAsset } from "../../api/client";
import { Field, Toggle } from "./components";
import { COVER_OPTIONS } from "./options";
import { BACKGROUND_PRESETS } from "../brochure/pageBackground";
import { coverRibbonColors } from "../brochure/coverElements";
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
      <h2>{t("Brochure format and layout")}</h2>
      <p>
        {t(
          "New brochures start with these choices. Their size and layout can still be changed in the brochure.",
        )}
      </p>
      <Field label="Default brochure format">
        <SearchableSelect
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
              {t(item.label)}
            </option>
          ))}
        </SearchableSelect>
      </Field>
      <SettingsGroup title={<> {t("Custom dimensions")} </>}>
        <p>
          {t(
            "Name your own sizes in pixels. Changing a size affects future brochures; existing brochures retain their saved dimensions.",
          )}
        </p>
        <small>{t("Each side: 64–8192 px. Maximum: 40 megapixels.")}</small>
        {draft.customFormats.map((item, index) => (
          <SettingsGroup
            key={item.id}
            title={<> {item.name || `Custom size ${index + 1}`} </>}
          >
            <div className="ns-grid">
              <Field label={`${t("Custom size")} ${index + 1} ${t("name")}`}>
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
              <Field
                label={`${t("Custom size")} ${index + 1} ${t("width (px)")}`}
              >
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
              <Field
                label={`${t("Custom size")} ${index + 1} ${t("height (px)")}`}
              >
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
                label={`${t("Show")} ${item.name} ${t("when choosing brochure size")}`}
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
                    ? t("Default size")
                    : `${t("Use")} ${item.name} ${t("as default")}`}
                </button>
              )}
              <button
                type="button"
                aria-label={`${t("Delete custom size")} ${item.name}`}
                onClick={() =>
                  update((next) => {
                    next.customFormats.splice(index, 1);
                    if (next.brochure.format === item.id)
                      next.brochure.format = DEFAULT_BROCHURE_FORMAT;
                  })
                }
              >
                {t("Delete size")}
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
          {t("+ Add custom dimensions")}
        </button>
      </SettingsGroup>
      <Field label="Default products per page">
        <SearchableSelect
          value={b.layout}
          onChange={(event) =>
            update((next) => {
              next.brochure.layout = event.target
                .value as BrochureDefaults["layout"];
            })
          }
        >
          <option value="feature3">
            {t("Three offers · one above two (default)")}
          </option>
          <option value="tv8">{t("Eight TVs · 3–2–3")}</option>
          <option value="balanced8">{t("Eight offers · 3–2–3")}</option>
          <option value="grid6portrait">{t("Six offers · 2 × 3")}</option>
          <option value="grid6">{t("Six offers · 3 × 2")}</option>
          <option value="classic8">
            {t("Eight offers · 3 × 3 with one open slot")}
          </option>
          <option value="grid9">{t("Nine offers · 3 × 3")}</option>
          <option value="duo4">{t("Four offers · two columns")}</option>
          <option value="pair2">{t("Two offers · one above the other")}</option>
        </SearchableSelect>
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
export function DesignTab({
  draft,
  update: updateDraft,
  pageArea = "cover",
}: SettingsTabProps) {
  const b = draft.brochure;
  const preview = useContext(SettingsPreviewContext);
  const update: SettingsTabProps["update"] = (change) => {
    updateDraft(change);
    preview(
      pageArea === "cover"
        ? "cover"
        : pageArea === "stores" || pageArea === "footer"
          ? "stores"
          : "products",
    );
  };
  const selectedTemplate =
    b.coverTemplate === "redBlue" ? "redBlue" : "blueClean";
  const selectTemplate = (template: "blueClean" | "redBlue") =>
    update((next) => {
      next.brochure.coverTemplate = template;
      next.brochure.coverBackground = {
        color: template === "blueClean" ? "#1c4075" : "",
        gradient: null,
        image: "",
      };
    });
  return (
    <section className="ns-section">
      <h2>{t(pageArea === "cover" ? "Cover and colors" : "Page colors")}</h2>
      <div hidden={pageArea !== "cover"}>
        <Field label="Default cover style">
          <SearchableSelect
            value={selectedTemplate}
            onChange={(event) =>
              selectTemplate(event.target.value as "blueClean" | "redBlue")
            }
          >
            {COVER_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {t(item.label)}
              </option>
            ))}
          </SearchableSelect>
        </Field>
        <div className="ns-cover-options">
          {COVER_OPTIONS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === selectedTemplate ? "selected" : ""}
              aria-pressed={item.id === selectedTemplate}
              onClick={() => selectTemplate(item.id)}
            >
              <img src={resolveAsset(item.image)} alt="" />
              {t(item.label)}
            </button>
          ))}
        </div>
        <Field label="Default cover product arrangement">
          <SearchableSelect
            value={b.coverProductLayout}
            onChange={(event) =>
              update((next) => {
                next.brochure.coverProductLayout = event.target
                  .value as BrochureDefaults["coverProductLayout"];
              })
            }
          >
            <option value="pair">{t("Pairs")}</option>
            <option value="hero">
              {t("One large product above the others")}
            </option>
            <option value="row">{t("Row")}</option>
          </SearchableSelect>
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
        <Toggle
          label={t("Show cover footer")}
          checked={b.showCoverFooter ?? true}
          onChange={(value) =>
            update((next) => {
              next.brochure.showCoverFooter = value;
            })
          }
        />
        {b.brochureVisualStyle === "october" && (
          <SettingsGroup title={<>{t("Message ribbon colors")}</>}>
            <p>
              {t(
                "The ribbon runs from left to right, separately from the cover background.",
              )}
            </p>
            <div className="ns-grid">
              {(["from", "to"] as const).map((key) => (
                <Field
                  key={key}
                  label={t(
                    key === "from" ? "Ribbon start color" : "Ribbon end color",
                  )}
                >
                  <ColorField
                    compact
                    label={t(
                      key === "from"
                        ? "Ribbon start color"
                        : "Ribbon end color",
                    )}
                    value={coverRibbonColors(b)[key]}
                    onChange={(color) =>
                      update((next) => {
                        next.brochure.coverRibbonColors = {
                          ...coverRibbonColors(next.brochure),
                          [key]: color,
                        };
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          </SettingsGroup>
        )}
        <SettingsGroup title={<> {t("Cover text colors")} </>}>
          <div className="ns-grid">
            {(
              [
                ["coverMessageColor", "Campaign message"],
                ["coverHeadlineColor", "Headline"],
                ["coverTypeColor", "Campaign type"],
                ["coverFooterColor", "Cover footer"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={`${t(label)} ${t("color")}`}>
                <ColorField
                  compact
                  label={`${t(label)} ${t("color")}`}
                  value={b[key] || "#ffffff"}
                  onChange={(color) =>
                    update((next) => {
                      next.brochure[key] = color;
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </SettingsGroup>
      </div>
      {pageArea === "inside" && b.brochureVisualStyle === "october" && (
        <SettingsGroup title={<>{t("Category header and page footer")}</>}>
          <p>
            {t(
              "These are the starting choices for this design. Every page can override its category text, logo, line and page number.",
            )}
          </p>
          {(
            [
              ["showHeader", "Show blue category header"],
              ["showOnlineLogo", "Show online shopping logo"],
              ["showFooterLogo", "Show NEPTUN footer logo"],
              ["showFooterLine", "Show footer line"],
            ] as const
          ).map(([key, label]) => (
            <Toggle
              key={key}
              label={t(label)}
              checked={b.pageDecorationDefaults?.[key] ?? true}
              onChange={(value) =>
                update((next) => {
                  next.brochure.pageDecorationDefaults ??= {};
                  next.brochure.pageDecorationDefaults[key] = value;
                })
              }
            />
          ))}
          <div className="ns-grid">
            {(
              [
                ["headerColor", "Category header color", "#007dc5"],
                ["headerTextColor", "Category text color", "#ffffff"],
                ["footerLineColor", "Footer line color", "#003870"],
                ["footerLogoColor", "Footer logo color", "#003870"],
              ] as const
            ).map(([key, label, fallback]) => (
              <Field key={key} label={t(label)}>
                <ColorField
                  compact
                  label={t(label)}
                  value={b.pageDecorationDefaults?.[key] || fallback}
                  onChange={(color) =>
                    update((next) => {
                      next.brochure.pageDecorationDefaults ??= {};
                      next.brochure.pageDecorationDefaults[key] = color;
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </SettingsGroup>
      )}
      {(["coverBackground", "productBackground", "storesBackground"] as const)
        .filter(
          (key) =>
            key ===
            (pageArea === "cover"
              ? "coverBackground"
              : pageArea === "stores"
                ? "storesBackground"
                : "productBackground"),
        )
        .map((key) => {
          const background = b[key];
          const label =
            key === "coverBackground"
              ? "Cover background"
              : key === "storesBackground"
                ? "Stores page background"
                : "Product pages background";
          return (
            <SettingsGroup key={key} title={<> {t(label)} </>}>
              <Field label={`${t(label)} ${t("type")}`}>
                <SearchableSelect
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
                  <option value="automatic">
                    {t("Follow brochure theme")}
                  </option>
                  <option value="solid">{t("Solid color")}</option>
                  <option value="gradient">{t("Gradient")}</option>
                  {background.image && (
                    <option value="image" disabled>
                      {t("Selected background image")}
                    </option>
                  )}
                </SearchableSelect>
              </Field>
              <div className="ns-swatches">
                {BACKGROUND_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.color}
                    aria-label={`${t(label)}: ${t(preset.label)}`}
                    title={t(preset.label)}
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
              <Field label={`${t(label)} ${t("color")}`}>
                <ColorField
                  compact
                  label={`${t(label)} ${t("color")}`}
                  value={background.color || "#1c4075"}
                  onChange={(color) =>
                    update((next) => {
                      next.brochure[key].color = color;
                      next.brochure[key].gradient = null;
                      next.brochure[key].image = "";
                    })
                  }
                />
              </Field>
              {background.gradient && (
                <div className="ns-grid">
                  <Field label={`${t(label)} ${t("gradient start")}`}>
                    <ColorField
                      compact
                      label={`${t(label)} ${t("gradient start")}`}
                      value={background.gradient.from}
                      onChange={(color) =>
                        update((next) => {
                          if (next.brochure[key].gradient)
                            next.brochure[key].gradient.from = color;
                        })
                      }
                    />
                  </Field>
                  <Field label={`${t(label)} ${t("gradient end")}`}>
                    <ColorField
                      compact
                      label={`${t(label)} ${t("gradient end")}`}
                      value={background.gradient.to}
                      onChange={(color) =>
                        update((next) => {
                          if (next.brochure[key].gradient)
                            next.brochure[key].gradient.to = color;
                        })
                      }
                    />
                  </Field>
                  <Field label={`${t(label)} ${t("gradient angle")}`}>
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
              <p>{t("Choose a default photo in the Background images tab.")}</p>
            </SettingsGroup>
          );
        })}
    </section>
  );
}
