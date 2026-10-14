import { resolveAsset } from "../../api/client";
import { AssetPicker, Field, Toggle } from "./components";
import { LOGO_ROLES, ICON_ROLES } from "./options";
import type { SettingsTabProps } from "./SettingsEditor";
import type { BrochureDefaults, LogoAsset } from "./settings.schema";
import { ManufacturerLogos } from "./ManufacturerLogos";
export function LogosTab({
  draft,
  update,
  brands = [],
}: SettingsTabProps & { brands?: string[] }) {
  const b = draft.brochure;
  const upload = (asset: LogoAsset) =>
    update((next) => {
      next.logoLibrary.push(asset);
    });
  return (
    <section className="ns-section">
      <h2>Logos and icons</h2>
      <p>
        Keep the current artwork or choose an uploaded image as the default.
        Product icons appear only when the product has that feature.
      </p>
      <fieldset>
        <legend>Cover logo</legend>
        <Toggle
          label="Show the cover logo by default"
          checked={b.showCoverLogo}
          onChange={(value) =>
            update((next) => {
              next.brochure.showCoverLogo = value;
            })
          }
        />
        <Field label="Default cover logo style">
          <select
            value={b.coverLogoStyle}
            onChange={(event) =>
              update((next) => {
                next.brochure.coverLogoStyle = event.target
                  .value as BrochureDefaults["coverLogoStyle"];
                if (event.target.value !== "custom")
                  next.brochure.coverLogoSource = `/api/assets/legacy/assets/${event.target.value === "framed" ? "neptun-logo-framed.png" : "neptun-cover-logo.png"}`;
              })
            }
          >
            <option value="original">Current NEPTUN cover logo</option>
            <option value="framed">Framed NEPTUN logo</option>
            <option value="custom">Uploaded logo</option>
          </select>
        </Field>
        <AssetPicker
          label="Cover logo"
          value={b.coverLogoSource}
          library={draft.logoLibrary}
          onUpload={upload}
          onChange={(source) =>
            update((next) => {
              next.brochure.coverLogoSource =
                source || "/api/assets/legacy/assets/neptun-cover-logo.png";
              next.brochure.coverLogoStyle = source ? "custom" : "original";
            })
          }
        />
        <Field label="Default NEPTUN logo style inside pages">
          <select
            value={b.neptunLogoOption}
            onChange={(event) =>
              update((next) => {
                next.brochure.neptunLogoOption = event.target
                  .value as BrochureDefaults["neptunLogoOption"];
              })
            }
          >
            <option value="classic">Current logo</option>
            <option value="framed">Framed logo</option>
          </select>
        </Field>
      </fieldset>
      <div className="ns-grid">
        {LOGO_ROLES.map((role) => (
          <fieldset key={role.id}>
            <legend>{role.label}</legend>
            <AssetPicker
              label={role.label}
              value={draft.brandAssets[role.id] || ""}
              defaultImage={role.image}
              library={draft.logoLibrary}
              onUpload={upload}
              onChange={(source) =>
                update((next) => {
                  if (source) next.brandAssets[role.id] = source;
                  else delete next.brandAssets[role.id];
                })
              }
            />
          </fieldset>
        ))}
      </div>
      <ManufacturerLogos draft={draft} update={update} brands={brands} />
      <h3>Product and contact icons</h3>
      <div className="ns-grid">
        {ICON_ROLES.map((role) => (
          <fieldset key={role.id}>
            <legend>{role.label}</legend>
            <Toggle
              label={`Show ${role.label} icon by default`}
              checked={draft.iconDefaults[role.id]?.visible !== false}
              onChange={(value) =>
                update((next) => {
                  next.iconDefaults[role.id] = {
                    ...next.iconDefaults[role.id],
                    image: next.iconDefaults[role.id]?.image || "",
                    visible: value,
                  };
                })
              }
            />
            <AssetPicker
              label={`${role.label} icon`}
              value={draft.iconDefaults[role.id]?.image || ""}
              defaultImage={role.image}
              library={draft.logoLibrary}
              onUpload={upload}
              onChange={(source) =>
                update((next) => {
                  next.iconDefaults[role.id] = {
                    image: source,
                    visible: next.iconDefaults[role.id]?.visible !== false,
                  };
                })
              }
            />
          </fieldset>
        ))}
      </div>
      <details>
        <summary>Uploaded artwork library ({draft.logoLibrary.length})</summary>
        <p>
          Removing an item from this list keeps images already used in brochures
          and selected defaults.
        </p>
        {draft.logoLibrary.map((asset) => (
          <div className="ns-library-row" key={asset.id}>
            <img src={resolveAsset(asset.url)} alt="" />
            <Field label={`Name for ${asset.name}`}>
              <input
                value={asset.name}
                onChange={(event) =>
                  update((next) => {
                    const item = next.logoLibrary.find(
                      (row) => row.id === asset.id,
                    );
                    if (item) item.name = event.target.value;
                  })
                }
              />
            </Field>
            <button
              type="button"
              onClick={() =>
                update((next) => {
                  next.logoLibrary = next.logoLibrary.filter(
                    (item) => item.id !== asset.id,
                  );
                })
              }
              aria-label={`Remove ${asset.name} from library`}
            >
              Remove
            </button>
          </div>
        ))}
      </details>
    </section>
  );
}
