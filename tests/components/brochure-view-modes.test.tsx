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
  const modes = within(view.container.querySelector(".cs-canvas-dock")!);
  expect(
    modes.getByRole("button", { name: "Pointer" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(modes.getByRole("button", { name: /Comment anywhere/ }));
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
  const modes = within(view.container.querySelector(".cs-canvas-dock")!);
  fireEvent.click(modes.getByRole("button", { name: "Open full preview" }));
  fireEvent.click(view.getByRole("button", { name: "Back to editing" }));
  expect(
    view.container.querySelector(".cs-page-preview.edit-view"),
  ).toBeTruthy();
  expect(document.activeElement).toBe(
    modes.getByRole("button", { name: "Open full preview" }),
  );
  fireEvent.click(modes.getByRole("button", { name: "Open full preview" }));
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
    within(view.getByRole("toolbar", { name: "Canvas tools" }))
      .getByRole("button", { name: /Comment anywhere/ })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(view.container.querySelector(".cs-comment-popover")).toBeTruthy();
  expect(
    view.getByRole("region", { name: "Page review comments" }),
  ).toBeTruthy();
  expect(props.onUpdate).not.toHaveBeenCalled();
});

it("previews in place without opening a dialog or editing the document and returns with Escape", () => {
  const view = render(<BrochureEditor {...props} />);
  const paper = view.container.querySelector(".cs-preview-paper");
  const toolbar = within(view.container.querySelector(".cs-canvas-dock")!);
  fireEvent.click(toolbar.getByRole("button", { name: "Preview only" }));
  expect(view.queryByRole("dialog", { name: "Brochure preview" })).toBeNull();
  expect(
    view.container.querySelector(".cs-page-preview.inline-preview.view-only"),
  ).toBeTruthy();
  expect(view.container.querySelector(".cs-preview-paper")).toBe(paper);
  expect(paper?.querySelector('[contenteditable="true"]')).toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(
    view.container.querySelector(".cs-page-preview.edit-view"),
  ).toBeTruthy();
  expect(
    toolbar
      .getByRole("button", { name: "Preview only" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
  expect(props.onUpdate).not.toHaveBeenCalled();
});

it("zooms and fits the selected page without editing the campaign or resetting canvas scroll", () => {
  const view = render(
    <BrochureEditor
      {...props}
      campaign={{
        ...campaign,
        products: [
          { code: "cover", name: "Cover offer", brochurePage: 1 },
          { code: "inside", name: "Interior offer", brochurePage: 2 },
        ],
      }}
    />,
  );
  const picker = view.getByRole("combobox", { name: "Go to page" });
  fireEvent.change(picker, { target: { value: "0" } });
  const zoom = within(view.getByRole("group", { name: "Brochure zoom" }));
  const viewport = view.container.querySelector<HTMLElement>(
    ".cs-preview-viewport",
  )!;
  const paper = view.container.querySelector<HTMLElement>(".cs-preview-paper")!;
  const pagePreview =
    view.container.querySelector<HTMLElement>(".cs-page-preview")!;
  viewport.scrollLeft = 19;
  viewport.scrollTop = 37;
  fireEvent.click(zoom.getByRole("button", { name: "Zoom in" }));
  expect(zoom.getByRole("status").textContent).toBe("125%");
  expect(pagePreview.style.getPropertyValue("--brochure-preview-zoom")).toBe(
    "1.25",
  );
  expect([viewport.scrollLeft, viewport.scrollTop]).toEqual([19, 37]);
  expect((picker as HTMLSelectElement).value).toBe("0");
  fireEvent.click(zoom.getByRole("button", { name: "Zoom out" }));
  expect(zoom.getByRole("status").textContent).toBe("100%");
  for (let index = 0; index < 3; index++)
    fireEvent.click(zoom.getByRole("button", { name: "Zoom out" }));
  expect(zoom.getByRole("button", { name: "Zoom out" })).toHaveProperty(
    "disabled",
    true,
  );
  Object.defineProperty(viewport, "clientWidth", {
    configurable: true,
    value: 800,
  });
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 80, 800, 600),
  );
  vi.spyOn(paper, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 80, 200, 250),
  );
  fireEvent.click(zoom.getByRole("button", { name: "Fit page" }));
  const expected = Math.round(
    Math.min(
      4,
      (Math.min(
        Math.max(320, window.innerHeight - 150),
        window.innerHeight - 104,
      ) -
        4) /
        250,
    ) * 25,
  );
  expect(zoom.getByRole("status").textContent).toBe(`${expected}%`);
  expect((picker as HTMLSelectElement).value).toBe("0");
  expect(props.onUpdate).not.toHaveBeenCalled();
});

it("shows the toolbar by default and lets its last control hide and restore it without editing", () => {
  const view = render(<BrochureEditor {...props} />);
  const dock = view.container.querySelector<HTMLElement>(".cs-canvas-dock")!;
  const hide = within(dock).getByRole("button", { name: "Hide toolbar" });
  expect(dock.classList.contains("is-collapsed")).toBe(false);
  expect(hide.getAttribute("aria-expanded")).toBe("true");
  expect(dock.lastElementChild).toBe(hide);
  fireEvent.click(hide);
  const show = within(dock).getByRole("button", { name: "Show toolbar" });
  expect(dock.classList.contains("is-collapsed")).toBe(true);
  expect(show.getAttribute("aria-expanded")).toBe("false");
  expect(dock.lastElementChild).toBe(show);
  fireEvent.click(show);
  expect(dock.classList.contains("is-collapsed")).toBe(false);
  expect(
    within(dock)
      .getByRole("button", { name: "Pointer" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(props.onUpdate).not.toHaveBeenCalled();
});
