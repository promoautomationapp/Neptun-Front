import { t } from "./i18n";
import type { Campaign, CampaignMutator } from "../../domain/models";
import type { PageArtworkLayer } from "./PageArtwork";
import React from "react";
import { readImage } from "./utils";
import { pageBackgroundContrastColor } from "./pageBackground";
import "../../styles/page-layers.css";

export interface PageLayersControlsProps {
  campaign: Campaign;
  pageKey: string;
  onUpdate: (mutate: CampaignMutator) => void;
  onToast?: (message: string) => void;
}
export function PageLayersControls({
  campaign,
  pageKey,
  onUpdate,
  onToast,
}: PageLayersControlsProps) {
  const layers: PageArtworkLayer[] = campaign.pageArtworks?.[pageKey] || [];
  const [selectedId, setSelectedId] = React.useState("");
  const selected =
    layers.find((item: { id: string }) => item.id === selectedId) ||
    layers.at(-1);
  const kind =
    pageKey === "cover" ? "cover" : pageKey === "stores" ? "stores" : "product";
  const backgroundColor =
    pageBackgroundContrastColor(
      campaign,
      kind,
      campaign.pages?.[pageKey.replace("product-", "")],
    ) || "#1c4075";
  function add(items: PageArtworkLayer[]) {
    onUpdate((draft: Campaign) => {
      draft.pageArtworks ||= {};
      draft.pageArtworks[pageKey] ||= [];
      draft.pageArtworks[pageKey].push(...items);
    });
    setSelectedId(items.at(-1)?.id || "");
  }
  function change(changes: Partial<PageArtworkLayer>) {
    if (!selected) return;
    onUpdate((draft: Campaign) => {
      const item = draft.pageArtworks?.[pageKey]?.find(
        (item) => item.id === selected.id,
      );
      if (item) Object.assign(item, changes);
    });
  }
  const base = (type: string): PageArtworkLayer => ({
    id: crypto.randomUUID(),
    type,
    name: type === "overlay" ? "Color / shadow layer" : "Text",
    x: 5,
    y: 18,
    width: type === "overlay" ? 90 : 50,
    ...(type === "overlay"
      ? {
          height: 35,
          color: backgroundColor,
          opacity: 0.65,
          fade: "bottom",
          zIndex: 2,
        }
      : { text: "Your message", color: "#ffffff", fontSize: 4, zIndex: 6 }),
  });
  async function upload(
    files: FileList | null,
    replacing = false,
    logo = false,
  ) {
    try {
      const items = await Promise.all(
        [...(files || [])]
          .filter(
            (file) =>
              file.type.startsWith("image/") && file.size <= 12 * 1024 * 1024,
          )
          .map(async (file, index) => ({
            id: crypto.randomUUID(),
            type: "image",
            name: file.name,
            image: await readImage(file),
            x: logo ? 68 : 5 + index * 3,
            y: logo ? 16 : 15 + index * 3,
            width: logo ? 25 : 45,
            opacity: 1,
            zIndex: logo ? 6 : 2,
          })),
      );
      if (replacing && items[0])
        change({ image: items[0].image, name: items[0].name });
      else if (items.length) add(items);
      else onToast?.("Choose images under 12 MB.");
    } catch {
      onToast?.("Could not read these images.");
    }
  }
  const coordinates: Array<"x" | "y" | "width" | "height"> =
    selected?.type === "overlay" || selected?.height != null
      ? ["x", "y", "width", "height"]
      : ["x", "y", "width"];
  return (
    <div className="cs-page-layers-controls">
      <p>
        Add photos, logos, text or a color layer. Drag each layer on the page;
        use its corner to resize.
      </p>
      <div className="cs-page-layer-actions">
        <label>
          Add images
          <input
            type="file"
            accept="image/*"
            multiple
            aria-label="Add multiple page images"
            onChange={(event) => {
              upload(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {pageKey === "cover" && (
          <label>
            {t("Add campaign logos")}
            <input
              type="file"
              accept="image/*"
              multiple
              aria-label="Add campaign logos"
              onChange={(event) => {
                void upload(event.target.files, false, true);
                event.target.value = "";
              }}
            />
          </label>
        )}
        <button type="button" onClick={() => add([base("text")])}>
          Add text
        </button>
        <button type="button" onClick={() => add([base("overlay")])}>
          Add color / shadow
        </button>
      </div>
      {selected && (
        <>
          <label>
            Layer
            <select
              aria-label="Selected page layer"
              value={selected.id}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {layers.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name || "Image"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Layer order
            <select
              aria-label="Page layer order"
              value={selected.zIndex ?? 2}
              onChange={(event) =>
                change({ zIndex: Number(event.target.value) })
              }
            >
              <option value={1}>Behind other artwork</option>
              <option value={2}>Over background · under logo & products</option>
              <option value={4}>Over products · under logo</option>
              <option value={6}>Over logo & products</option>
              <option value={10}>In front of everything</option>
            </select>
          </label>
          <label>
            Opacity · {Math.round((selected.opacity ?? 1) * 100)}%
            <input
              type="range"
              min="0"
              max="1"
              step=".05"
              aria-label="Page layer opacity"
              value={selected.opacity ?? 1}
              onChange={(event) =>
                change({ opacity: Number(event.target.value) })
              }
            />
          </label>
          {selected.type === "text" && (
            <>
              <label>
                Text
                <textarea
                  rows={3}
                  aria-label="Page layer text"
                  value={selected.text || ""}
                  onChange={(event) => change({ text: event.target.value })}
                />
              </label>
              <label>
                Text size
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={selected.fontSize ?? 4}
                  onChange={(event) =>
                    change({ fontSize: Number(event.target.value) })
                  }
                />
              </label>
            </>
          )}
          {selected.type === "text" || selected.type === "overlay" ? (
            <label>
              Color
              <input
                type="color"
                aria-label="Page layer color"
                value={selected.color || "#1c4075"}
                onChange={(event) => change({ color: event.target.value })}
              />
            </label>
          ) : (
            <>
              <label>
                Replace image
                <input
                  type="file"
                  accept="image/*"
                  aria-label="Replace page layer image"
                  onChange={(event) => {
                    upload(event.target.files, true);
                    event.target.value = "";
                  }}
                />
              </label>
              {selected.height != null && (
                <label>
                  Image fit
                  <select
                    aria-label="Page image fit"
                    value={selected.imageFit || "cover"}
                    onChange={(event) =>
                      change({
                        imageFit: event.target.value as "cover" | "contain",
                      })
                    }
                  >
                    <option value="cover">Fill the frame</option>
                    <option value="contain">Fit entire image</option>
                  </select>
                </label>
              )}
              <label>
                Photo shadow
                <input
                  type="checkbox"
                  checked={Boolean(selected.shadow)}
                  onChange={(event) =>
                    change({
                      shadow: event.target.checked,
                      shadowColor: selected.shadowColor || backgroundColor,
                    })
                  }
                />
              </label>
              {selected.shadow && (
                <label>
                  Shadow color
                  <input
                    type="color"
                    aria-label="Page image shadow color"
                    value={selected.shadowColor || "#1c4075"}
                    onChange={(event) =>
                      change({ shadowColor: event.target.value })
                    }
                  />
                </label>
              )}
            </>
          )}
          {selected.type === "overlay" && (
            <label>
              Fade
              <select
                aria-label="Page shadow fade"
                value={selected.fade || "solid"}
                onChange={(event) => change({ fade: event.target.value })}
              >
                <option value="solid">Solid tint</option>
                <option value="top">Fade from top</option>
                <option value="bottom">Fade from bottom</option>
                <option value="edges">Soft edges / vignette</option>
              </select>
            </label>
          )}
          <div className="cs-page-layer-coordinates">
            {coordinates.map((field) => (
              <label key={field}>
                {field}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step=".5"
                  aria-label={`Page layer ${field}`}
                  value={selected[field] ?? 0}
                  onChange={(event) =>
                    change({
                      [field]: Math.max(
                        0,
                        Math.min(100, Number(event.target.value)),
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Rotation
            <input
              type="range"
              min="-45"
              max="45"
              aria-label="Page layer rotation"
              value={selected.rotation || 0}
              onChange={(event) =>
                change({ rotation: Number(event.target.value) })
              }
            />
          </label>
          <button
            type="button"
            onClick={() =>
              onUpdate((draft: Campaign) => {
                const pageLayers = draft.pageArtworks?.[pageKey];
                if (draft.pageArtworks && pageLayers)
                  draft.pageArtworks[pageKey] = pageLayers.filter(
                    (item) => item.id !== selected.id,
                  );
              })
            }
          >
            Remove selected layer
          </button>
        </>
      )}
    </div>
  );
}
