import React, { useRef, useState } from "react";
import type { Artwork, Campaign, Product } from "../../domain/models";
import {
  effectiveProductArtworks,
  defaultProductArtworks,
} from "./productArtwork";
import { ImageUploadButton } from "./ImageUploadButton";
import { readImage } from "./utils";
import { t } from "./i18n";
import {
  patchProductArtwork,
  type ProductArtworkPatch,
} from "./productArtworkEdits";
import "../../styles/product-artwork-controls.css";

export function ProductArtworkControls({
  product,
  onChange,
  campaign = {},
}: {
  product: Product;
  campaign?: Partial<Campaign>;
  onChange: (field: keyof Product | ProductArtworkPatch, value?: Product[keyof Product]) => void;
}) {
  const artworks = effectiveProductArtworks(product, campaign);
  const defaults = defaultProductArtworks(product, campaign);
  const latest = useRef(artworks);
  latest.current = artworks;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const save = (next: Artwork[] | null) => onChange("productArtworks", next);
  const patch = (id: string, values: Partial<Artwork>) => {
    const changes = patchProductArtwork(product, latest.current, id, values);
    if (Object.hasOwn(changes, "bundleProducts")) onChange(changes);
    else save(changes.productArtworks || []);
  };
  const remove = (id: string) =>
    save(latest.current.filter((item) => item.id !== id));

  async function upload(file: File | undefined, id?: string) {
    if (uploading || !file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("Choose an image file."));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError(t("Choose an image smaller than 12 MB."));
      return;
    }
    setError("");
    setUploading(true);
    try {
      const image = await readImage(file);
      if (id) {
        patch(id, { image, usesPrimaryImage: false });
      } else {
        save([
          ...latest.current,
          {
            id: crypto.randomUUID(),
            type: "image",
            label: file.name.replace(/\.[^.]+$/, "") || t("Additional image"),
            image,
            relativeTo: "product",
            x: 50,
            y: 50,
            width: 20,
          },
        ]);
      }
    } catch {
      setError(t("Could not read this image. Choose another file."));
    } finally {
      setUploading(false);
    }
  }

  return (
    <section
      className="product-artwork-controls"
      aria-label={t("Product images and feature badges")}
      aria-busy={uploading}
    >
      <div className="product-artwork-heading">
        <strong>{t("Product images and feature badges")}</strong>
        {defaults.length > 0 && (
          <button
            type="button"
            className="product-artwork-reset"
            onClick={() => save(null)}
          >
            {t("Reset feature defaults")}
          </button>
        )}
      </div>
      <p>
        {t(
          "Drag images and badges on the product to move or resize them. You can replace or remove each one.",
        )}
      </p>
      <div className="product-artwork-list">
        {artworks.map((artwork, index) => (
          <div className="product-artwork-control-item" key={artwork.id}>
            <div className="product-artwork-item-heading">
              <label>
                <span>{t("Image label")}</span>
                <input
                  value={artwork.label || ""}
                  aria-label={`${t("Image label")} ${index + 1}`}
                  onChange={(event) =>
                    patch(artwork.id, { label: event.target.value })
                  }
                />
              </label>
              <button
                type="button"
                className="product-artwork-delete"
                aria-label={`${t("Remove artwork")}: ${artwork.label || index + 1}`}
                onClick={() => remove(artwork.id)}
              >
                ×
              </button>
            </div>
            <ImageUploadButton
              label={t("Replace product image or badge")}
              value={artwork.image}
              onFile={(file) => upload(file, artwork.id)}
            />
            <div className="product-artwork-ranges">
              {(
                [
                  ["x", "Left", 0, 100, 50],
                  ["y", "Top", 0, 100, 50],
                  ["width", "Width", 1, 100, 20],
                ] as Array<
                  ["x" | "y" | "width", string, number, number, number]
                >
              ).map(([field, label, min, max, fallback]) => (
                <label key={field}>
                  <span>
                    {t(label)}
                    <output>
                      {Math.round(Number(artwork[field] ?? fallback))}%
                    </output>
                  </span>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step="1"
                    value={artwork[field] ?? fallback}
                    aria-label={`${t(label)}: ${artwork.label || index + 1}`}
                    onChange={(event) =>
                      patch(artwork.id, { [field]: Number(event.target.value) })
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <ImageUploadButton
        label={t("Add image to this product")}
        onFile={(file) => upload(file)}
        hint={t(
          "Additional images stay with this product. No AI preparation is required.",
        )}
      />
      {uploading && <small role="status">{t("Reading image…")}</small>}
      {error && (
        <p className="product-artwork-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
