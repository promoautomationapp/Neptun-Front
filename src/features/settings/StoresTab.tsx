import { SearchableSelect } from "../../components/SearchableSelect";
import { SettingsGroup } from "./components";
import { Field, Toggle, OrderButtons } from "./components";
import { CONTACT_LABELS, STORE_ELEMENTS, FOOTER_ELEMENTS } from "./options";
import { moveItem } from "./campaign-defaults";
import type { SettingsTabProps } from "./SettingsEditor";
import type { BrochureDefaults } from "./settings.schema";
export function StoresTab({ draft, update }: SettingsTabProps) {
  const b = draft.brochure;
  return (
    <section className="ns-section">
      <h2>Stores and contact information</h2>
      <p>
        Store visibility and order apply to new brochures. Each brochure keeps
        its own store list.
      </p>
      <Field label="Default store information placement">
        <SearchableSelect
          value={b.storesDisplay}
          onChange={(event) =>
            update((next) => {
              next.brochure.storesDisplay = event.target
                .value as BrochureDefaults["storesDisplay"];
            })
          }
        >
          <option value="page">Separate stores page</option>
          <option value="footer">Bottom of the last product page</option>
          <option value="none">No store information</option>
        </SearchableSelect>
      </Field>
      <Toggle
        label="Show online store"
        checked={b.showOnlineStore}
        onChange={(value) =>
          update((next) => {
            next.brochure.showOnlineStore = value;
          })
        }
      />
      <SettingsGroup title={<> Information shown for every store </>}>
        <div className="ns-grid">
          {(["city", "name", "address", "phone", "icon"] as const).map(
            (field) => (
              <Toggle
                key={field}
                label={`Show store ${field}`}
                checked={b.storeFields[field]}
                onChange={(value) =>
                  update((next) => {
                    next.brochure.storeFields[field] = value;
                  })
                }
              />
            ),
          )}
        </div>
      </SettingsGroup>
      <details>
        <summary>Sections shown on the stores page and compact footer</summary>
        {(
          [
            {
              key: "storesHiddenElements",
              label: "Separate stores page",
              items: STORE_ELEMENTS,
            },
            {
              key: "storeFooterHiddenElements",
              label: "Compact footer",
              items: FOOTER_ELEMENTS,
            },
          ] as const
        ).map((group) => (
          <SettingsGroup key={group.key} title={<> {group.label} </>}>
            {group.items.map((item) => (
              <Toggle
                key={item.id}
                label={`${group.label}: ${item.label}`}
                checked={!b[group.key].includes(item.id)}
                onChange={(value) =>
                  update((next) => {
                    next.brochure[group.key] = value
                      ? next.brochure[group.key].filter((id) => id !== item.id)
                      : [...new Set([...next.brochure[group.key], item.id])];
                  })
                }
              />
            ))}
          </SettingsGroup>
        ))}
      </details>
      <h3>Store list</h3>
      {draft.stores.map((store, index) => {
        const label = store.name || store.city || `Store ${index + 1}`;
        return (
          <SettingsGroup
            key={store.id || index}
            title={
              <>
                {index + 1}. {label}
              </>
            }
          >
            <div className="ns-row-actions">
              <Toggle
                label={`Show ${label} in new brochures`}
                checked={store.visible}
                onChange={(value) =>
                  update((next) => {
                    const target = next.stores[index];
                    if (target) target.visible = value;
                  })
                }
              />
              <OrderButtons
                label={label}
                index={index}
                count={draft.stores.length}
                onMove={(from, to) =>
                  update((next) => {
                    next.stores = moveItem(next.stores, from, to);
                  })
                }
              />
              <button
                type="button"
                aria-label={`Delete store ${label}`}
                onClick={() =>
                  update((next) => {
                    next.stores.splice(index, 1);
                  })
                }
              >
                Delete store
              </button>
            </div>
            <div className="ns-grid">
              {(["city", "name", "address", "phone"] as const).map((field) => (
                <Field key={field} label={`${label} · ${field}`}>
                  <input
                    value={store[field]}
                    onChange={(event) =>
                      update((next) => {
                        const target = next.stores[index];
                        if (target) target[field] = event.target.value;
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          </SettingsGroup>
        );
      })}
      <button
        type="button"
        onClick={() =>
          update((next) => {
            next.stores.push({
              id: crypto.randomUUID(),
              city: "",
              name: "New store",
              address: "",
              phone: "",
              visible: true,
            });
          })
        }
      >
        + Add store
      </button>
      <h3>Contact information and terms</h3>
      <div className="ns-grid">
        {[
          ...new Set([
            ...Object.keys(draft.contact),
            "membershipDisclaimer",
            "discountDisclaimer",
          ]),
        ].map((field) => (
          <div key={field}>
            <Field label={CONTACT_LABELS[field] || field}>
              {/Disclaimer$|^disclaimer$/.test(field) ? (
                <textarea
                  rows={4}
                  value={draft.contact[field] || ""}
                  onChange={(event) =>
                    update((next) => {
                      next.contact[field] = event.target.value;
                    })
                  }
                />
              ) : (
                <input
                  value={draft.contact[field] || ""}
                  onChange={(event) =>
                    update((next) => {
                      next.contact[field] = event.target.value;
                    })
                  }
                />
              )}
            </Field>
            <Toggle
              label={`Show ${CONTACT_LABELS[field] || field}`}
              checked={b.contactVisibility[field] !== false}
              onChange={(value) =>
                update((next) => {
                  next.brochure.contactVisibility[field] = value;
                })
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}
