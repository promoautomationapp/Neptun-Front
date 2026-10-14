import { Field, Toggle, OrderButtons } from "./components";
import { moveItem, repairDefaultType } from "./campaign-defaults";
import type { SettingsTabProps } from "./SettingsEditor";
export function CampaignTypesTab({ draft, update }: SettingsTabProps) {
  return (
    <section className="ns-section">
      <h2>Campaign types</h2>
      <p>
        Manage Black Friday, Happy Hour and other campaign types shown when
        creating a brochure. Hiding or deleting a type keeps existing brochures.
      </p>
      <Field label="Default campaign type">
        <select
          value={draft.defaultCampaignTypeId}
          onChange={(event) =>
            update((next) => {
              next.defaultCampaignTypeId = event.target.value;
            })
          }
        >
          <option value="">No default — custom campaign</option>
          {draft.campaignTypes
            .filter((item) => item.visible)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </Field>
      {draft.campaignTypes.map((item, index) => (
        <fieldset key={item.id}>
          <legend>
            {index + 1}. {item.name}
          </legend>
          <div className="ns-row-actions">
            <Toggle
              label={`Show ${item.name} when creating brochures`}
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
              aria-label={`Delete campaign type ${item.name}`}
              onClick={() =>
                update((next) => {
                  next.campaignTypes.splice(index, 1);
                  repairDefaultType(next);
                })
              }
            >
              Delete type
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
                {draft.defaultCampaignTypeId === item.id
                  ? "Default"
                  : "Use as default"}
              </button>
            )}
          </div>
          <div className="ns-grid">
            <Field label={`${item.name} type name`}>
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
            <Field label={`${item.name} default cover message`}>
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
        </fieldset>
      ))}
      <button
        type="button"
        onClick={() =>
          update((next) => {
            let name = "New campaign type";
            let count = 2;
            while (next.campaignTypes.some((item) => item.name === name))
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
        + Add campaign type
      </button>
    </section>
  );
}
