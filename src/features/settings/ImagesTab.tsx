import { SettingsGroup } from "./components";
import { AssetPicker } from "./components";
import type { SettingsTabProps } from "./SettingsEditor";
export function ImagesTab({
  draft,
  update,
  pageArea = "artwork",
}: SettingsTabProps) {
  return (
    <section className="ns-section">
      <h2>Default background images</h2>
      <p>
        Upload a cover image separately from colors and logos. You can replace
        or remove it for each brochure. Use the preview’s page buttons to check
        each background.
      </p>
      {(
        [
          ["coverBackground", "Cover image"],
          ["productBackground", "Product-page background image"],
          ["storesBackground", "Stores-page background image"],
        ] as const
      )
        .filter(
          ([key]) =>
            pageArea === "artwork" ||
            key ===
              (pageArea === "cover"
                ? "coverBackground"
                : pageArea === "stores"
                  ? "storesBackground"
                  : "productBackground"),
        )
        .map(([key, label]) => (
          <SettingsGroup key={key} title={<> {label} </>}>
            <AssetPicker
              label={label}
              emptyLabel="Use the selected color or gradient"
              value={draft.brochure[key].image}
              library={draft.logoLibrary}
              onUpload={(asset) =>
                update((next) => {
                  next.logoLibrary.push(asset);
                })
              }
              onChange={(source) =>
                update((next) => {
                  next.brochure[key].image = source;
                })
              }
            />
          </SettingsGroup>
        ))}
    </section>
  );
}
