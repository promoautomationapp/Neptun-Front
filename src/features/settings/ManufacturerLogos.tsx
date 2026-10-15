import { SettingsGroup } from "./components";
import { useMemo, useState } from "react";
import { brandLogoFor, BUILTIN_BRAND_LOGOS } from "../brochure/brandLogos";
import { AssetPicker, Field, Toggle } from "./components";
import type { SettingsTabProps } from "./SettingsEditor";

const PAGE_SIZE = 12;
const normalizeBrand = (value: string) => value.trim().toUpperCase();

export function ManufacturerLogos({
  draft,
  update,
  brands,
}: SettingsTabProps & { brands: string[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const available = useMemo(
    () =>
      [
        ...new Set(
          [
            ...brands,
            ...Object.keys(BUILTIN_BRAND_LOGOS),
            ...Object.keys(draft.brandLogos),
          ].map(normalizeBrand),
        ),
      ]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [brands, draft.brandLogos],
  );
  const filtered = available.filter((brand) =>
    brand.includes(normalizeBrand(search)),
  );

  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Product brand logos ({available.length})</summary>
      {open && (
        <div>
          <p>
            Choose the manufacturer logos used on product cards in new
            brochures. Each brochure can keep its own logo choices. Hiding a
            logo shows the brand name instead.
          </p>
          <Field label="Search product brands">
            <input
              type="search"
              value={search}
              placeholder="For example, Samsung or LG"
              onChange={(event) => {
                setSearch(event.target.value);
                setShown(PAGE_SIZE);
              }}
            />
          </Field>
          <p role="status">
            {filtered.length
              ? `Showing ${Math.min(shown, filtered.length)} of ${filtered.length} brands`
              : "No matching product brands."}
          </p>
          <div className="ns-grid">
            {filtered.slice(0, shown).map((brand) => {
              const hasOverride = Object.hasOwn(draft.brandLogos, brand);
              const override = draft.brandLogos[brand] || "";
              const hidden = hasOverride && !override;
              return (
                <SettingsGroup key={brand} title={<> {brand} </>}>
                  <Toggle
                    label={`Hide ${brand} logo`}
                    checked={hidden}
                    onChange={(hide) =>
                      update((next) => {
                        if (hide) next.brandLogos[brand] = "";
                        else delete next.brandLogos[brand];
                      })
                    }
                  />
                  {hidden ? (
                    <p>
                      The logo is hidden. Product cards show {brand} as text.
                    </p>
                  ) : (
                    <AssetPicker
                      label={`${brand} logo`}
                      value={override}
                      defaultImage={brandLogoFor(undefined, brand)}
                      library={draft.logoLibrary}
                      onUpload={(asset) =>
                        update((next) => {
                          next.logoLibrary.push(asset);
                        })
                      }
                      onChange={(source) =>
                        update((next) => {
                          if (source) next.brandLogos[brand] = source;
                          else delete next.brandLogos[brand];
                        })
                      }
                    />
                  )}
                  {hasOverride && (
                    <button
                      type="button"
                      onClick={() =>
                        update((next) => {
                          delete next.brandLogos[brand];
                        })
                      }
                    >
                      Restore current {brand} logo
                    </button>
                  )}
                </SettingsGroup>
              );
            })}
          </div>
          {shown < filtered.length && (
            <button
              type="button"
              onClick={() => setShown((value) => value + PAGE_SIZE)}
            >
              Show more brands
            </button>
          )}
        </div>
      )}
    </details>
  );
}
