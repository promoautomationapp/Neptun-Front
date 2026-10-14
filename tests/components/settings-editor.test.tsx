import type * as ApiClient from "../../src/api/client";
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsEditor } from "../../src/features/settings/SettingsEditor";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import type { WorkspaceSettings } from "../../src/features/settings/settings.schema";
vi.mock("../../src/api/client", async (original) => ({
  ...(await original<typeof ApiClient>()),
  uploadImage: vi.fn(),
}));
import { uploadImage } from "../../src/api/client";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("manages formats, stores, category rules and campaign types in one saved draft", async () => {
  const save = vi
    .fn<(value: WorkspaceSettings) => Promise<WorkspaceSettings>>()
    .mockImplementation(async (value) => value);
  const view = render(
    <SettingsEditor
      initial={resolveSettings(null)}
      onSave={save}
      facets={[{ category: "TV", subcategory: "OLED" }]}
    />,
  );
  fireEvent.click(view.getByRole("tab", { name: "Stores & contacts" }));
  fireEvent.click(view.getByRole("checkbox", { name: "Show store phone" }));
  fireEvent.click(
    view.getByRole("checkbox", { name: "Show Central Park in new brochures" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Move Royal Mall up" }));
  fireEvent.click(view.getByRole("tab", { name: "Format & layout" }));
  fireEvent.change(view.getByLabelText("Default brochure format"), {
    target: { value: "a4" },
  });
  fireEvent.click(view.getByRole("tab", { name: "Category defaults" }));
  fireEvent.change(view.getByLabelText("TV savings default"), {
    target: { value: "percentage" },
  });
  fireEvent.click(view.getByRole("tab", { name: "Campaign types" }));
  fireEvent.click(
    view.getByRole("checkbox", {
      name: "Show Black Friday when creating brochures",
    }),
  );
  fireEvent.click(
    view.getByRole("button", { name: "Delete campaign type Happy Hour" }),
  );
  fireEvent.click(view.getByRole("button", { name: "+ Add campaign type" }));
  fireEvent.change(view.getByLabelText("New campaign type type name"), {
    target: { value: "Weekend offers" },
  });
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const settings = save.mock.calls[0]?.[0];
  expect(settings?.brochure.format).toBe("a4");
  expect(settings?.brochure.storeFields.phone).toBe(false);
  expect(settings?.stores[0]?.visible).toBe(false);
  expect(settings?.stores[1]?.name).toBe("Royal Mall");
  expect(settings?.categoryPathSavingModes.TV).toBe("percentage");
  expect(
    settings?.campaignTypes.some((item) => item.name === "Happy Hour"),
  ).toBe(false);
  expect(
    settings?.campaignTypes.some((item) => item.name === "Weekend offers"),
  ).toBe(true);
  await waitFor(() =>
    expect(
      view.getByText("Settings saved. New brochures will use these defaults."),
    ).toBeTruthy(),
  );
});
it("keeps the draft on failed saves and allows deliberate discard", async () => {
  const save = vi
    .fn()
    .mockRejectedValue(
      new Error("Someone else updated Settings. Reload before saving."),
    );
  const view = render(
    <SettingsEditor initial={resolveSettings(null)} onSave={save} />,
  );
  fireEvent.change(view.getByLabelText("Cover background color"), {
    target: { value: "#112233" },
  });
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toContain(
      "Someone else updated",
    ),
  );
  expect(
    (view.getByLabelText("Cover background color") as HTMLInputElement).value,
  ).toBe("#112233");
  fireEvent.click(view.getByRole("button", { name: "Discard changes" }));
  expect(
    (view.getByLabelText("Cover background color") as HTMLInputElement).value,
  ).toBe("#1c4075");
});
it("uploads a private logo, blocks saving during upload and uses it as the cover default", async () => {
  let complete: (url: string) => void = () => {};
  vi.mocked(uploadImage).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const save = vi
    .fn<(value: WorkspaceSettings) => Promise<WorkspaceSettings>>()
    .mockImplementation(async (value) => value);
  const view = render(
    <SettingsEditor initial={resolveSettings(null)} onSave={save} />,
  );
  fireEvent.click(view.getByRole("tab", { name: "Logos & icons" }));
  const file = new File(["image"], "New logo.png", { type: "image/png" });
  fireEvent.change(view.getByLabelText("Upload Cover logo"), {
    target: { files: [file] },
  });
  expect(
    (view.getByRole("button", { name: "Save settings" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  const url = "/api/assets/12345678-1234-4234-8234-123456789012";
  complete(url);
  await waitFor(() =>
    expect(
      (view.getByRole("button", { name: "Save settings" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]?.[0].brochure).toMatchObject({
    coverLogoStyle: "custom",
    coverLogoSource: url,
  });
  expect(save.mock.calls[0]?.[0].logoLibrary[0]?.name).toBe("New logo.png");
});
it("supports keyboard tab navigation and rejects duplicate campaign type names", () => {
  const save = vi.fn();
  const view = render(
    <SettingsEditor initial={resolveSettings(null)} onSave={save} />,
  );
  fireEvent.keyDown(view.getByRole("tab", { name: "Cover & colors" }), {
    key: "End",
  });
  expect(
    view
      .getByRole("tab", { name: "Campaign types" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.change(view.getByLabelText("Happy Hour type name"), {
    target: { value: "Black Friday" },
  });
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  expect(save).not.toHaveBeenCalled();
  expect(view.getByRole("alert").textContent).toContain("unique");
});
