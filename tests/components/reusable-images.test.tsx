import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  REUSABLE_IMAGE_TYPE,
  ReusableImages,
  droppedReusableImage,
  reusableImages,
} from "../../src/features/settings/ReusableImages";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { logoRuleDefaults } from "../../src/features/settings/logoLibraryData";
const image = "/api/assets/00000000-0000-4000-8000-000000000111";
afterEach(cleanup);
it("offers saved campaign logos and hides only removed built-ins while deduplicating by source", () => {
  const settings = resolveSettings(null);
  settings.hiddenBuiltinLogos = [logoRuleDefaults[0]!.id];
  settings.logoLibrary = [{ id: "shared", name: "Saved mark", url: image }];
  settings.campaignTypes[0]!.logo = image;
  const choices = reusableImages(settings);
  expect(choices.some((asset) => asset.id === logoRuleDefaults[0]!.id)).toBe(
    false,
  );
  expect(choices.filter((asset) => asset.url === image)).toHaveLength(1);
  expect(choices.find((asset) => asset.url === image)?.name).toBe(
    `${settings.campaignTypes[0]!.name} logo`,
  );
  expect(settings.logoLibrary).toEqual([
    { id: "shared", name: "Saved mark", url: image },
  ]);
});
it("adds a saved image without uploading or regenerating it and supplies the same trusted source on drag", () => {
  const settings = resolveSettings(null);
  settings.logoLibrary = [
    { id: "saved", name: "Reusable campaign mark", url: image },
  ];
  const add = vi.fn(),
    setData = vi.fn();
  const view = render(<ReusableImages settings={settings} onAdd={add} />);
  const button = view.getByRole("button", {
    name: "Add saved image: Reusable campaign mark",
    hidden: true,
  });
  fireEvent.click(view.getByText(/Choose a saved logo or image/));
  fireEvent.click(button);
  expect(add).toHaveBeenCalledWith(settings.logoLibrary[0]);
  const dataTransfer = { setData, effectAllowed: "none" };
  fireEvent.dragStart(button, { dataTransfer });
  expect(dataTransfer.effectAllowed).toBe("copy");
  expect(setData).toHaveBeenCalledWith(
    REUSABLE_IMAGE_TYPE,
    JSON.stringify(settings.logoLibrary[0]),
  );
  expect(button.querySelector("img")?.getAttribute("src")).toContain(image);
});
it("accepts authenticated saved assets on drop, gives each addition a new identity, and rejects external or malformed data", () => {
  const transfer = (value: string) =>
    ({ getData: vi.fn(() => value) }) as unknown as DataTransfer;
  const data = JSON.stringify({
    id: "original",
    name: "Saved image",
    url: image,
  });
  const first = droppedReusableImage(transfer(data));
  const second = droppedReusableImage(transfer(data));
  expect(first).toMatchObject({ name: "Saved image", url: image });
  expect(first?.id).not.toBe("original");
  expect(second?.id).not.toBe(first?.id);
  for (const value of [
    "",
    "broken JSON",
    "null",
    JSON.stringify({
      name: "External",
      url: "https://outside.example/image.png",
    }),
    JSON.stringify({ name: "Query", url: `${image}?token=secret` }),
    JSON.stringify({ name: "Invalid", url: "javascript:alert(1)" }),
  ])
    expect(droppedReusableImage(transfer(value))).toBeNull();
});
