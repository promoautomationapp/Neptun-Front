import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import {
  BrochurePresetPicker,
  PresetThumbnail,
} from "../../src/features/brochure/BrochurePresetPicker";
import { availableBrochurePresets } from "../../src/features/brochure/brochurePresets";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(cleanup);
it("selects the clean black collection directly and uses a person-free thumbnail", () => {
  setLanguage("en");
  const preset = availableBrochurePresets(resolveSettings(null)).find(
    (preset) => preset.id === "neptun-black-collection",
  )!;
  const choose = vi.fn();
  const view = render(
    <BrochurePresetPicker
      presets={[preset]}
      value=""
      onChange={choose}
      onPreview={() => {}}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Black collection" }));
  expect(choose).toHaveBeenCalledWith(preset);
  expect(view.queryByRole("dialog")).toBeNull();
  view.rerender(<PresetThumbnail preset={preset} />);
  expect(view.container.querySelector("img")?.getAttribute("src")).toMatch(
    /^data:image\/svg\+xml,/,
  );
});
