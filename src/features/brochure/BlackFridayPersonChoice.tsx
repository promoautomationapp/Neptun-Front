import React, { useRef, useState } from "react";
import { Modal } from "../../components/Modal";
import type { BrochurePreset } from "./brochurePresets";
import { useImagePicker } from "./ImagePickerProvider";
import {
  blackFridayPersonSource,
  blackFridayCompositePerson,
  withBlackFridayPerson,
  type BlackFridayPersonChoice as PersonChoice,
} from "./blackFridayPerson";
import { EditorIcon } from "./EditorIcon";
import { readImage } from "./utils";
import { t } from "./i18n";
import "../../styles/black-friday-person-choice.css";

export function BlackFridayPersonChoice({
  preset,
  onSelect,
  onClose,
}: {
  preset: BrochurePreset;
  onSelect: (preset: BrochurePreset) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<PersonChoice["mode"]>("keep");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const chooseImage = useImagePicker();
  const supplied = Object.values(preset.design.pageArtworks || {})
    .flat()
    .find((artwork) => blackFridayPersonSource(artwork));
  const hasCompositePerson = Object.values(preset.design.pageArtworks || {})
    .flat()
    .some(blackFridayCompositePerson);
  const upload = () => {
    setMode("replace");
    if (chooseImage)
      chooseImage({
        kind: "image",
        title: t("Replace the person image"),
        source: image,
        onSelect: (source) => {
          setImage(source);
          setError("");
        },
      });
    else input.current?.click();
  };
  return (
    <Modal title={t("Person image for Black Friday")} onClose={onClose}>
      <p className="bf-person-note">
        {t(
          "Keep the supplied person, upload a new one for this campaign, or use only the products and titles.",
        )}
      </p>
      <div
        className="bf-person-options"
        role="radiogroup"
        aria-label={t("Person image")}
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === "keep"}
          onClick={() => setMode("keep")}
        >
          <span className="bf-person-option-image">
            {supplied?.image ? (
              <img src={supplied.image} alt="" />
            ) : (
              <EditorIcon name="image" />
            )}
          </span>
          <span>
            <b>{t("Keep supplied person")}</b>
            <small>{t("Use the original brochure artwork.")}</small>
          </span>
          <span className="bf-person-radio" />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "replace"}
          onClick={upload}
        >
          <span className="bf-person-option-image">
            {image ? <img src={image} alt="" /> : <EditorIcon name="plus" />}
          </span>
          <span>
            <b>{t("Upload replacement")}</b>
            <small>
              {t("Use your new person image in the same positions.")}
            </small>
          </span>
          <span className="bf-person-radio" />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "none"}
          onClick={() => setMode("none")}
        >
          <span className="bf-person-option-image none">
            <EditorIcon name="close" />
          </span>
          <span>
            <b>{t("No person")}</b>
            <small>{t("Keep product cards, titles and logos.")}</small>
          </span>
          <span className="bf-person-radio" />
        </button>
      </div>
      {mode !== "keep" && hasCompositePerson && (
        <p className="bf-person-note">
          {t(
            "The closing promotional photo includes the person and products together. It will also be removed or replaced; separate product cards stay.",
          )}
        </p>
      )}
      <input
        ref={input}
        hidden
        type="file"
        accept="image/*"
        aria-label={t("Upload replacement")}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) {
            setError(t("Choose an image under 12 MB."));
            return;
          }
          try {
            setImage(await readImage(file));
            setError("");
          } catch {
            setError(t("Could not read this image."));
          }
        }}
      />
      {mode === "replace" && !image && (
        <p className="bf-person-note">
          {t(
            "Upload an image to continue. A transparent background works best.",
          )}
        </p>
      )}
      {error && (
        <p className="cs-error" role="alert">
          {error}
        </p>
      )}
      <div className="cs-modal-actions">
        <button type="button" className="cs-button secondary" onClick={onClose}>
          {t("Back")}
        </button>
        <button
          type="button"
          className="cs-button primary"
          disabled={mode === "replace" && !image}
          onClick={() =>
            onSelect(withBlackFridayPerson(preset, { mode, image }))
          }
        >
          {t("Use this design")}
        </button>
      </div>
    </Modal>
  );
}
