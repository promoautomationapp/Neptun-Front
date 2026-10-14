import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CampaignReviewCommentsItem } from "../../src/domain/models";
import {
  BrochureComments,
  CommentForm,
  type ReviewParticipant,
} from "../../src/features/brochure/BrochureComments";
import {
  FilterDate,
  FilterSelect,
} from "../../src/features/brochure/FilterControls";
import { setLanguage } from "../../src/features/brochure/i18n";
import { ReviewPanel } from "../../src/features/brochure/ReviewPanel";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const author: ReviewParticipant = { email: "staff@example.com", role: "staff" };
const manager: ReviewParticipant = { email: "manager@example.com", role: "pm" };

it("keeps numeric filter choices and keyboard focus cycling intact", () => {
  const change = vi.fn();
  const view = render(
    <FilterSelect
      label="Product code column"
      value={1}
      options={[
        { value: 0, label: "A · Code" },
        { value: 1, label: "B · Name" },
        { value: 2, label: "C · Price" },
      ]}
      onChange={change}
    />,
  );
  const trigger = view.getByRole("button", { name: "Product code column" });
  trigger.focus();
  fireEvent.click(trigger);
  const options = view.getAllByRole("option");
  const first = options[0];
  const last = options[2];
  if (!first || !last) throw new Error("Expected three column choices");
  fireEvent.keyDown(trigger, { key: "Home" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "ArrowUp" });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(last, { key: "ArrowDown" });
  expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: "End" });
  expect(document.activeElement).toBe(last);
  fireEvent.click(last);
  expect(change).toHaveBeenCalledWith(2);
  expect(document.activeElement).toBe(trigger);
  expect(view.queryByRole("listbox")).toBeNull();
});

it("dismisses filter popovers outside or on Escape without choosing a value", () => {
  const change = vi.fn();
  const view = render(
    <FilterSelect
      label="Status"
      value="all"
      options={[{ value: "all", label: "All statuses" }]}
      onChange={change}
    />,
  );
  const trigger = view.getByRole("button", { name: "Status" });
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(view.queryByRole("listbox")).toBeNull();
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: "Escape" });
  expect(view.queryByRole("listbox")).toBeNull();
  expect(change).not.toHaveBeenCalled();
});

it("keeps calendar limits, ISO selection, clearing and trigger focus intact", () => {
  const change = vi.fn();
  const view = render(
    <FilterDate
      label="Campaign date"
      value="2026-10-16"
      min="2026-10-15"
      max="2026-10-20"
      onChange={change}
    />,
  );
  const trigger = view.getByRole("button", { name: "Campaign date" });
  expect(trigger.textContent).toContain("16 Oct 2026");
  fireEvent.click(trigger);
  expect(
    view.getByRole("button", { name: "14 Oct 2026" }).hasAttribute("disabled"),
  ).toBe(true);
  expect(
    view.getByRole("button", { name: "21 Oct 2026" }).hasAttribute("disabled"),
  ).toBe(true);
  fireEvent.click(view.getByRole("button", { name: "19 Oct 2026" }));
  expect(change).toHaveBeenCalledWith("2026-10-19");
  expect(document.activeElement).toBe(trigger);
  expect(view.queryByRole("dialog")).toBeNull();
  fireEvent.click(trigger);
  fireEvent.click(view.getByRole("button", { name: "Clear date" }));
  expect(change).toHaveBeenLastCalledWith("");
});

