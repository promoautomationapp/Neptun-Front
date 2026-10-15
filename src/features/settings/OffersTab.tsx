import { SearchableSelect } from "../../components/SearchableSelect";
import { SettingsGroup } from "./components";
import { AssetPicker, Field } from "./components";
import { OFFER_STYLES } from "../brochure/offerStyles";
import type { SettingsTabProps } from "./SettingsEditor";
import type { BrochureDefaults, WorkspaceSettings } from "./settings.schema";
export type { CategoryFacet } from "./categoryHierarchy";
import type { CategoryFacet } from "./categoryHierarchy";
export function SavingSelect({
  label,
  value,
  onChange,
  inherit = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inherit?: boolean;
}) {
  return (
    <Field label={label}>
      <SearchableSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {inherit && <option value="">Use the default above</option>}
        <option value="amount">Kurse (€) — Save €</option>
        <option value="percentage">Zbritje (%) — Discount %</option>
      </SearchableSelect>
    </Field>
  );
}
export function OffersTab({
  draft,
  update,
  facets: _facets,
  facetsError: _facetsError,
}: { facets: CategoryFacet[]; facetsError?: string } & SettingsTabProps) {
  return (
    <section className="ns-section">
      <h2>Prices and savings</h2>
      <p>
        Products can override these defaults inside a brochure. Subcategory
        choices take priority over category choices.
      </p>
      <Field label="Default price design">
        <SearchableSelect
          value={draft.offerStyle}
          onChange={(event) =>
            update((next) => {
              next.offerStyle = event.target
                .value as WorkspaceSettings["offerStyle"];
            })
          }
        >
          {OFFER_STYLES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {item.detail}
            </option>
          ))}
        </SearchableSelect>
      </Field>
      <SavingSelect
        label="Default savings display"
        value={draft.savingMode}
        onChange={(value) =>
          update((next) => {
            next.savingMode = value as WorkspaceSettings["savingMode"];
          })
        }
      />
      <Field label="Default haPPy price logo">
        <SearchableSelect
          value={draft.brochure.priceLogo}
          onChange={(event) =>
            update((next) => {
              next.brochure.priceLogo = event.target
                .value as BrochureDefaults["priceLogo"];
            })
          }
        >
          <option value="symbol">haPPy with symbol (current)</option>
          <option value="wordmark">haPPy wordmark</option>
          <option value="custom">Uploaded price logo</option>
        </SearchableSelect>
      </Field>
      <AssetPicker
        label="Price logo"
        value={
          draft.brochure.priceLogo === "custom"
            ? draft.brochure.customPriceLogo
            : ""
        }
        defaultImage={`/api/assets/legacy/assets/happy-price-${draft.brochure.priceLogo === "wordmark" ? "wordmark" : "symbol"}.png`}
        library={draft.logoLibrary}
        onUpload={(asset) =>
          update((next) => {
            next.logoLibrary.push(asset);
          })
        }
        onChange={(source) =>
          update((next) => {
            next.brochure.customPriceLogo = source;
            next.brochure.priceLogo = source ? "custom" : "symbol";
          })
        }
      />
      <Field label="Default installments">
        <input
          type="number"
          min={1}
          max={60}
          value={draft.brochure.installments}
          onChange={(event) =>
            update((next) => {
              next.brochure.installments = Number(event.target.value);
            })
          }
        />
      </Field>
      <Field
        label="Default payment message"
        hint="Leave empty to use the current message with the selected number of installments."
      >
        <input
          value={draft.brochure.paymentText}
          onChange={(event) =>
            update((next) => {
              next.brochure.paymentText = event.target.value;
            })
          }
        />
      </Field>
      <SettingsGroup title={<> Price artwork colors </>}>
        <div className="ns-grid">
          {(
            [
              ["red", "Red price band"],
              ["blue", "Blue price card"],
              ["blueBand", "Blue card top band"],
              ["saving", "Red savings text"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                type="color"
                value={draft.brochure.pricePalette[key]}
                onChange={(event) =>
                  update((next) => {
                    next.brochure.pricePalette[key] = event.target.value;
                  })
                }
              />
            </Field>
          ))}
        </div>
      </SettingsGroup>
    </section>
  );
}
