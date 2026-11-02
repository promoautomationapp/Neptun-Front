import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SocialPost } from "../../src/domain/models";
import { setLanguage, t } from "../../src/features/brochure/i18n";
import type * as BrandLogos from "../../src/features/brochure/brandLogos";
import { SocialStudio } from "../../src/features/social/SocialStudio";
import { createPost } from "../../src/features/social/postModel";
import { SocialPostCard } from "../../src/features/social/SocialPostCard";
import {
  getPosts,
  removePost,
  restorePost,
  savePost,
} from "../../src/features/social/socialStorage";
import { captureSocialPost } from "../../src/features/social/socialExport";
import { requestAi } from "../../src/features/ai/ai.api";

vi.mock("../../src/features/social/socialStorage", () => ({
  getPosts: vi.fn(),
  savePost: vi.fn(),
  removePost: vi.fn(),
  restorePost: vi.fn(),
}));
vi.mock("../../src/features/social/socialExport", () => ({
  captureSocialPost: vi.fn(),
}));
vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: vi.fn() }));
vi.mock("../../src/features/brochure/brandLogos", async (original) => ({
  ...(await original<typeof BrandLogos>()),
  loadPreparedBrandLogos: async () => ({}),
}));
vi.mock("../../src/features/social/plainBackgroundPreview", () => ({
  plainBackgroundPreview: async () => null,
}));

let stored: SocialPost[];
const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
beforeEach(() => {
  setLanguage("en");
  stored = [
    {
      ...createPost(),
      name: "Weekend offer",
      textHtml: "<p>Save this weekend</p>",
      showNeptunLogo: false,
    },
  ];
  vi.mocked(getPosts).mockImplementation(async () => structuredClone(stored));
  vi.mocked(savePost).mockImplementation(async (post) => {
    stored.push(structuredClone(post));
    return structuredClone(post);
  });
  vi.mocked(removePost).mockResolvedValue({ deleted: true });
  vi.mocked(restorePost).mockImplementation(async (post) => ({
    ...post,
    disabledAt: null,
    disabledBy: null,
  }));
  vi.stubGlobal("ResizeObserver", undefined);
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: Object.assign(new EventTarget(), { ready: Promise.resolve() }),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  setLanguage("en");
  if (originalFonts) Object.defineProperty(document, "fonts", originalFonts);
  else Reflect.deleteProperty(document, "fonts");
});

it("shows the real saved canvas and duplicates it from the library without opening the editor or using AI", async () => {
  const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
  const card = await view.findByRole("article", { name: "Weekend offer" });
  expect(within(card).getByText("Save this weekend")).toBeTruthy();
  expect(card.querySelector(".social-canvas")).toBeTruthy();
  fireEvent.click(within(card).getByRole("button", { name: "Duplicate post" }));
  await view.findByRole("article", { name: "Weekend offer · Copy" });
  expect(savePost).toHaveBeenCalledTimes(1);
  expect(vi.mocked(savePost).mock.calls[0]?.[0].id).not.toBe(stored[0]?.id);
  expect(view.queryByRole("textbox", { name: "Post name" })).toBeNull();
  expect(requestAi).not.toHaveBeenCalled();
});

