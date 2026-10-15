import { SearchableSelect } from "../../components/SearchableSelect";
import { SettingsGroup } from "./components";
import { Field, Toggle } from "./components";
import type { SettingsTabProps } from "./SettingsEditor";
import type { ProductDesignDefaults } from "./settings.schema";

export function ProductDesignTab({ draft, update }: SettingsTabProps) {
  const d = draft.productDesign;
  function change<T extends keyof ProductDesignDefaults>(
    key: T,
    value: ProductDesignDefaults[T],
  ) {
    update((next) => {
      next.productDesign[key] = value;
    });
  }
  function number(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (value: number) => void,
    hint?: string,
  ) {
    return (
      <Field label={label} hint={hint}>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            if (event.target.value !== "") onChange(Number(event.target.value));
          }}
        />
      </Field>
    );
  }
  return (
    <section className="ns-section">
      <h2>Product design defaults</h2>
      <p>
        New brochures copy these choices. Existing brochures and individual
        product edits keep their own design. Automatic choices use the current
        Neptun reference.
      </p>
      <SettingsGroup title={<> Product grouping and spacing </>}>
        <Toggle
          label="Automatically group products by type"
          checked={draft.brochure.automaticProductLayout}
          onChange={(value) =>
            update((next) => {
              next.brochure.automaticProductLayout = value;
            })
          }
        />
        <p>
          Turn this off to use the selected default grid for every product type,
          including MacBooks.
        </p>
        <Field label="Default page spacing">
          <SearchableSelect
            value={d.grid.mode}
            onChange={(event) =>
              change("grid", {
                ...d.grid,
                mode: event.target.value as "automatic" | "custom",
              })
            }
          >
            <option value="automatic">Current Neptun spacing</option>
            <option value="custom">Custom spacing</option>
          </SearchableSelect>
        </Field>
        {d.grid.mode === "custom" && (
          <div className="ns-grid">
            {number(
              "Horizontal grid gap (%)",
              d.grid.horizontal,
              0,
              12,
              0.1,
              (value) => change("grid", { ...d.grid, horizontal: value }),
            )}
            {number(
              "Vertical grid gap (%)",
              d.grid.vertical,
              0,
              12,
              0.1,
              (value) => change("grid", { ...d.grid, vertical: value }),
            )}
            {number(
              "Photo and text gap (%)",
              d.grid.content,
              0,
              8,
              0.1,
              (value) => change("grid", { ...d.grid, content: value }),
            )}
          </div>
        )}
      </SettingsGroup>
      <SettingsGroup title={<> Product photos </>}>
        <Field label="Default photo position and size">
          <SearchableSelect
            value={d.photo.mode}
            onChange={(event) =>
              change("photo", {
                ...d.photo,
                mode: event.target.value as "automatic" | "custom",
              })
            }
          >
            <option value="automatic">Automatic fit for each product</option>
            <option value="custom">Custom position and size</option>
          </SearchableSelect>
        </Field>
        {d.photo.mode === "custom" && (
          <div className="ns-grid">
            {number("Default photo left (%)", d.photo.x, 0, 100, 1, (value) =>
              change("photo", { ...d.photo, x: value }),
            )}
            {number("Default photo top (%)", d.photo.y, 0, 100, 1, (value) =>
              change("photo", { ...d.photo, y: value }),
            )}
            {number(
              "Default photo size (%)",
              Math.round(d.photo.scale * 100),
              20,
              250,
              5,
              (value) => change("photo", { ...d.photo, scale: value / 100 }),
            )}
          </div>
        )}
        <Toggle
          label="Use TV inches for automatic photo sizing"
          checked={d.photo.automaticTvSizing}
          onChange={(value) =>
            change("photo", { ...d.photo, automaticTvSizing: value })
          }
        />
        <p>
          TV sizing applies in automatic mode. Prepared image files are reused
          without alteration.
        </p>
      </SettingsGroup>
      <SettingsGroup title={<> Product details </>}>
        <Field label="Default details position">
          <SearchableSelect
            value={d.details.placement}
            onChange={(event) =>
              change("details", {
                ...d.details,
                placement: event.target
                  .value as ProductDesignDefaults["details"]["placement"],
              })
            }
          >
            <option value="automatic">
              Automatic for the product and price design
            </option>
            <option value="left">Left of photo</option>
            <option value="bottom">Below photo</option>
          </SearchableSelect>
        </Field>
        <Field label="Default detail box fill">
          <SearchableSelect
            value={d.details.fill}
            onChange={(event) =>
              change("details", {
                ...d.details,
                fill: event.target
                  .value as ProductDesignDefaults["details"]["fill"],
              })
            }
          >
            <option value="automatic">Current Neptun reference</option>
            <option value="filled">Filled</option>
            <option value="outline">Outline</option>
          </SearchableSelect>
        </Field>
      </SettingsGroup>
      <SettingsGroup title={<> Product typography </>}>
        <Field
          label="Default product text font"
          hint="Applies to product names, codes and detail text. Price artwork retains its original typeface."
        >
          <SearchableSelect
            value={d.typography.font}
            onChange={(event) =>
              change("typography", {
                ...d.typography,
                font: event.target
                  .value as ProductDesignDefaults["typography"]["font"],
              })
            }
          >
            <option value="automatic">Current Neptun reference fonts</option>
            <option value="SkolaSans">SkolaSans</option>
            <option value="TSTAR">TSTAR</option>
            <option value="Arial">Arial</option>
          </SearchableSelect>
        </Field>
        <div className="ns-grid">
          {(
            [
              ["nameScale", "Product name size (%)"],
              ["codeScale", "Product code size (%)"],
              ["detailScale", "Detail text size (%)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              {number(
                label,
                Math.round(d.typography[key] * 100),
                70,
                150,
                5,
                (value) =>
                  change("typography", { ...d.typography, [key]: value / 100 }),
              )}
            </div>
          ))}
        </div>
      </SettingsGroup>
      <SettingsGroup title={<> Price and savings artwork </>}>
        <div className="ns-grid">
          {number(
            "Default price size (%)",
            Math.round(d.priceScale * 100),
            60,
            150,
            5,
            (value) => change("priceScale", value / 100),
          )}
          {number(
            "Default savings size (%)",
            Math.round(d.savingsScale * 100),
            60,
            150,
            5,
            (value) => change("savingsScale", value / 100),
          )}
        </div>
        <p>
          Manually moved or resized price and savings elements keep their saved
          dimensions.
        </p>
      </SettingsGroup>
      <SettingsGroup title={<> Line beside the product name </>}>
        <Toggle
          label="Show product name divider"
          checked={d.divider.visible}
          onChange={(value) =>
            change("divider", { ...d.divider, visible: value })
          }
        />
        <Toggle
          label="Use automatic divider thickness"
          checked={d.divider.thickness === null}
          onChange={(value) =>
            change("divider", { ...d.divider, thickness: value ? null : 1 })
          }
        />
        {d.divider.thickness !== null &&
          number(
            "Divider thickness (px at 1080px)",
            d.divider.thickness,
            0.5,
            8,
            0.5,
            (value) => change("divider", { ...d.divider, thickness: value }),
          )}
        {number(
          "Space after product name (px at 1080px)",
          d.divider.gap,
          0,
          30,
          1,
          (value) => change("divider", { ...d.divider, gap: value }),
        )}
        {(
          [
            ["color", "Divider color on dark pages", "#ffffff"],
            ["lightColor", "Divider color on light pages", "#7a96ac"],
          ] as const
        ).map(([key, label, fallback]) => (
          <div key={key}>
            <Toggle
              label={`Use automatic ${label.toLocaleLowerCase()}`}
              checked={!d.divider[key]}
              onChange={(value) =>
                change("divider", {
                  ...d.divider,
                  [key]: value ? "" : fallback,
                })
              }
            />
            {d.divider[key] && (
              <Field label={label}>
                <input
                  type="color"
                  value={d.divider[key]}
                  onChange={(event) =>
                    change("divider", {
                      ...d.divider,
                      [key]: event.target.value,
                    })
                  }
                />
              </Field>
            )}
          </div>
        ))}
      </SettingsGroup>
    </section>
  );
}
