import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BlackFridayPersonChoice } from "../../src/features/brochure/BlackFridayPersonChoice";
import { BrochurePresetPicker } from "../../src/features/brochure/BrochurePresetPicker";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { BrochurePreset } from "../../src/features/brochure/brochurePresets";

vi.mock("../../src/features/brochure/ImagePickerProvider", () => ({
  useImagePicker: () => (request: { onSelect: (image: string) => void }) =>
    request.onSelect("/replacement.webp"),
}));
afterEach(() => {
  cleanup();
  setLanguage("sq");
});
const preset: BrochurePreset = {
  id: "neptun-black-friday",
  name: "Black Friday",
  design: {
    pageArtworks: {
      cover: [
        {
          id: "person",
          type: "image",
          image: "/forex.webp",
          referenceSource: "Forex.png",
          x: 2,
          y: 20,
          width: 50,
        },
      ],
    },
  },
} as BrochurePreset;

it("asks for the person choice before selecting Black Friday", () => {
  setLanguage("en");
  const select = vi.fn();
  const view = render(
    <BrochurePresetPicker
      presets={[preset]}
      value=""
      onChange={select}
      onPreview={vi.fn()}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Black Friday" }));
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("radio", { name: /No person/ }));
  fireEvent.click(view.getByRole("button", { name: "Use this design" }));
  expect(select.mock.calls[0]?.[0].design.pageArtworks.cover).toEqual([]);
});

it("uses the image picker to replace the person and preserves its frame", () => {
  setLanguage("en");
  const select = vi.fn();
  const view = render(
    <BlackFridayPersonChoice
      preset={preset}
      onSelect={select}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(view.getByRole("radio", { name: /Upload replacement/ }));
  fireEvent.click(view.getByRole("button", { name: "Use this design" }));
  expect(select.mock.calls[0]?.[0].design.pageArtworks.cover[0]).toMatchObject({
    image: "/replacement.webp",
    x: 2,
    y: 20,
    width: 50,
    referenceSource: "Forex.png",
  });
});

it("explains the flattened closing promotional photo when choosing no person", () => {
  setLanguage("en");
  const closing = structuredClone(preset);
  closing.design.pageArtworks!.stores = [
    {
      id: "closing-poster",
      type: "image",
      image: "/closing.webp",
      referenceSource: "ChatGPT Image Nov 18, 2025, 02_11_04 PM3.png",
      x: 0,
      y: 0,
      width: 100,
    },
  ];
  const view = render(
    <BlackFridayPersonChoice
      preset={closing}
      onSelect={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(view.getByRole("radio", { name: /No person/ }));
  expect(view.getByText(/The closing promotional photo includes/)).toBeTruthy();
});