it("preserves a rejected comment draft and clears only after a successful save", async () => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const view = render(
    <CommentForm
      label="Your comment"
      members={[author, manager]}
      user={author}
      busy={false}
      onSave={save}
    />,
  );
  expect(view.queryByRole("option", { name: /staff@example.com/ })).toBeNull();
  const text = view.getByRole("textbox", { name: "Your comment" });
  const mention = view.getByRole("combobox", { name: "Mention a teammate" });
  fireEvent.change(text, { target: { value: "  Move this label  " } });
  fireEvent.change(mention, { target: { value: manager.email } });
  fireEvent.click(view.getByRole("button", { name: "Post comment" }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenLastCalledWith("Move this label", manager.email);
  expect(text).toHaveProperty("value", "  Move this label  ");
  fireEvent.click(view.getByRole("button", { name: "Post comment" }));
  await waitFor(() => expect(text).toHaveProperty("value", ""));
  expect(mention.querySelector("option:checked")?.getAttribute("value")).toBe(
    "",
  );
});

it("keeps comment page anchors, thread replies and resolution actions intact", async () => {
  const comment: CampaignReviewCommentsItem = {
    id: "comment-1",
    pageIndex: 2,
    position: { x: 70, y: 80 },
    authorEmail: manager.email,
    text: "Check the title",
    createdAt: "2026-10-08T08:00:00Z",
    replies: [
      {
        id: "reply-1",
        text: "I will check it",
        authorEmail: author.email,
        createdAt: "2026-10-08T09:00:00Z",
      },
    ],
  };
  const action = vi.fn().mockResolvedValue(true);
  const view = render(
    <BrochureComments
      campaign={{
        reviewComments: [comment, { id: "unpositioned", pageIndex: 3 }],
        reviewPagePlacements: { "comment-1": 3 },
      }}
      pageIndex={3}
      pageLabel="Page 3"
      members={[author, manager]}
      user={author}
      onAction={action}
    />,
  );
  const pin = view.getByRole("button", { name: "Comment 1: Check the title" });
  expect(pin.getAttribute("style")).toContain("left: 70%");
  fireEvent.click(pin);
  expect(view.getByText("I will check it")).toBeTruthy();
  const popover = view.container.querySelector<HTMLElement>(
    ".cs-comment-popover",
  );
  expect(popover?.style.right).toBe("30%");
  expect(popover?.style.bottom).toBe("20%");
  fireEvent.change(view.getByRole("textbox", { name: "Write a reply" }), {
    target: { value: "Title checked" },
  });
  fireEvent.click(view.getByRole("button", { name: "Post reply" }));
  await waitFor(() =>
    expect(action).toHaveBeenCalledWith("reply", {
      commentId: "comment-1",
      text: "Title checked",
      mention: "",
    }),
  );
  await waitFor(() =>
    expect(
      view
        .getByRole("button", { name: /Mark resolved/ })
        .hasAttribute("disabled"),
    ).toBe(false),
  );
  fireEvent.click(view.getByRole("button", { name: /Mark resolved/ }));
  await waitFor(() =>
    expect(action).toHaveBeenCalledWith("fix", { commentId: "comment-1" }),
  );
  expect(comment.pageIndex).toBe(2);
  expect(comment.fixed).toBeUndefined();
});

it("saves an anchored draft with clamped percentage coordinates", async () => {
  const action = vi.fn().mockResolvedValue(true);
  const view = render(
    <BrochureComments
      campaign={{}}
      pageIndex={1}
      pageLabel="Cover"
      members={[author]}
      user={author}
      onAction={action}
    />,
  );
  const layer = view.getByLabelText("Brochure comments");
  vi.spyOn(layer, "getBoundingClientRect").mockReturnValue(
    new DOMRect(10, 20, 200, 100),
  );
  fireEvent.click(layer, { clientX: 300, clientY: 10 });
  fireEvent.change(view.getByRole("textbox", { name: "Your comment" }), {
    target: { value: "Check this corner" },
  });
  fireEvent.click(view.getByRole("button", { name: "Post comment" }));
  await waitFor(() =>
    expect(action).toHaveBeenCalledWith("comment", {
      pageIndex: 1,
      pageLabel: "Cover",
      position: { x: 99, y: 1 },
      text: "Check this corner",
      mention: "",
    }),
  );
  await waitFor(() => expect(view.queryByRole("textbox")).toBeNull());
});

it("keeps page review comments, role controls and plain page-comment payloads intact", async () => {
  const action = vi.fn().mockResolvedValue(true);
  const campaign = {
    status: "changes_requested",
    reviewComments: [
      { id: "legacy-comment", pageIndex: 1, text: "Review this page" },
      {
        id: "fixed-comment",
        pageIndex: 1,
        fixed: true,
        text: "Already checked",
      },
    ],
  };
  const view = render(
    <ReviewPanel
      campaign={campaign}
      pageIndex={1}
      pageLabel="Cover"
      user={author}
      onAction={action}
    />,
  );
  expect(view.getAllByText("Invalid Date")).toHaveLength(2);
  expect(view.getAllByRole("button", { name: "Mark resolved" })).toHaveLength(
    1,
  );
  expect(view.getByText("1 comments still need fixing.")).toBeTruthy();
  const text = view.getByRole("textbox", {
    name: "Add a comment for this page",
  });
  fireEvent.change(text, { target: { value: "  New page comment  " } });
  fireEvent.click(view.getByRole("button", { name: "Add comment" }));
  await waitFor(() =>
    expect(action).toHaveBeenCalledWith("comment", {
      pageIndex: 1,
      pageLabel: "Cover",
      text: "New page comment",
    }),
  );
  await waitFor(() => expect(text).toHaveProperty("value", ""));
  view.rerender(
    <ReviewPanel
      campaign={campaign}
      pageIndex={1}
      pageLabel="Cover"
      user={manager}
      onAction={action}
    />,
  );
  expect(view.queryByRole("button", { name: "Mark resolved" })).toBeNull();
  expect(view.queryByText("1 comments still need fixing.")).toBeNull();
  expect(campaign.reviewComments[0]?.pageIndex).toBe(1);
  expect(campaign.reviewComments[0]).not.toHaveProperty("fixed");
});
