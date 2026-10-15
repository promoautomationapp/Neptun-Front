import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SettingsEditor } from "../../src/features/settings/SettingsEditor";
import {
  resolveSettings,
  type WorkspaceSettings,
} from "../../src/features/settings/settings.schema";
import { CoverPage } from "../../src/features/brochure/Brochure";
import { campaignDefaults } from "../../src/features/settings/campaign-defaults";
import type { Campaign } from "../../src/domain/models";
afterEach(cleanup);
it("keeps advanced groups closed, previews logo defaults live, saves color rules and preserves library images", async () => {
  const settings = resolveSettings(null),
    asset = "/api/assets/00000000-0000-4000-8000-000000000001";
  settings.logoLibrary = [{ id: "one", name: "Blue logo", url: asset }];
  const save = vi.fn(async (value: WorkspaceSettings) => value);
  const view = render(<SettingsEditor initial={settings} onSave={save} />);
  fireEvent.click(view.getByRole("tab", { name: "Logos & icons" }));
  expect(
    [
      ...view.container.querySelectorAll<HTMLDetailsElement>(
        "details.ns-settings-group",
      ),
    ].every((group) => !group.open),
  ).toBe(true);
  const card = view.getByLabelText("Logo name: Blue logo").closest("article")!;
  fireEvent.click(within(card).getByRole("button", { name: "Use for covers" }));
  const preview = view.getByLabelText("Settings preview");
  await waitFor(() =>
    expect(
      preview.querySelector(".cover-element-logo img")?.getAttribute("src"),
    ).toBe(asset),
  );
  fireEvent.click(
    within(card).getByRole("button", { name: "Use inside pages" }),
  );
  await waitFor(() =>
    expect(
      within(preview)
        .getByRole("button", { name: "Product page" })
        .getAttribute("aria-pressed"),
    ).toBe("true"),
  );
  expect(
    preview.querySelector(".neptun-wordmark img")?.getAttribute("src"),
  ).toBe(asset);
  fireEvent.click(
    view.getByText("Choose logos for background colors", {
      selector: "summary",
    }),
  );
  fireEvent.click(view.getByRole("button", { name: "+ Add color rule" }));
  fireEvent.change(view.getByLabelText("Logo rule 1 background"), {
    target: { value: "color" },
  });
  fireEvent.change(view.getByLabelText("Logo rule 1 color"), {
    target: { value: "#112233" },
  });
  fireEvent.change(view.getByLabelText("Logo rule 1 image"), {
    target: { value: asset },
  });
  fireEvent.click(view.getByRole("button", { name: "Save settings" }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0]![0]).toMatchObject({
    logoRules: [{ background: "color", color: "#112233", image: asset }],
    logoLibrary: [{ url: asset }],
  });
});
it("renders a selected color logo on the cover and keeps manually selected brochure logos authoritative", () => {
  const settings = resolveSettings(null),
    asset = "/api/assets/00000000-0000-4000-8000-000000000002";
  settings.logoRules = [
    {
      id: "light",
      target: "both",
      background: "light",
      color: "",
      image: asset,
      enabled: true,
    },
  ];
  settings.brochure.coverBackground.color = "#ffffff";
  const campaign = {
    ...campaignDefaults(settings),
    id: "1",
    name: "Campaign",
    products: [],
  } as Campaign;
  const view = render(<CoverPage campaign={campaign} />);
  expect(
    view.container
      .querySelector(".cover-element-logo img")
      ?.getAttribute("src"),
  ).toBe(asset);
  view.rerender(
    <CoverPage
      campaign={{
        ...campaign,
        coverLogoSource: "/api/assets/legacy/assets/manual.png",
      }}
    />,
  );
  expect(
    view.container
      .querySelector(".cover-element-logo img")
      ?.getAttribute("src"),
  ).toBe("/api/assets/legacy/assets/manual.png");
});
