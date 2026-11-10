import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  BrochurePresetPreview,
  PresetThumbnail,
} from "../../src/features/brochure/BrochurePresetPicker";
import { availableBrochurePresets } from "../../src/features/brochure/brochurePresets";
import { resolveSettings } from "../../src/features/settings/settings.schema";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("uses the exact source cover for the Black Friday design choice", () => {
  const preset = availableBrochurePresets(resolveSettings(null)).find(
    (item) => item.id === "neptun-black-friday",
  )!;
  const view = render(<PresetThumbnail preset={preset} />);
  expect(view.container.querySelector("img")?.getAttribute("src")).toBe(
    "/brochure-presets/black-friday/thumbnail.webp",
  );
});

it("shows the two source cover offers instead of generic sample products in View details", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const settings = resolveSettings(null);
  const preset = availableBrochurePresets(settings).find(
    (item) => item.id === "neptun-black-friday",
  )!;
  const view = render(
    <BrochurePresetPreview
      preset={preset}
      settings={settings}
      onClose={() => {}}
    />,
  );
  expect(view.container.querySelectorAll(".bf-product-frame")).toHaveLength(2);
});
