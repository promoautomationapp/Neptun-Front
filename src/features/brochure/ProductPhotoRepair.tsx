import React, { useMemo, useState } from "react";
import type { Campaign } from "../../domain/models";
import { Button, Modal } from "./Modals";
import { t } from "./i18n";
import {
  productImagePreparationTargets,
  productPhotoSelectionKey,
} from "./productImagePreparationQueue";
import "../../styles/product-photo-repair.css";

export interface ProductPhotoRepairSelection {
  targetKeys: string[];
  instructions: string;
}

export function ProductPhotoRepair({
  campaign,
  failedTargetKeys = [],
  busyTargetKeys = [],
  onPrepare,
  onClose,
}: {
  campaign: Campaign;
  failedTargetKeys?: string[];
  busyTargetKeys?: string[];
  onPrepare: (selection: ProductPhotoRepairSelection) => void;
  onClose: () => void;
}) {
  const photos = useMemo(() => {
    const pending = new Set(
      productImagePreparationTargets(campaign).map(productPhotoSelectionKey),
    );
    const failed = new Set(failedTargetKeys);
    const busy = new Set(busyTargetKeys);
    return productImagePreparationTargets(campaign, undefined, {
      force: true,
    }).map((target) => {
      const key = productPhotoSelectionKey(target);
      const offer = campaign.products.find(
        (product) => product.code === target.offerCode,
      )!;
      const product = target.memberCode
        ? offer.bundleProducts!.find(
            (member) => member.code === target.memberCode,
          )!
        : offer;
      const suggested =
        failed.has(key) || pending.has(key) || Boolean(product.skipAiCutout);
      return {
        key,
        name: product.name,
        code: product.code,
        image: product.image || target.source,
        suggested,
        busy: busy.has(key),
        status: busy.has(key)
          ? "Preparing photo…"
          : failed.has(key)
            ? "Needs attention"
            : suggested
              ? "Not prepared"
              : "Current photo",
      };
    });
  }, [campaign, failedTargetKeys, busyTargetKeys]);
  const [selected, setSelected] = useState(
    () =>
      new Set(
        photos
          .filter((photo) => photo.suggested && !photo.busy)
          .map((photo) => photo.key),
      ),
  );
  const [search, setSearch] = useState("");
  const [instructions, setInstructions] = useState("");
  const selectedPhotos = photos.filter(
    (photo) => !photo.busy && selected.has(photo.key),
  );
  const visiblePhotos = photos.filter((photo) =>
    `${photo.name} ${photo.code}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <Modal title={t("Fix product photos")} onClose={onClose} wide>
      <div className="cs-photo-repair">
        <p className="cs-photo-repair-intro">
          {t(
            "Choose the photos that need background removal or a better cutout. Each replacement is saved when it is ready.",
          )}
        </p>
        <div className="cs-photo-repair-tools">
          <label className="cs-field">
            <span>{t("Search products")}</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("Product name or code")}
            />
          </label>
          <div className="cs-photo-repair-selection">
            <strong role="status">
              {selectedPhotos.length} / {photos.length} {t("photos selected")}
            </strong>
            <div>
              <Button
                disabled={!photos.some((photo) => !photo.busy)}
                onClick={() =>
                  setSelected(
                    new Set(
                      photos
                        .filter((photo) => !photo.busy)
                        .map((photo) => photo.key),
                    ),
                  )
                }
              >
                {t("Select all")}
              </Button>
              <Button
                disabled={!selected.size}
                onClick={() => setSelected(new Set())}
              >
                {t("Clear selection")}
              </Button>
            </div>
          </div>
        </div>
        <div className="cs-photo-repair-grid" aria-label={t("Product photos")}>
          {visiblePhotos.map((photo) => (
            <label
              key={photo.key}
              className={`cs-photo-repair-card ${selected.has(photo.key) && !photo.busy ? "is-selected" : ""} ${photo.busy ? "is-busy" : ""}`}
            >
              <input
                type="checkbox"
                checked={!photo.busy && selected.has(photo.key)}
                disabled={photo.busy}
                onChange={() => toggle(photo.key)}
                aria-label={`${photo.name} · ${photo.code}`}
              />
              <span className="cs-photo-repair-thumbnail">
                <img src={photo.image} alt="" loading="lazy" />
              </span>
              <span className="cs-photo-repair-description">
                <strong>{photo.name}</strong>
                <small>{photo.code}</small>
                <span
                  className={`cs-photo-repair-status ${photo.suggested ? "needs-attention" : ""}`}
                >
                  {t(photo.status)}
                </span>
              </span>
            </label>
          ))}
          {!visiblePhotos.length && (
            <p className="cs-photo-repair-empty">
              {t(
                photos.length
                  ? "No matching photos."
                  : "Upload product photos first to remove their backgrounds.",
              )}
            </p>
          )}
        </div>
        <label className="cs-field cs-photo-repair-instructions">
          <span>{t("What should be fixed? (optional)")}</span>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={t(
              "For example: Remove the white background and keep the whole product, including its stand.",
            )}
          />
          <small>
            {t("Your instructions apply to the selected photos.")}{" "}
            {instructions.length} / 1000
          </small>
        </label>
      </div>
      <div className="cs-modal-actions">
        <Button onClick={onClose}>{t("Cancel")}</Button>
        <Button
          tone="primary"
          disabled={!selectedPhotos.length}
          onClick={() =>
            onPrepare({
              targetKeys: selectedPhotos.map((photo) => photo.key),
              instructions: instructions.trim(),
            })
          }
        >
          {t("Remove backgrounds")} · {selectedPhotos.length}
        </Button>
      </div>
    </Modal>
  );
}
