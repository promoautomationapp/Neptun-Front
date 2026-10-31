import React from "react";
import { Modal } from "../../components/Modal";
import { resolveAsset } from "../../api/client";
import type { SocialPost } from "../../domain/models";
import { t } from "../brochure/i18n";
import {
  brandingVisibility,
  socialBrandingSource,
  socialBrandingText as copy,
  type SocialBrandingKind,
} from "./socialBranding";
import "./social-branding.css";

export function SocialBrandingPanel({
  post,
  onUpdate,
  onChoose,
  onClose,
}: {
  post: SocialPost;
  onUpdate: (mutate: (post: SocialPost) => void) => void;
  onChoose: (kind: SocialBrandingKind) => void;
  onClose: () => void;
}) {
  const labels = {
    neptun: t("NEPTUN logo"),
    event: t("Event badge"),
    custom: t("Extra campaign logo"),
  };
  return (
    <Modal title={copy("Branding & layout")} onClose={onClose}>
      <p className="social-branding-help">
        {copy(
          "Event branding is optional. Add a saved logo or upload your own.",
        )}
      </p>
      <div className="social-branding-list">
        {(["neptun", "event", "custom"] as const).map((kind) => {
          const source = socialBrandingSource(post, kind);
          const visible = Boolean(post[brandingVisibility[kind]]);
          return (
            <section key={kind} className="social-branding-row">
              <div className="social-branding-art">
                {source ? (
                  <img src={resolveAsset(source)} alt="" />
                ) : (
                  <span aria-hidden="true">+</span>
                )}
              </div>
              <div>
                <strong>{labels[kind]}</strong>
                <label>
                  <input
                    type="checkbox"
                    aria-label={`${t("Show")} ${labels[kind]}`}
                    checked={visible}
                    disabled={kind === "custom" && !source}
                    onChange={(event) =>
                      onUpdate((draft) => {
                        draft[brandingVisibility[kind]] = event.target.checked;
                      })
                    }
                  />
                  {t("Show")}
                </label>
              </div>
              <div className="social-branding-row-actions">
                <button
                  type="button"
                  aria-label={`${copy(source ? "Change logo" : "Add logo")}: ${labels[kind]}`}
                  onClick={() => onChoose(kind)}
                >
                  {copy(source ? "Change logo" : "Add logo")}
                </button>
                <button
                  type="button"
                  className="danger"
                  aria-label={`${copy("Remove logo")}: ${labels[kind]}`}
                  disabled={!visible}
                  onClick={() =>
                    onUpdate((draft) => {
                      draft[brandingVisibility[kind]] = false;
                    })
                  }
                >
                  {t("Delete")}
                </button>
              </div>
            </section>
          );
        })}
      </div>
      <div
        className="social-branding-layout"
        role="group"
        aria-label={copy("Branding & layout")}
      >
        {(["corner", "footer"] as const).map((layout) => (
          <button
            type="button"
            key={layout}
            aria-pressed={(post.logoLayout || "corner") === layout}
            onClick={() =>
              onUpdate((draft) => {
                draft.logoLayout = layout;
              })
            }
          >
            <span
              aria-hidden="true"
              className={`social-branding-layout-preview ${layout}`}
            >
              <b>N</b>
              {layout === "footer" && <i />}
            </span>
            {copy(layout === "corner" ? "Corner logo" : "Logo and footer line")}
          </button>
        ))}
      </div>
      {post.logoLayout === "footer" && (
        <div className="social-branding-footer-options">
          <label>
            <input
              type="checkbox"
              checked={post.showLogoFooterLine !== false}
              onChange={(event) =>
                onUpdate((draft) => {
                  draft.showLogoFooterLine = event.target.checked;
                })
              }
            />
            {copy("Footer line")}
          </label>
          <button
            type="button"
            onClick={() =>
              onUpdate((draft) => {
                if (draft.logoCoords) delete draft.logoCoords.footer;
              })
            }
          >
            {copy("Reset footer position")}
          </button>
        </div>
      )}
    </Modal>
  );
}
