import React from "react";
import type {FormatInput}from "./brochureFormat";
import { BROCHURE_FORMATS, resolveBrochureFormat } from "./brochureFormat";
import { t } from "./i18n";

export function BrochureFormatPicker({ value, onChange }:{value:FormatInput;onChange:(value:string)=>void}) {
  const current = resolveBrochureFormat(value);
  return <label className="cs-field cs-brochure-format-picker">
    <span>{t("Brochure size")}</span>
    <select aria-label={t("Brochure size")} value={current.id} onChange={(event) => onChange(event.target.value)}>
      {BROCHURE_FORMATS.map((format) => <option key={format.id} value={format.id}>{t(format.label)}</option>)}
    </select>
    <small>{t("Applies to every page. Images, prices and details keep their proportions.")}</small>
  </label>;
}
