import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  CommentForm,
  BrochureComments,
  type ReviewParticipant,
} from "../../src/features/brochure/BrochureComments";
import { ReviewPanel } from "../../src/features/brochure/ReviewPanel";
import { setLanguage } from "../../src/features/brochure/i18n";
const user: ReviewParticipant = {
  email: "author@example.test",
  role: "staff",
  name: "Current Staff",
};
const members: ReviewParticipant[] = [
  user,
  {
    email: "arta.pm@example.test",
    role: "pm",
    name: "Arta Krasniqi",
    username: "arta.pm",
    status: "active",
  },
  {
    email: "arta.admin@example.test",
    role: "admin",
    name: "Arta Krasniqi",
    status: "active",
  },
  { email: "support@example.test", role: "superadmin", name: "Support" },
  { email: "disabled@example.test", role: "pm", status: "disabled" },
  { email: "invited@example.test", role: "staff", status: "invited" },
  { email: "hidden@example.test", role: "admin", isSupport: true },
];
beforeEach(() => setLanguage("en"));
afterEach(() => cleanup());
it("searches full names with varied case/spacing and sends only the explicitly selected canonical email", async () => {
  const save = vi.fn().mockResolvedValue(true);
  const view = render(
    <CommentForm
      label="Comment"
      members={members}
      user={user}
      busy={false}
      onSave={save}
    />,
  );
  const text = view.getByRole("textbox", { name: "Comment" });
  fireEvent.change(text, { target: { value: "Please review @aRtAkRaSniQi" } });
  expect(view.getAllByRole("option")).toHaveLength(2);
  fireEvent.click(
    view.getByRole("option", { name: /arta.admin@example.test/ }),
  );
  fireEvent.click(view.getByRole("button", { name: "Post comment" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      "Please review @arta.admin@example.test",
      "arta.admin@example.test",
      ["arta.admin@example.test"],
    ),
  );
  await waitFor(() => expect(text).toHaveProperty("value", ""));
  expect(view.queryByRole("button", { name: "Remove mention" })).toBeNull();
});
it("excludes self, support, disabled and invited members even if supplied by the caller", () => {
  const view = render(
    <CommentForm
      label="Comment"
      members={members}
      user={user}
      busy={false}
      onSave={vi.fn()}
    />,
  );
  fireEvent.change(view.getByRole("textbox"), { target: { value: "@" } });
  expect(view.getAllByRole("option")).toHaveLength(2);
  expect(
    view.queryByRole("option", {
      name: /support|disabled|invited|hidden|author/,
    }),
  ).toBeNull();
});
it("searches usernames and full email addresses, selects with the keyboard, and clears mention when removed", () => {
  const view = render(
    <CommentForm
      label="Comment"
      members={members}
      user={user}
      busy={false}
      onSave={vi.fn()}
    />,
  );
  const text = view.getByRole("textbox");
  fireEvent.change(text, { target: { value: "Check @ARTA.PM@EXAMPLE.TEST" } });
  expect(view.getAllByRole("option")).toHaveLength(1);
  fireEvent.keyDown(text, { key: "Enter" });
  expect(view.getByText("@Arta Krasniqi")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Remove mention" }));
  expect(view.queryByText("@Arta Krasniqi")).toBeNull();
  expect(text).toHaveProperty("value", "Check  ");
  fireEvent.change(text, { target: { value: "@arta.pm" } });
  expect(view.getAllByRole("option")).toHaveLength(1);
});
it("Escape dismisses only the mention picker and leaves the comment draft intact", () => {
  const escape = vi.fn();
  const view = render(
    <div onKeyDown={escape}>
      <CommentForm
        label="Comment"
        members={members}
        user={user}
        busy={false}
        onSave={vi.fn()}
      />
    </div>,
  );
  const text = view.getByRole("textbox");
  fireEvent.change(text, { target: { value: "Review @Arta" } });
  fireEvent.keyDown(text, { key: "Escape" });
  expect(view.queryByRole("listbox")).toBeNull();
  expect(text).toHaveProperty("value", "Review @Arta");
  expect(escape).not.toHaveBeenCalled();
});
it("keeps a selected mention and draft after a rejected save, and blocks blank/duplicate submissions", async () => {
  let reject: (reason: Error) => void = () => {};
  const save = vi.fn(
    () =>
      new Promise<boolean>((_, fail) => {
        reject = fail;
      }),
  );
  const view = render(
    <CommentForm
      label="Comment"
      members={members}
      user={user}
      busy={false}
      onSave={save}
    />,
  );
  const text = view.getByRole("textbox");
  fireEvent.change(text, { target: { value: "   " } });
  fireEvent.submit(
    view.getByRole("button", { name: "Post comment" }).closest("form")!,
  );
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(text, { target: { value: "Check @arta.pm" } });
  fireEvent.keyDown(text, { key: "Enter" });
  fireEvent.click(view.getByRole("button", { name: "Post comment" }));
  fireEvent.submit(
    view.getByRole("button", { name: "Saving…" }).closest("form")!,
  );
  expect(save).toHaveBeenCalledOnce();
  reject(new Error("offline"));
  await waitFor(() =>
    expect(view.getByRole("alert").textContent).toContain("draft is kept"),
  );
  expect(text).toHaveProperty("value", "Check @arta.pm@example.test ");
  expect(view.getByRole("button", { name: "Remove mention" })).toBeTruthy();
});
it("uses mentions in the page review form and replies", async () => {
  const action = vi.fn().mockResolvedValue(true);
  const view = render(
    <ReviewPanel
      campaign={{
        reviewComments: [
          { id: "one", pageIndex: 1, text: "Review", replies: [] },
        ],
      }}
      pageIndex={1}
      pageLabel="Cover"
      members={members}
      user={user}
      onAction={action}
    />,
  );
  const text = view.getByRole("textbox", {
    name: "Add a comment for this page",
  });
  fireEvent.change(text, { target: { value: "Check @arta.pm" } });
  fireEvent.keyDown(text, { key: "Enter" });
  fireEvent.click(view.getByRole("button", { name: "Add comment" }));
  await waitFor(() =>
    expect(action).toHaveBeenCalledWith("comment", {
      pageIndex: 1,
      pageLabel: "Cover",
      text: "Check @arta.pm@example.test",
      mention: "arta.pm@example.test",
      mentions: ["arta.pm@example.test"],
    }),
  );
  fireEvent.click(view.getByText("Reply"));
  const reply = view.getByRole("textbox", { name: "Write a reply" });
  fireEvent.change(reply, { target: { value: "Thanks @arta.pm" } });
  fireEvent.keyDown(reply, { key: "Enter" });
  fireEvent.click(view.getByRole("button", { name: "Post reply" }));
  await waitFor(() =>
    expect(action).toHaveBeenCalledWith("reply", {
      commentId: "one",
      text: "Thanks @arta.pm@example.test",
      mention: "arta.pm@example.test",
      mentions: ["arta.pm@example.test"],
    }),
  );
});
it("opens a notification-targeted pin and highlights the corresponding page thread", () => {
  const campaign = {
    reviewComments: [
      {
        id: "target",
        pageIndex: 1,
        text: "Target thread",
        position: { x: 30, y: 40 },
        replies: [],
      },
    ],
  };
  const view = render(
    <>
      <BrochureComments
        campaign={campaign}
        pageIndex={1}
        pageLabel="Cover"
        members={members}
        user={user}
        onAction={vi.fn()}
        focusedCommentId="target"
      />
      <ReviewPanel
        campaign={campaign}
        pageIndex={1}
        pageLabel="Cover"
        members={members}
        user={user}
        onAction={vi.fn()}
        focusedCommentId="target"
      />
    </>,
  );
  expect(view.getAllByRole("button", { name: "Post reply" })).toHaveLength(2);
  expect(
    view.container
      .querySelector('[data-review-comment-id="target"]')
      ?.getAttribute("data-focused"),
  ).toBe("true");
});

it("mentions several teammates with identical names, deduplicates them and removes recipients individually", async () => {
  const save = vi.fn().mockResolvedValue(true);
  const view = render(
    <CommentForm
      label="Comment"
      members={members}
      user={user}
      busy={false}
      onSave={save}
    />,
  );
  const text = view.getByRole("textbox");
  fireEvent.change(text, { target: { value: "Review @arta.pm" } });
  fireEvent.keyDown(text, { key: "Enter" });
  fireEvent.change(text, {
    target: { value: "Review @arta.pm@example.test and @arta.admin" },
  });
  fireEvent.keyDown(text, { key: "Enter" });
  expect(view.getAllByText("@Arta Krasniqi")).toHaveLength(2);
  fireEvent.change(text, {
    target: {
      value:
        "Review @arta.pm@example.test and @arta.admin@example.test @arta.pm",
    },
  });
  expect(
    view.queryByRole("option", { name: /arta.pm@example.test/ }),
  ).toBeNull();
  fireEvent.keyDown(text, { key: "Escape" });
  fireEvent.click(view.getByRole("button", { name: "Post comment" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      "Review @arta.pm@example.test and @arta.admin@example.test @arta.pm",
      "arta.pm@example.test",
      ["arta.pm@example.test", "arta.admin@example.test"],
    ),
  );
  await waitFor(() => expect(text).toHaveProperty("value", ""));
});
it("removes only the chosen recipient and ignores manually typed unselected names", async () => {
  const save = vi.fn().mockResolvedValue(true);
  const view = render(
    <CommentForm
      label="Comment"
      members={members}
      user={user}
      busy={false}
      onSave={save}
    />,
  );
  const text = view.getByRole("textbox");
  fireEvent.change(text, { target: { value: "Review @arta.pm" } });
  fireEvent.keyDown(text, { key: "Enter" });
  fireEvent.change(text, {
    target: { value: "Review @arta.pm@example.test and @arta.admin" },
  });
  fireEvent.keyDown(text, { key: "Enter" });
  fireEvent.click(
    view.getByRole("button", { name: "Remove mention: arta.pm@example.test" }),
  );
  fireEvent.click(view.getByRole("button", { name: "Post comment" }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      "Review  and @arta.admin@example.test",
      "arta.admin@example.test",
      ["arta.admin@example.test"],
    ),
  );
  await waitFor(() => expect(text).toHaveProperty("value", ""));
  fireEvent.change(text, { target: { value: "Please check @Arta" } });
  fireEvent.keyDown(text, { key: "Escape" });
  fireEvent.click(view.getByRole("button", { name: "Post comment" }));
  await waitFor(() =>
    expect(save).toHaveBeenLastCalledWith("Please check @Arta", "", []),
  );
});
