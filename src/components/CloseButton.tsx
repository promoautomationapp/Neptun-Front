import type { ButtonHTMLAttributes } from "react";
import { t } from "../features/brochure/i18n";
import { CloseIcon } from "./CloseIcon";
import "./close-button.css";

/** Keeps dismissal controls independent of form button padding and text baselines. */
export function CloseButton({
  className = "",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      {...props}
      type="button"
      className={`np-close-button ${className}`.trim()}
      aria-label={props["aria-label"] || t("Close")}
    >
      <CloseIcon />
    </button>
  );
}
