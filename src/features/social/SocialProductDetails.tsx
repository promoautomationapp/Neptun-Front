import React from "react";
import type { Placement, Product } from "../../domain/models";
import {
  applianceDetailEntries,
  isWashingMachine,
} from "../brochure/applianceDetails";
import {
  conditionerDetailEntries,
  defaultFilledDetail,
} from "../brochure/conditionerDetails";
import { DetailContent, FittedDetailValue } from "../brochure/DetailContent";
import { savedDetailEntries } from "../brochure/detailFacts";
import {
  brochureDefaultDetailEntries,
  brochureVisibleDetailEntries,
  deleteDisplayedDetail,
  editDisplayedDetail,
  reorderDisplayedDetails,
} from "../brochure/detailRows";
import { isMemoryDetail, mobileDetailEntries } from "../brochure/mobileDetails";
import { ProductDetailBlock } from "../brochure/ProductDetailBlock";
import { isAirConditioner } from "../brochure/productArtwork";
import { isAppleProduct, isMobilePhone } from "../brochure/productTypes";
import { displaySpecs } from "../brochure/tvSpecs";
import { warrantyDuration } from "../brochure/warranty";
import { EditableOfferBlock } from "./CanvasLayers";
import "../../styles/social-detail-strip.css";

/** Full source rows, also used when saving a reorder of the visible tiles. */
export function socialProductDetailEntries(
  product: Product,
): Array<[string, string]> {
  if (Array.isArray(product.brochureDetails))
    return savedDetailEntries(product) || [];
  return (
    isMobilePhone(product) && !isAppleProduct(product)
      ? mobileDetailEntries(product, { includeFallback: false })
      : isAirConditioner(product)
        ? conditionerDetailEntries(product)
        : isWashingMachine(product)
          ? applianceDetailEntries(product)
          : Object.entries(displaySpecs(product))
  ).filter(
    ([key, value]) => value && !/garanc|warrant|ngjyr|colou?r/i.test(key),
  );
}

export interface SocialProductDetailsProps {
  product: Product;
  reference: "red" | "blue" | "legacy";
  atImage?: boolean;
  editable?: boolean;
  onChange?: (changes: Partial<Product>) => void;
  onPlacementChange?: (placement: Placement) => void;
  onEdit?: () => void;
  onReorder?: (from: number, to: number) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}

const DETAIL_DRAG_TYPE = "application/x-social-detail";

