import { ColorField } from "./ColorField";
import { FileUpload } from "../../components/FileUpload";
import { SearchableSelect } from "../../components/SearchableSelect";
import { t } from "./i18n";
import { EditorIcon } from "./EditorIcon";
import { LayerOpacityControl } from "./LayerOpacityControl";
import { BannerImageFields } from "./PageBannerFields";
import type { Campaign, CampaignMutator } from "../../domain/models";
import type { PageArtworkLayer } from "./PageArtwork";
import React from "react";
import { readImage } from "./utils";
import { pageBackgroundContrastColor } from "./pageBackground";
import "../../styles/page-layers.css";
import {
  blackCollectionPageArtworks,
  materializeBlackCollectionPageArtworks,
} from "./blackFridayDesign";

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
  const layers: PageArtworkLayer[] = blackCollectionPageArtworks(
    campaign,
    pageKey,
  );
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
      materializeBlackCollectionPageArtworks(draft, pageKey);
      draft.pageArtworks ||= {};
      draft.pageArtworks[pageKey] ||= [];
      draft.pageArtworks[pageKey].push(...items);
    });
    setSelectedId(items.at(-1)?.id || "");
  }
  function change(changes: Partial<PageArtworkLayer>) {
    if (!selected) return;
    onUpdate((draft: Campaign) => {
      materializeBlackCollectionPageArtworks(draft, pageKey);
      const item = draft.pageArtworks?.[pageKey]?.find(
        (item) => item.id === selected.id,
      );
      if (item) Object.assign(item, changes);
    });
  }
  const layerName = (layer: PageArtworkLayer) =>
    t(
      layer.name ||
        (layer.type === "text"
          ? "Text"
          : ["overlay", "shape"].includes(layer.type || "")
            ? "Color / shadow layer"
            : "Image"),
    );
  const base = (type: string): PageArtworkLayer => ({
    id: crypto.randomUUID(),
    type,
    name: type === "overlay" ? "Color layer" : "Text",
    x: 5,
    y: 18,
    width: type === "overlay" ? 90 : 50,
    ...(type === "overlay"
      ? {
          height: 35,
          color: backgroundColor,
          opacity: 0.5,
          fade: "solid",
          zIndex: 6,
        }
      : { text: t("Your message"), color: "#ffffff", fontSize: 4, zIndex: 6 }),
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
            zIndex: 6,
          })),
      );
      if (replacing && items[0])
        change({ image: items[0].image, name: items[0].name });
      else if (items.length) add(items);
      else onToast?.(t("Choose images under 12 MB."));
    } catch {
      onToast?.(t("Could not read these images."));
    }
  }
  const coordinates: Array<"x" | "y" | "width" | "height"> =
    selected?.type === "overlay" || selected?.height != null
      ? ["x", "y", "width", "height"]
      : ["x", "y", "width"];
  return (
    <div className="cs-page-layers-controls">
      <p>
        {t("Add images, text or a color layer. Changes appear in the preview.")}
      </p>
      <div className="cs-page-layer-actions">
        <button
          type="button"
          className="cs-page-add-color"
          onClick={() => add([base("overlay")])}
        >
          <EditorIcon name="layers" />
          {t("Add color layer")}
        </button>
        <FileUpload
          accept="image/*"
          multiple
          aria-label={t("Add multiple page images")}
          onChange={(event) => {
            const pending = upload(event.target.files);
            event.target.value = "";
            return pending;
          }}
        >
          {t("Add images")}
        </FileUpload>
        {pageKey === "cover" && (
          <FileUpload
            accept="image/*"
            multiple
            aria-label={t("Add campaign logos")}
            onChange={(event) => {
              const pending = upload(event.target.files, false, true);
              event.target.value = "";
              return pending;
            }}
          >
            {t("Add campaign logos")}
          </FileUpload>
        )}
        <button type="button" onClick={() => add([base("text")])}>
          {t("Add text")}
        </button>
      </div>
      {layers.length > 0 ? (
        <div className="cs-page-layer-library">
          <strong>
            {t("Layers on this page")} <span>{layers.length}</span>
          </strong>
          <div
            className="cs-page-layer-list"
            role="group"
            aria-label={t("Select a page layer")}
          >
            {[...layers].reverse().map((layer) => (
              <button
                key={layer.id}
                type="button"
                className="cs-page-layer-choice"
                aria-pressed={selected?.id === layer.id}
                aria-label={`${t("Select layer")}: ${layerName(layer)}`}
                onClick={() => setSelectedId(layer.id)}
              >
                <span
                  className="cs-page-layer-thumbnail"
                  style={
                    ["overlay", "shape"].includes(layer.type || "")
                      ? {
                          backgroundColor:
                            layer.fill || layer.color || backgroundColor,
                        }
                      : undefined
                  }
                >
                  {layer.type === "text" ? (
                    <b aria-hidden="true">T</b>
                  ) : ["overlay", "shape"].includes(layer.type || "") ? null : (
                    <img src={layer.image} alt="" />
                  )}
                </span>
                <span>
                  <b>{layerName(layer)}</b>
                  <small>
                    {t(
                      layer.type === "text"
                        ? "Text layer"
                        : ["overlay", "shape"].includes(layer.type || "")
                          ? "Color layer"
                          : "Image layer",
                    )}
                  </small>
                </span>
                <span className="cs-page-layer-selected" aria-hidden="true">
                  {selected?.id === layer.id ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="cs-page-layer-empty">
          {t(
            "No added layers yet. Add an image above to place it over the page.",
          )}
        </p>
      )}
      {selected && (
        <>
          <label>
            {t("Layer order")}
            <SearchableSelect
              aria-label={t("Page layer order")}
              value={selected.zIndex ?? 2}
              onChange={(event) =>
                change({ zIndex: Number(event.target.value) })
              }
            >
              <option value={1}>{t("Behind other artwork")}</option>
              <option value={2}>
                {t("Over background · under logo & products")}
              </option>
              <option value={4}>{t("Over products · under logo")}</option>
              <option value={6}>{t("Over page content")}</option>
              <option value={10}>{t("In front of everything")}</option>
            </SearchableSelect>
          </label>
          <LayerOpacityControl
            key={`opacity-${selected.id}`}
            value={selected.opacity ?? 1}
            label={t("Page layer opacity")}
            onChange={(opacity) => change({ opacity })}
          />
          {selected.type === "text" && (
            <>
              <label>
                {t("Text")}
                <textarea
                  rows={3}
                  aria-label={t("Page layer text")}
                  value={selected.text || ""}
                  onChange={(event) => change({ text: event.target.value })}
                />
              </label>
              <label>
                {t("Text size")}
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
          {selected.layoutRole === "banner" && selected.type === "text" && (
            <fieldset className="cs-page-layer-color">
              <legend>{t("Banner background")}</legend>
              <ColorField
                label={t("Banner background")}
                value={selected.backgroundColor || "#00000000"}
                onChange={(backgroundColor) => change({ backgroundColor })}
              />
              <button
                type="button"
                onClick={() => change({ backgroundColor: "#00000000" })}
              >
                {t("Transparent background")}
              </button>
              <label>
                {t("Text position")}
                <SearchableSelect
                  aria-label={t("Banner text position")}
                  value={selected.textVerticalAlign || "center"}
                  onChange={(event) =>
                    change({
                      textVerticalAlign: event.target.value as
                        "top" | "center" | "bottom",
                    })
                  }
                >
                  <option value="top">{t("Top")}</option>
                  <option value="center">{t("Center")}</option>
                  <option value="bottom">{t("Bottom")}</option>
                </SearchableSelect>
              </label>
            </fieldset>
          )}
          {selected.layoutRole === "banner" && selected.type === "image" && (
            <BannerImageFields artwork={selected} onChange={change} />
          )}
          {selected.type === "text" ||
          selected.type === "overlay" ||
          selected.type === "shape" ? (
            <LayerColorControl
              key={`color-${selected.id}`}
              value={selected.fill || selected.color || "#1c4075"}
              onChange={(color) =>
                change(selected.type === "shape" ? { fill: color } : { color })
              }
            />
          ) : (
            <>
              <FileUpload
                accept="image/*"
                aria-label={t("Replace page layer image")}
                onChange={(event) => {
                  const pending = upload(event.target.files, true);
                  event.target.value = "";
                  return pending;
                }}
              >
                {t("Replace image")}
              </FileUpload>
              {selected.height != null && (
                <label>
                  {t("Image fit")}
                  <SearchableSelect
                    aria-label={t("Page image fit")}
                    value={selected.imageFit || "cover"}
                    onChange={(event) =>
                      change({
                        imageFit: event.target.value as "cover" | "contain",
                      })
                    }
                  >
                    <option value="cover">{t("Fill the frame")}</option>
                    <option value="contain">{t("Fit entire image")}</option>
                  </SearchableSelect>
                </label>
              )}
              <label>
                {t("Photo shadow")}
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
                  {t("Shadow color")}
                  <ColorField
                    compact
                    label={t("Page image shadow color")}
                    value={selected.shadowColor || "#1c4075"}
                    onChange={(color) => change({ shadowColor: color })}
                  />
                </label>
              )}
            </>
          )}
          {selected.type === "shape" && (
            <>
              <ColorField
                label={t("Outline color")}
                value={selected.stroke || "#00000000"}
                onChange={(stroke) => change({ stroke })}
              />
              <label>
                {t("Outline width")}
                <input
                  type="number"
                  min="0"
                  max="10"
                  step=".1"
                  value={selected.strokeWidth || 0}
                  onChange={(event) =>
                    change({
                      strokeWidth: Math.max(
                        0,
                        Math.min(10, Number(event.target.value) || 0),
                      ),
                    })
                  }
                />
              </label>
            </>
          )}
          {selected.type === "overlay" && (
            <label>
              {t("Fade")}
              <SearchableSelect
                aria-label={t("Page shadow fade")}
                value={selected.fade || "solid"}
                onChange={(event) => change({ fade: event.target.value })}
              >
                <option value="solid">{t("Solid tint")}</option>
                <option value="top">{t("Fade from top")}</option>
                <option value="bottom">{t("Fade from bottom")}</option>
                <option value="edges">{t("Soft edges / vignette")}</option>
              </SearchableSelect>
            </label>
          )}
          <div className="cs-page-layer-coordinates">
            {coordinates.map((field) => (
              <label key={field}>
                {t(
                  { x: "Left", y: "Top", width: "Width", height: "Height" }[
                    field
                  ],
                )}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step=".5"
                  aria-label={`${t("Page layer")} ${t({ x: "Left", y: "Top", width: "Width", height: "Height" }[field])}`}
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
            {t("Rotation")}
            <input
              type="range"
              min="-45"
              max="45"
              aria-label={t("Page layer rotation")}
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
                materializeBlackCollectionPageArtworks(draft, pageKey);
                const pageLayers = draft.pageArtworks?.[pageKey];
                if (selected.id.startsWith("black-collection-")) {
                  const layer = pageLayers?.find(
                    (item) => item.id === selected.id,
                  );
                  if (layer) layer.hidden = true;
                } else if (draft.pageArtworks && pageLayers)
                  draft.pageArtworks[pageKey] = pageLayers.filter(
                    (item) => item.id !== selected.id,
                  );
              })
            }
          >
            {t("Remove selected layer")}
          </button>
        </>
      )}
    </div>
  );
}

function LayerColorControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <fieldset className="cs-page-layer-color">
      <legend>{t("Color")}</legend>
      <ColorField
        label={t("Page layer color")}
        value={value || "#1c4075"}
        onChange={onChange}
      />
    </fieldset>
  );
}
