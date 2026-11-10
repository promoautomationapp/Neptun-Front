import React, { useRef } from "react";
import type { Campaign, CampaignMutator } from "../../domain/models";
import { ActionMenu } from "./ActionMenu";
import { EditorIcon } from "./EditorIcon";
import { useImagePicker } from "./ImagePickerProvider";
import { createPageBanner, type PageBannerKind } from "./pageBanners";
import { readImage } from "./utils";
import { t } from "./i18n";
import "../../styles/page-banners.css";

export function PageBannerMenu({
  pageKey,
  onUpdate,
  onToast,
}: {
  campaign: Campaign;
  pageKey: string;
  onUpdate: (mutate: CampaignMutator) => void;
  onToast?: (message: string) => void;
}) {
  const chooseImage = useImagePicker();
  const input = useRef<HTMLInputElement>(null);
  const add = (kind: PageBannerKind, image?: string, name?: string) => {
    onUpdate((draft) => {
      draft.pageArtworks ||= {};
      draft.pageArtworks[pageKey] ||= [];
      draft.pageArtworks[pageKey].push(
        createPageBanner(kind, draft, pageKey, {
          id: crypto.randomUUID(),
          text: kind === "image" ? undefined : t("Your banner message"),
          image,
          name: name || t(kind === "image" ? "Image banner" : "Page banner"),
        }),
      );
    });
    onToast?.(t("Banner added. Products fit below it."));
  };
  const image = () => {
    if (chooseImage)
      chooseImage({
        title: t("Image banner"),
        kind: "image",
        onSelect: (source) => add("image", source),
      });
    else input.current?.click();
  };
  return (
    <>
      <ActionMenu
        label={
          <>
            <EditorIcon name="layout" />
            {t("Banner")}
          </>
        }
        triggerLabel={t("Add page banner")}
        className="cs-canvas-banner-menu"
        portal
        portalClassName="cs-page-banner-menu"
      >
        <button type="button" onClick={() => add("color")}>
          <span className="page-banner-option color">Aa</span>
          <span>
            <b>{t("Colored banner")}</b>
            <small>{t("Orange with white text. Change any color.")}</small>
          </span>
        </button>
        <button type="button" onClick={() => add("text")}>
          <span className="page-banner-option text">Aa</span>
          <span>
            <b>{t("Text banner")}</b>
            <small>{t("Text with a transparent background.")}</small>
          </span>
        </button>
        <button type="button" onClick={image}>
          <span className="page-banner-option image">
            <EditorIcon name="image" />
          </span>
          <span>
            <b>{t("Image banner")}</b>
            <small>{t("An image above the products, one row high.")}</small>
          </span>
        </button>
      </ActionMenu>
      <input
        ref={input}
        hidden
        type="file"
        accept="image/*"
        aria-label={t("Upload banner image")}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
            onToast?.(t("Choose an image under 12 MB."));
            return;
          }
          try {
            add("image", await readImage(file), file.name);
          } catch {
            onToast?.(t("Could not read this image."));
          }
        }}
      />
    </>
  );
}