it("confirms a library delete, allows cancellation, and removes only the chosen post", async () => {
  stored[0]!.version = 4;
  const originalId = stored[0]!.id;
  stored.push({ ...createPost(), name: "Keep this offer" });
  const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
  const card = await view.findByRole("article", { name: "Weekend offer" });
  fireEvent.click(within(card).getByRole("button", { name: "Delete post" }));
  let dialog = await view.findByRole("dialog", { name: "Delete social post" });
  expect(within(dialog).getByText("Weekend offer")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep post" }));
  expect(removePost).not.toHaveBeenCalled();
  fireEvent.click(within(card).getByRole("button", { name: "Delete post" }));
  dialog = await view.findByRole("dialog", { name: "Delete social post" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete post" }));
  await waitFor(() =>
    expect(view.queryByRole("article", { name: "Weekend offer" })).toBeNull(),
  );
  expect(removePost).toHaveBeenCalledWith(originalId, 4);
  expect(view.getByRole("article", { name: "Keep this offer" })).toBeTruthy();
});

it("deletes a dirty open post using the version returned by its final save", async () => {
  stored[0]!.version = 4;
  const id = stored[0]!.id;
  vi.mocked(savePost).mockImplementation(async (post) => ({
    ...structuredClone(post),
    version: 5,
  }));
  const view = render(
    <SocialStudio catalog={[]} campaigns={[]} initialPostId={id} />,
  );
  fireEvent.change(await view.findByRole("textbox", { name: "Post name" }), {
    target: { value: "Updated before deleting" },
  });
  fireEvent.click(view.getByRole("button", { name: "Delete" }));
  const dialog = await view.findByRole("dialog", {
    name: "Delete social post",
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete post" }));
  await waitFor(() => expect(removePost).toHaveBeenCalledWith(id, 5));
  expect(vi.mocked(savePost).mock.calls[0]?.[0].name).toBe(
    "Updated before deleting",
  );
});

it("offers additional download formats without opening the post", async () => {
  const onDownload = vi.fn();
  const view = render(
    <SocialPostCard
      post={stored[0]!}
      preview={<div>Saved artwork</div>}
      busy={false}
      onOpen={vi.fn()}
      onDownload={onDownload}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
      onRestore={vi.fn()}
    />,
  );
  fireEvent.click(view.getByText("Download options"));
  fireEvent.click(await view.findByRole("button", { name: "Download PDF" }));
  expect(onDownload).toHaveBeenCalledWith("pdf");
});

it("hides deleted posts from customers and offers only recovery to superadmins", async () => {
  stored[0]!.disabledAt = "2026-10-30T00:00:00Z";
  const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
  await view.findByText("No social media posts.");
  expect(view.queryByRole("article")).toBeNull();
  view.rerender(<SocialStudio catalog={[]} campaigns={[]} canManageDisabled />);
  fireEvent.click(await view.findByRole("button", { name: /Post visibility/ }));
  fireEvent.click(view.getByRole("option", { name: "Deleted posts" }));
  const card = await view.findByRole("article", { name: "Weekend offer" });
  expect(
    within(card).queryByRole("button", { name: "Delete post" }),
  ).toBeNull();
  expect(
    within(card).queryByRole("button", { name: "Duplicate post" }),
  ).toBeNull();
  fireEvent.click(within(card).getByRole("button", { name: "Restore post" }));
  await waitFor(() => expect(restorePost).toHaveBeenCalledTimes(1));
  await view.findByText("No deleted posts.");
});

it("downloads a saved card directly using a fresh canvas at its output dimensions", async () => {
  const capture = vi.mocked(captureSocialPost);
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "toBlob").mockImplementation((callback) =>
    callback(new Blob(["png"], { type: "image/png" })),
  );
  capture.mockResolvedValue(canvas);
  const download = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => {});
  vi.stubGlobal(
    "URL",
    class extends URL {
      static override createObjectURL = vi.fn(() => "blob:saved-card");
      static override revokeObjectURL = vi.fn();
    },
  );
  const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
  const card = await view.findByRole("article", { name: "Weekend offer" });
  fireEvent.click(within(card).getByRole("button", { name: "Download post" }));
  const link = await view.findByRole("link", { name: /Download again/ });
  expect(link.getAttribute("download")).toBe("weekend-offer-1080x1350.png");
  expect(capture).toHaveBeenCalledWith(expect.any(HTMLElement), 1080, 1350);
  expect(download).toHaveBeenCalledTimes(1);
  expect(view.queryByRole("textbox", { name: "Post name" })).toBeNull();
  expect(requestAi).not.toHaveBeenCalled();
});

it("keeps a deep-linked editor through loading and returns to the library when the URL is cleared", async () => {
  const onActivePostChange = vi.fn();
  let finish: (posts: SocialPost[]) => void = () => {};
  vi.mocked(getPosts).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const props = {
    catalog: [],
    campaigns: [],
    initialPostId: stored[0]!.id,
    onActivePostChange,
  };
  const view = render(<SocialStudio {...props} />);
  expect(onActivePostChange).not.toHaveBeenCalled();
  finish(structuredClone(stored));
  await view.findByRole("textbox", { name: "Post name" });
  expect(onActivePostChange).toHaveBeenLastCalledWith(stored[0]!.id);
  view.rerender(<SocialStudio {...props} initialPostId={null} />);
  await view.findByRole("article", { name: "Weekend offer" });
  expect(onActivePostChange).toHaveBeenLastCalledWith(null);
});

it("uses the selected language for unnamed saved cards and their actions", async () => {
  setLanguage("sq");
  stored[0]!.name = "New social post";
  const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
  const card = await view.findByRole("article", { name: t("New social post") });
  expect(
    within(card).getByRole("button", { name: t("Download post") }),
  ).toBeTruthy();
  expect(
    within(card).getByRole("button", { name: t("Duplicate post") }),
  ).toBeTruthy();
  expect(
    within(card).getByRole("button", { name: t("Delete post") }),
  ).toBeTruthy();
});
