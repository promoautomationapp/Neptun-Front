import { fireEvent } from "@testing-library/react";
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
