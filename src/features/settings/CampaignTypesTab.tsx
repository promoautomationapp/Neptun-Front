import { t } from "../brochure/i18n";
import { SearchableSelect } from "../../components/SearchableSelect";
import { SettingsGroup } from "./components";
import { Field, Toggle, OrderButtons, AssetPicker } from "./components";
import { moveItem, repairDefaultType } from "./campaign-defaults";
import type { SettingsTabProps } from "./SettingsEditor";
export function CampaignTypesTab({ draft, update }: SettingsTabProps) {
  return (
    <section className="ns-section">
      <h2>{t("Campaign types")}</h2>
      <p>
        {t(
          "Manage Black Friday, Happy Hour and other campaign types shown when creating a brochure. Hiding or deleting a type keeps existing brochures.",
        )}
      </p>
      <Field label="Default campaign type">
        <SearchableSelect
          value={draft.defaultCampaignTypeId}
          onChange={(event) =>
            update((next) => {
              next.defaultCampaignTypeId = event.target.value;
            })
          }
        >
          <option value="">{t("No default — custom campaign")}</option>
          {draft.campaignTypes
            .filter((item) => item.visible)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </SearchableSelect>
      </Field>
      {draft.campaignTypes.map((item, index) => (
        <SettingsGroup
          key={item.id}
          title={
            <>
              {index + 1}. {item.name}
            </>
          }
        >
          <div className="ns-row-actions">
            <Toggle
              label={`${t("Show")} ${item.name} ${t("when creating brochures")}`}
              checked={item.visible}
              onChange={(value) =>
                update((next) => {
                  const target = next.campaignTypes[index];
                  if (target) target.visible = value;
                  repairDefaultType(next);
                })
              }
            />
            <OrderButtons
              label={item.name}
              index={index}
              count={draft.campaignTypes.length}
              onMove={(from, to) =>
                update((next) => {
                  next.campaignTypes = moveItem(next.campaignTypes, from, to);
                })
              }
            />
            <button
              type="button"
              aria-label={`${t("Delete campaign type")} ${item.name}`}
              onClick={() =>
                update((next) => {
                  next.campaignTypes.splice(index, 1);
                  repairDefaultType(next);
                })
              }
            >
              {t("Delete type")}
            </button>
            {item.visible && (
              <button
                type="button"
                disabled={draft.defaultCampaignTypeId === item.id}
                onClick={() =>
                  update((next) => {
                    next.defaultCampaignTypeId = item.id;
                  })
                }
              >
                {t(
                  draft.defaultCampaignTypeId === item.id
                    ? "Default"
                    : "Use as default",
                )}
              </button>
            )}
          </div>
          <AssetPicker
            label={`${item.name} ${t("default campaign logo")}`}
            value={item.logo || ""}
            library={draft.logoLibrary}
            onUpload={(asset) =>
              update((next) => {
                next.logoLibrary.push(asset);
              })
            }
            onChange={(source) =>
              update((next) => {
                next.campaignTypes[index]!.logo = source;
              })
            }
            emptyLabel="No default campaign logo"
          />
          <div className="ns-grid">
            <Field label={`${item.name} ${t("type name")}`}>
              <input
                value={item.name}
                onChange={(event) =>
                  update((next) => {
                    const target = next.campaignTypes[index];
                    if (target) target.name = event.target.value;
                  })
                }
              />
            </Field>
            <Field label={`${item.name} ${t("default cover message")}`}>
              <input
                value={item.tagline}
                onChange={(event) =>
                  update((next) => {
                    const target = next.campaignTypes[index];
                    if (target) target.tagline = event.target.value;
                  })
                }
              />
            </Field>
          </div>
        </SettingsGroup>
      ))}
      <button
        type="button"
        onClick={() =>
          update((next) => {
            let name = "New campaign type";
            let count = 2;
            while (
              next.campaignTypes.some(
                (item) =>
                  item.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
              )
            )
              name = `New campaign type ${count++}`;
            next.campaignTypes.push({
              id: crypto.randomUUID(),
              name,
              tagline: "",
              visible: true,
            });
            repairDefaultType(next);
          })
        }
      >
        {t("+ Add campaign type")}
      </button>
    </section>
  );
}
