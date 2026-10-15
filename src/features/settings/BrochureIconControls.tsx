import { SearchableSelect } from "../../components/SearchableSelect";
import type { Campaign, CampaignMutator } from "../../domain/models";
import { ICON_ROLES } from "./options";
import { resolveAsset } from "../../api/client";
export function BrochureIconControls({
  campaign,
  onUpdate,
}: {
  campaign: Campaign;
  onUpdate: (change: CampaignMutator) => void;
}) {
  const library = campaign.storesSnapshot?.logoLibrary ?? [];
  return (
    <details className="cs-store-elements-options">
      <summary>Icons for this brochure</summary>
      <p className="cs-control-help">
        These choices apply only to this brochure. Individual product artwork
        edits take priority.
      </p>
      {ICON_ROLES.map((role) => (
        <div key={role.id}>
          <label>
            <input
              type="checkbox"
              checked={campaign.iconDefaults?.[role.id]?.visible !== false}
              onChange={(event) =>
                onUpdate((draft) => {
                  draft.iconDefaults ??= {};
                  draft.iconDefaults[role.id] = {
                    image: draft.iconDefaults[role.id]?.image || "",
                    visible: event.target.checked,
                  };
                })
              }
            />
            {role.label}
          </label>
          <SearchableSelect
            aria-label={`${role.label} artwork for this brochure`}
            value={campaign.iconDefaults?.[role.id]?.image || ""}
            onChange={(event) =>
              onUpdate((draft) => {
                draft.iconDefaults ??= {};
                draft.iconDefaults[role.id] = {
                  image: event.target.value,
                  visible: draft.iconDefaults[role.id]?.visible !== false,
                };
              })
            }
          >
            <option value="">Current built-in icon</option>
            {campaign.iconDefaults?.[role.id]?.image &&
              !library.some(
                (item) => item.url === campaign.iconDefaults?.[role.id]?.image,
              ) && (
                <option value={campaign.iconDefaults[role.id]?.image}>
                  Selected artwork
                </option>
              )}
            {library.map((item) => (
              <option key={item.id} value={item.url}>
                {item.name}
              </option>
            ))}
          </SearchableSelect>
          {campaign.iconDefaults?.[role.id]?.image && (
            <img
              style={{ maxWidth: 60, maxHeight: 40, objectFit: "contain" }}
              src={resolveAsset(campaign.iconDefaults[role.id]?.image || "")}
              alt=""
            />
          )}
        </div>
      ))}
    </details>
  );
}