export function SocialProductDetails({
  product,
  reference,
  atImage = false,
  editable,
  onChange,
  onPlacementChange,
  onEdit,
  onReorder,
  onGestureStart,
  onGestureEnd,
}: SocialProductDetailsProps) {
  const imported = Array.isArray(product.brochureDetails);
  const allSpecs = socialProductDetailEntries(product);
  const warranty =
    !product.hideWarranty && reference === "red"
      ? warrantyDuration(product.warranty)
      : null;
  const preferredSpecs = imported
    ? allSpecs
    : brochureDefaultDetailEntries(product, allSpecs);
  const specs = brochureVisibleDetailEntries(preferredSpecs, {
    warrantyInStrip: Boolean(warranty),
  });
  const canEdit =
    editable ?? Boolean(onChange || onPlacementChange || onReorder || onEdit);
  const change = canEdit ? onChange : undefined;
  const reorder =
    canEdit && (onReorder || onChange)
      ? (from: number, to: number) => {
          if (onReorder) onReorder(from, to);
          else change?.(reorderDisplayedDetails(product, allSpecs, from, to));
        }
      : undefined;
  const detailGesture = React.useRef(false);
  function beginDetailGesture(event: React.PointerEvent<HTMLSpanElement>) {
    if (!change || event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest("input,textarea,select,.detail-block-inline-editor"))
      return;
    const button = target.closest("button");
    if (button && !button.matches(".detail-block-move,.detail-block-resize"))
      return;
    detailGesture.current = true;
    onGestureStart?.();
  }
  function endDetailGesture() {
    if (!detailGesture.current) return;
    detailGesture.current = false;
    onGestureEnd?.();
  }
  const tileGesture = {
    onPointerDownCapture: beginDetailGesture,
    onPointerUpCapture: endDetailGesture,
    onPointerCancelCapture: endDetailGesture,
    onLostPointerCaptureCapture: endDetailGesture,
  };
  const changeTile = change
    ? (
        field: "detailBlockPlacements" | "detailBlockStyles",
        value: Product[typeof field],
      ) => change({ [field]: value })
    : undefined;

  if (!specs.length && !warranty) return null;
  return (
    <EditableOfferBlock
      name="product details"
      className={`social-specs social-detail-strip social-detail-reference-${reference} ${imported ? "social-imported-specs" : ""} ${atImage ? "social-details-at-image-left" : ""}`}
      placement={product.offerPlacements?.details}
      editable={canEdit && Boolean(onPlacementChange || change)}
      onChange={(placement) => {
        if (onPlacementChange) onPlacementChange(placement);
        else
          change?.({
            offerPlacements: { ...product.offerPlacements, details: placement },
          });
      }}
      onEdit={onEdit}
      onGestureStart={onGestureStart}
      onGestureEnd={onGestureEnd}
      style={
        {
          "--social-detail-columns": Math.max(
            1,
            specs.length + Number(Boolean(warranty)),
          ),
        } as React.CSSProperties
      }
    >
      {specs.map(([key, value], index) => {
        const sourceIndex = allSpecs.findIndex(
          ([sourceKey]) => sourceKey === key,
        );
        return (
          <ProductDetailBlock
            key={key}
            product={product}
            detailKey={key}
            className={`${isMemoryDetail(key, value) ? "detail-memory" : ""} ${reference === "red" && defaultFilledDetail(product, key, value, index) ? "detail-filled" : ""}`}
            onChange={changeTile}
            onEdit={canEdit ? onEdit : undefined}
            editText={imported ? value : `${key}: ${value}`}
            onSaveText={
              change
                ? (text) =>
                    change(
                      editDisplayedDetail(product, allSpecs, sourceIndex, text),
                    )
                : undefined
            }
            onRemove={
              change
                ? () =>
                    change(
                      deleteDisplayedDetail(product, allSpecs, sourceIndex),
                    )
                : undefined
            }
            draggable={Boolean(reorder)}
            onDragStart={
              reorder
                ? (event) => {
                    event.stopPropagation();
                    event.dataTransfer.setData(
                      DETAIL_DRAG_TYPE,
                      `${product.code}:${sourceIndex}`,
                    );
                  }
                : undefined
            }
            onDragOver={
              reorder
                ? (event) => {
                    if (
                      [...event.dataTransfer.types].includes(DETAIL_DRAG_TYPE)
                    )
                      event.preventDefault();
                  }
                : undefined
            }
            onDrop={
              reorder
                ? (event) => {
                    const source = event.dataTransfer.getData(DETAIL_DRAG_TYPE);
                    const prefix = `${product.code}:`;
                    if (!source.startsWith(prefix)) return;
                    const from = Number(source.slice(prefix.length));
                    if (
                      !Number.isInteger(from) ||
                      from < 0 ||
                      from >= allSpecs.length ||
                      from === sourceIndex
                    )
                      return;
                    event.preventDefault();
                    event.stopPropagation();
                    reorder(from, sourceIndex);
                  }
                : undefined
            }
            {...tileGesture}
          >
            <DetailContent
              product={product}
              label={key}
              value={value}
              imported={imported}
              layout="strip"
              reference={reference}
            />
          </ProductDetailBlock>
        );
      })}
      {warranty && (
        <ProductDetailBlock
          product={product}
          detailKey="__warranty"
          className="social-warranty-box"
          onChange={changeTile}
          onRemove={change ? () => change({ hideWarranty: true }) : undefined}
          aria-label={`${warranty.count} ${warranty.unit.toLowerCase()} garancion`}
          {...tileGesture}
        >
          <FittedDetailValue
            text={warranty.count}
            className="detail-warranty-count"
          />
          <small>
            <span className="social-warranty-unit">{warranty.unit}</span>
            <span className="social-warranty-label">GARANCION</span>
          </small>
        </ProductDetailBlock>
      )}
    </EditableOfferBlock>
  );
}
