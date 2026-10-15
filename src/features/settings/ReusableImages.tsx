import { API_URL, resolveAsset } from "../../api/client";
import { logoRuleDefaults } from "./logoLibraryData";
import type { Settings } from "../../domain/models";
import type { LogoAsset } from "./settings.schema";
export const REUSABLE_IMAGE_TYPE = "application/x-neptun-artwork";
export function reusableImages(settings?: Settings): LogoAsset[] {
  const choices = [
    ...logoRuleDefaults,
    ...(settings?.logoLibrary || []),
    ...(settings?.campaignTypes || []).flatMap((type) =>
      type.logo
        ? [{ id: `type-${type.id}`, name: `${type.name} logo`, url: type.logo }]
        : [],
    ),
  ];
  return [
    ...new Map(
      choices
        .filter(
          (item) => !(settings?.hiddenBuiltinLogos || []).includes(item.id),
        )
        .map((item) => [item.url, item]),
    ).values(),
  ];
}
export function droppedReusableImage(transfer: DataTransfer): LogoAsset | null {
  try {
    const asset = JSON.parse(transfer.getData(REUSABLE_IMAGE_TYPE));
    const source = typeof asset.url === "string" && API_URL && asset.url.startsWith(`${API_URL}/api/assets/`) ? asset.url.slice(API_URL.length) : asset.url;
    return typeof asset.name === "string" &&
      typeof source === "string" &&
      /^\/api\/assets\/(?:[a-f0-9-]{36}|legacy\/[^?#]+|app\/logo)$/i.test(
        source,
      )
      ? {
          id: crypto.randomUUID(),
          name: asset.name.slice(0, 200),
          url: source,
        }
      : null;
  } catch {
    return null;
  }
}
export function ReusableImages({
  settings,
  onAdd,
}: {
  settings?: Settings;
  onAdd: (asset: LogoAsset) => void;
}) {
  const images = reusableImages(settings);
  return (
    <details className="ns-reusable-images">
      <summary>Choose a saved logo or image ({images.length})</summary>
      <p>
        Click an image to add it, or drag it onto the page. Move and resize it
        after adding.
      </p>
      <div className="ns-reusable-image-grid">
        {images.map((asset) => (
          <button
            type="button"
            key={asset.id}
            aria-label={`Add saved image: ${asset.name}`}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(
                REUSABLE_IMAGE_TYPE,
                JSON.stringify(asset),
              );
              event.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => onAdd(asset)}
          >
            <img src={resolveAsset(asset.url)} alt="" />
            <span>{asset.name}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
