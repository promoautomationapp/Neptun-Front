import { fireEvent, type RenderResult } from "@testing-library/react";
/** Open the settings groups the test is about to edit, as a person would. */
export function openSettingsSections(root: HTMLElement) {
  for (const section of root.querySelectorAll<HTMLDetailsElement>(
    "details.ns-settings-group",
  )) {
    if (!section.open) {
      const summary = section.querySelector("summary");
      if (summary) fireEvent.click(summary);
    }
  }
}

/** Navigate the page area first, then the relevant settings section. */
export function openSettingsTab(view: RenderResult, label: string) {
  const area =
    label === "Stores & contacts"
      ? "Stores page"
      : label === "Campaign types" || label === "Format & layout"
        ? "Campaign types & sizes"
        : label === "Prices & savings" ||
            label === "Category defaults" ||
            label === "Product design"
          ? "Inside pages"
          : label === "Brands"
            ? "Reusable images"
            : "Cover";
  fireEvent.click(view.getByRole("tab", { name: area }));
  fireEvent.click(view.getByRole("tab", { name: label }));
  openSettingsSections(view.container);
}

/** Select through the custom popover while using a saved settings value as the fixture input. */
export function selectSetting(
  view: RenderResult,
  label: string,
  value: string,
) {
  const trigger = view.getByRole("combobox", { name: label });
  const native = trigger.parentElement?.querySelector("select");
  const option = [...(native?.options ?? [])].find(
    (option) => option.value === value,
  );
  if (!option) throw new Error(`No ${label} option for ${value}`);
  fireEvent.click(trigger);
  fireEvent.click(view.getByRole("option", { name: option.label }));
}
