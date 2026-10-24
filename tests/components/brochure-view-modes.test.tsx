import React from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrochureEditor } from "../../src/features/studio/Studio";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { Campaign } from "../../src/domain/models";
const campaign: Campaign = {
  id: "view-modes",
  name: "Sample brochure",
  products: [],
  reviewComments: [
    {
      id: "thread",
      pageIndex: 0,
      pageLabel: "Cover",
      text: "Please adjust the cover.",
      authorEmail: "pm@example.test",
      position: { x: 40, y: 40 },
      createdAt: "2026-10-15T10:00:00Z",
      fixed: false,
      replies: [],
    },
  ],
};
const props = {
  campaign,
  settings: { stores: [], contact: {} },
  user: {
    id: "staff",
    email: "staff@example.test",
    role: "staff",
    permissions: "editor",
    organizationId: "organization",
    mustChangePassword: false,
  },
  members: [],
  onUpdate: vi.fn(),
  onToast: vi.fn(),
  onReviewAction: vi.fn(async () => true),
  onAiReview: vi.fn(),
  onReCut: vi.fn(),
  onPrint: vi.fn(),
  onExport: vi.fn(),
  onAddProducts: vi.fn(),
  onImportProducts: vi.fn(),
  onEditImage: vi.fn(),
  onEditScreen: vi.fn(),
  onEditDetails: vi.fn(),
  onEditPrice: vi.fn(),
  onEditSavings: vi.fn(),
  onMakeSocial: vi.fn(),
} as unknown as React.ComponentProps<typeof BrochureEditor>;
beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("switches between editing, a clean preview and a dedicated comment view", () => {
  const view = render(<BrochureEditor {...props} />);
  const modes = within(view.getByRole("group", { name: "Brochure view" }));
  expect(
    modes
      .getByRole("button", { name: "Edit brochure" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(modes.getByRole("button", { name: "Preview only" }));
  expect(
    view.container.querySelector(".cs-page-preview.view-only"),
  ).toBeTruthy();
  expect(view.container.querySelector(".cs-comment-layer")).toBeNull();
  fireEvent.click(modes.getByRole("button", { name: /Comments/ }));
  expect(view.container.querySelector(".cs-comment-layer")).toBeTruthy();
  expect(
    view.getByRole("region", { name: "Page review comments" }),
  ).toBeTruthy();
  fireEvent.click(modes.getByRole("button", { name: "Preview only" }));
  expect(view.container.querySelector(".cs-comment-layer")).toBeNull();
  expect(
    view.queryByRole("region", { name: "Page review comments" }),
  ).toBeNull();
  expect(props.onUpdate).not.toHaveBeenCalled();
});
it("returns from the full-screen preview to editing using its visible button or Escape", () => {
  const view = render(<BrochureEditor {...props} />);
  const modes = within(view.getByRole("group", { name: "Brochure view" }));
  fireEvent.click(modes.getByRole("button", { name: "Preview only" }));
  fireEvent.click(view.getByRole("button", { name: "Back to editing" }));
  expect(
    view.container.querySelector(".cs-page-preview.edit-view"),
  ).toBeTruthy();
  expect(document.activeElement).toBe(
    modes.getByRole("button", { name: "Edit brochure" }),
  );
  fireEvent.click(modes.getByRole("button", { name: "Preview only" }));
  fireEvent(
    view.getByRole("dialog", { name: "Brochure preview" }),
    new Event("cancel", { bubbles: true, cancelable: true }),
  );
  expect(
    view.container.querySelector(".cs-page-preview.edit-view"),
  ).toBeTruthy();
  expect(props.onUpdate).not.toHaveBeenCalled();
});
it("opens the notification thread in comment mode on the intended brochure page", () => {
  const view = render(
    <BrochureEditor
      {...props}
      notificationTarget={{
        id: "notification",
        campaignId: campaign.id,
        pageIndex: 0,
        commentId: "thread",
      }}
    />,
  );
  expect(
    within(view.getByRole("group", { name: "Brochure view" }))
      .getByRole("button", { name: /Comments/ })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(view.container.querySelector(".cs-comment-popover")).toBeTruthy();
  expect(
    view.getByRole("region", { name: "Page review comments" }),
  ).toBeTruthy();
  expect(props.onUpdate).not.toHaveBeenCalled();
});
