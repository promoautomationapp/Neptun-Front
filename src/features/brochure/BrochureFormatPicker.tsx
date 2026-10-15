import { SearchableSelect } from "../../components/SearchableSelect";
import React from "react";
import type { CustomBrochureFormat, FormatInput } from "./brochureFormat";
import {
  availableBrochureFormats,
  resolveBrochureFormat,
} from "./brochureFormat";
import { t } from "./i18n";

export function BrochureFormatPicker({
  value,
  onChange,
  customFormats = [],
}: {
  value: FormatInput;
  onChange: (value: string) => void;
  customFormats?: readonly CustomBrochureFormat[];
}) {
  const current = resolveBrochureFormat(value, customFormats);
  const options = availableBrochureFormats(customFormats);
  const choices = options.some((item) => item.id === current.id)
    ? options.map((item) => (item.id === current.id ? current : item))
    : [...options, current];
  return (
    <label className="cs-field cs-brochure-format-picker">
      <span>{t("Brochure size")}</span>
      <SearchableSelect
        aria-label={t("Brochure size")}
        value={current.id}
        onChange={(event) => onChange(event.target.value)}
      >
        {choices.map((format) => (
          <option key={format.id} value={format.id}>
            {t(format.label)}
          </option>
        ))}
      </SearchableSelect>
      <small>
        {t(
          "Applies to every page. Images, prices and details keep their proportions.",
        )}
      </small>
    </label>
  );
}
