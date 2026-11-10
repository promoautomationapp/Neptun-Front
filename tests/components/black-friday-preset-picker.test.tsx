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

it("uses a schematic Black Friday design choice without real products or prices", () => {
  const preset = availableBrochurePresets(resolveSettings(null)).find(
    (item) => item.id === "neptun-black-friday",
  )!;
  const view = render(<PresetThumbnail preset={preset} />);
  const image = view.container.querySelector("img")?.getAttribute("src") || "";
  expect(image).toMatch(/^data:image\/svg\+xml,/);
  const svg = decodeURIComponent(image.split(",")[1]!);
  expect(svg).toContain("BLACK FRIDAY");
  expect(svg).toContain("<rect");
  expect(svg).not.toContain("<image");
  expect(svg).not.toContain("thumbnail.webp");
  expect(svg).not.toMatch(/€|399|749|65UA74003LB/);
});

it("uses the same generic demo products as other designs in View details", () => {
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
  expect(view.container.querySelectorAll(".bf-product-frame")).toHaveLength(3);
  expect(view.container.textContent).toContain("TV LED · Sample product");
  expect(view.container.textContent).not.toContain("TV LED 65UA74003LB");
  expect(view.container.textContent).not.toContain("BM1WFSU39223WA");
});
