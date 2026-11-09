import React, { useState } from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrochureDesignSwitcher } from "../../src/features/brochure/BrochureDesignSwitcher";
import { availableBrochurePresets } from "../../src/features/brochure/brochurePresets";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  setLanguage("sq");
});
const settings = resolveSettings(null);
const presets = availableBrochurePresets(settings);
function setup(apply: React.ComponentProps<typeof BrochureDesignSwitcher>["onApply"]) {
  function Editor() {
    const [open, setOpen] = useState(false);
    return (
      <BrochureDesignSwitcher
        campaign={{
          id: "saved",
          name: "Saved",
          products: [],
          brochurePresetId: presets[0]!.id,
        }}
        settings={settings}
        onApply={apply}
        open={open}
        onOpenChange={setOpen}
      />
    );
  }
  return render(<Editor />);
}

it("offers a top-level design choice and shows a non-dismissable loading state during application", async () => {
  let resolve!: () => void;
  const apply = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const view = setup(apply);
  fireEvent.click(view.getByRole("button", { name: "Change design" }));
  expect(
    view.getByRole("dialog", { name: "Choose a brochure design" }),
  ).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: presets[1]!.name }));
  fireEvent.click(view.getByRole("button", { name: "Apply design" }));
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({ id: presets[1]!.id }),
  );
  const applying = view.getByRole("button", {
    name: "Applying design…",
  }) as HTMLButtonElement;
  expect(applying.disabled).toBe(true);
  expect(
    view.container.querySelector("fieldset")?.getAttribute("aria-busy"),
  ).toBe("true");
  expect(
    view.getByRole("button", { name: presets[0]!.name }).matches(":disabled"),
  ).toBe(true);
  fireEvent.click(view.getByRole("button", { name: "Close" }));
  expect(
    view.getByRole("dialog", { name: "Choose a brochure design" }),
  ).toBeTruthy();
  resolve();
  await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
});

it("keeps a failed selection reviewable and allows a deliberate retry", async () => {
  const apply = vi
    .fn()
    .mockRejectedValueOnce(new Error("Save failed"))
    .mockResolvedValueOnce(undefined);
  const view = setup(apply);
  fireEvent.click(view.getByRole("button", { name: "Change design" }));
  fireEvent.click(view.getByRole("button", { name: presets[2]!.name }));
  fireEvent.click(view.getByRole("button", { name: "Apply design" }));
  expect(await view.findByRole("alert")).toBeTruthy();
  expect(
    view
      .getByRole("button", { name: presets[2]!.name })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(view.getByRole("button", { name: "Apply design" }));
  await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
  expect(apply).toHaveBeenCalledTimes(2);
});

it("does not carry a canceled choice into the next opening", () => {
  const view = setup(vi.fn());
  fireEvent.click(view.getByRole("button", { name: "Change design" }));
  fireEvent.click(view.getByRole("button", { name: presets[2]!.name }));
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  fireEvent.click(view.getByRole("button", { name: "Change design" }));
  expect(
    view
      .getByRole("button", { name: presets[0]!.name })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    view
      .getByRole("button", { name: presets[2]!.name })
      .getAttribute("aria-pressed"),
  ).toBe("false");
});
