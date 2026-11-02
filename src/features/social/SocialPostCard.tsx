import type { ReactNode } from "react";
import type { SocialPost } from "../../domain/models";
import { t } from "../brochure/i18n";
import { NavIcon } from "../studio/NavIcon";
import { ActionMenu } from "../brochure/ActionMenu";
import { outputDimensions, SOCIAL_PRESETS } from "./postModel";
import { socialPostDisplayName } from "./socialPostLibrary";
import "./social-post-card.css";

export function SocialPostCard({
  post,
  preview,
  busy,
  onOpen,
  onDownload,
  onDuplicate,
  onDelete,
  onRestore,
}: {
  post: SocialPost;
  preview: ReactNode;
  busy: boolean;
  onOpen: () => void;
  onDownload: (format: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const name = socialPostDisplayName(post);
  const dims = outputDimensions(post);
  const preset = SOCIAL_PRESETS.find((item) => item.id === post.preset);
  const thumbnail = (
    <div
      className="social-post-thumbnail"
      style={
        {
          "--social-card-ratio": dims.width / dims.height,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <div className="social-post-thumbnail-frame">{preview}</div>
    </div>
  );
  return (
    <article
      className={`social-post-card${post.disabledAt ? " social-post-card-disabled" : ""}`}
      aria-label={name}
    >
      {post.disabledAt ? (
        <div className="social-post-card-cover">
          {thumbnail}
          <span className="social-disabled-badge">{t("Deleted")}</span>
        </div>
      ) : (
        <button
          className="social-post-card-open"
          type="button"
          aria-label={`${t("Open post")}: ${name}`}
          onClick={onOpen}
        >
          {thumbnail}
        </button>
      )}
      <div className="social-post-card-info">
        <h3>{name}</h3>
        <p>
          {post.products?.length || 0} {t(post.products?.length === 1 ? "product" : "products")} ·{" "}
          {preset?.channel || t("Custom size")}
        </p>
        <small>
          {dims.width} × {dims.height}
        </small>
      </div>
      {post.disabledAt ? (
        <div className="social-post-card-actions">
          <small>{t("Only superadmins can see this deleted post.")}</small>
          <button
            type="button"
            className="social-post-card-download"
            onClick={onRestore}
            disabled={busy}
            aria-label={t("Restore post")}
          >
            <NavIcon name="refresh" size={16} />
            {t("Restore post")}
          </button>
        </div>
      ) : (
        <div className="social-post-card-actions">
          <div className="social-post-card-download-row">
            <button
              type="button"
              className="social-post-card-download"
              onClick={() => onDownload("png")}
              disabled={busy}
              aria-label={t("Download post")}
            >
              <NavIcon name="download" size={16} />
              {t("Download PNG")}
            </button>
            <ActionMenu
              portal
              className="social-post-card-formats"
              label={
                <span className="social-post-card-visually-hidden">
                  {t("Download options")}
                </span>
              }
            >
              {["jpg", "webp", "pdf"].map((format) => (
                <button
                  type="button"
                  key={format}
                  disabled={busy}
                  onClick={() => onDownload(format)}
                >
                  <NavIcon name="download" size={16} />
                  {t("Download")} {format.toUpperCase()}
                </button>
              ))}
            </ActionMenu>
          </div>
          <div>
            <button
              type="button"
              onClick={onDuplicate}
              disabled={busy}
              aria-label={t("Duplicate post")}
            >
              <NavIcon name="copy" size={16} />
              {t("Duplicate")}
            </button>
            <button
              type="button"
              className="social-post-card-delete"
              onClick={onDelete}
              disabled={busy}
              aria-label={t("Delete post")}
            >
              <NavIcon name="trash" size={16} />
              {t("Delete")}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
