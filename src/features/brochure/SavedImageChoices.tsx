import type { Settings } from "../../domain/models";
import type { LogoAsset } from "../settings/settings.schema";
import { reusableImages } from "../settings/ReusableImages";
import { resolveAsset } from "../../api/client";
import { t } from "./i18n";

/** Existing workspace artwork is selected directly; it is never uploaded or prepared again. */
export function SavedImageChoices({
  settings,
  selected,
  onSelect,
}: {
  settings?: Settings;
  selected: string;
  onSelect: (asset: LogoAsset) => void;
}) {
  return (
    <div className="cs-editor-saved-image-grid">
      {reusableImages(settings).map((asset) => (
        <button
          type="button"
          key={asset.url}
          aria-label={`${t("Use saved image")}: ${asset.name}`}
          aria-pressed={selected === asset.url}
          onClick={() => onSelect(asset)}
        >
          <img src={resolveAsset(asset.url)} alt="" draggable={false} />
          <span>{asset.name}</span>
        </button>
      ))}
    </div>
  );
}
