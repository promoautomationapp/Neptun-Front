import { setLanguage } from "../../src/features/brochure/i18n";
import { selectSetting } from "../helpers/settings-sections";
import React from "react";
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SocialPost } from "../../src/domain/models";
import { postSchema } from "../../src/domain/schemas";
import { SocialStudio } from "../../src/features/social/SocialStudio";
import { createPost } from "../../src/features/social/postModel";
import {
  getPosts,
  removePost,
  restorePost,
  savePost,
} from "../../src/features/social/socialStorage";
import { readImage } from "../../src/features/brochure/utils";
import { requestAi } from "../../src/features/ai/ai.api";
import type * as UtilsModule from "../../src/features/brochure/utils";
import type * as BrandLogosModule from "../../src/features/brochure/brandLogos";

vi.mock("../../src/features/social/socialStorage", () => ({
  getPosts: vi.fn(),
  savePost: vi.fn(),
  removePost: vi.fn(),
  restorePost: vi.fn(),
}));
vi.mock("../../src/features/ai/ai.api", () => ({ requestAi: vi.fn() }));
vi.mock("../../src/features/brochure/utils", async (original) => ({
  ...(await original<typeof UtilsModule>()),
  readImage: vi.fn(),
}));
vi.mock("../../src/features/brochure/brandLogos", async (original) => ({
  ...(await original<typeof BrandLogosModule>()),
  loadPreparedBrandLogos: async () => ({}),
}));
vi.mock("../../src/features/social/plainBackgroundPreview", () => ({
  plainBackgroundPreview: async () => null,
}));
let stored: SocialPost[];
const imageFile = (name: string) =>
  new File(["photo"], name, { type: "image/png" });
function fixture(name = "Social QA"): SocialPost {
  return {
    ...createPost(),
    name,
    showEventLogo: false,
    showNeptunLogo: false,
    products: [
      {
        code: "one",
        name: "First product",
        image: "/prepared-one.png",
        cutoutStatus: "done",
        skipAiCutout: true,
      },
      {
        code: "two",
        name: "Second product",
        image: "/prepared-two.png",
        cutoutStatus: "done",
        skipAiCutout: true,
      },
    ],
  };
}
function open(view: ReturnType<typeof render>, name = "Social QA") {
  return view
    .findByRole("button", { name: new RegExp(name) })
    .then((button) => fireEvent.click(button));
}
beforeEach(() => {
  stored = [fixture()];
  vi.mocked(getPosts).mockImplementation(async () => structuredClone(stored));
  vi.mocked(savePost).mockImplementation(async (post) => {
    const saved = postSchema.parse(JSON.parse(JSON.stringify(post)));
    const index = stored.findIndex((item) => item.id === saved.id);
    if (index < 0) stored.push(saved);
    else stored[index] = saved;
    return structuredClone(saved);
  });
  vi.mocked(removePost).mockResolvedValue({ deleted: true });
  vi.mocked(readImage).mockImplementation(
    async (file) => `/api/assets/${file?.name}`,
  );
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal("ResizeObserver", undefined);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return DOMRect.fromRect(
        this.classList.contains("social-canvas")
          ? { x: 0, y: 0, width: 1000, height: 1000 }
          : { x: 100, y: 100, width: 200, height: 200 },
      );
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("adds separate images, moves/resizes one, and restores both layers on reload without AI", async () => {
  const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
  await open(view);
  fireEvent.change(view.getByLabelText("Add images to post"), {
    target: { files: [imageFile("badge.png"), imageFile("artwork.png")] },
  });
  const badge = await view.findByLabelText("badge.png");
  await view.findByLabelText("artwork.png");
  fireEvent.pointerDown(badge, { clientX: 200, clientY: 150 });
  fireEvent.pointerMove(badge, { clientX: 400, clientY: 350 });
  fireEvent.pointerUp(badge);
  const resize = view.getByRole("button", { name: "Resize badge.png" });
  fireEvent.pointerDown(resize, { clientX: 400, clientY: 350 });
  fireEvent.pointerMove(resize, { clientX: 500, clientY: 350 });
  fireEvent.pointerUp(resize);
  await waitFor(() => expect(stored[0]?.artworks).toHaveLength(2), {
    timeout: 2500,
  });
  expect(
    stored[0]?.artworks?.find((item) => item.name === "badge.png"),
  ).toMatchObject({ x: 40, y: 35, width: 40 });
  expect(
    stored[0]?.artworks?.find((item) => item.name === "artwork.png"),
  ).toMatchObject({ x: 23, y: 18, width: 20 });
  expect(new Set(stored[0]?.artworks?.map((item) => item.id)).size).toBe(2);
  view.unmount();
  const reloaded = render(<SocialStudio catalog={[]} campaigns={[]} />);
  await open(reloaded);
  expect(reloaded.getByLabelText("badge.png").getAttribute("style")).toContain(
    "left: 40%",
  );
  expect(
    reloaded.getByLabelText("artwork.png").getAttribute("style"),
  ).toContain("width: 20%");
  expect(requestAi).not.toHaveBeenCalled();
});

it("keeps shared brochure products usable but removes catalog selection when catalog access is off", async () => {
  setLanguage("en");
  const view = render(
    <SocialStudio
      canViewCatalog={false}
      catalog={[{ code: "catalog-hidden", name: "Hidden catalog product" }]}
      campaigns={[
        {
          id: "shared-brochure",
          name: "Shared brochure",
          products: [
            {
              code: "shared-product",
              name: "Saved brochure offer",
              sale: 90,
              skipAiCutout: true,
            },
          ],
        },
      ]}
    />,
  );
  await open(view);
  fireEvent.click(view.getByRole("button", { name: "＋ Add products" }));
  await view.findByRole("heading", { name: "Add to this post" });
  expect(view.getByText("Saved brochure offer")).toBeTruthy();
  expect(view.queryByText("Hidden catalog product")).toBeNull();
  fireEvent.click(
    view.getByRole("button", { name: "Product source: Shared brochure" }),
  );
  expect(view.getAllByRole("option")).toHaveLength(1);
  expect(view.getByRole("option", { name: /Shared brochure/ })).toBeTruthy();
  expect(view.queryByRole("option", { name: /catalog/i })).toBeNull();
  expect(requestAi).not.toHaveBeenCalled();
});

it("keeps successful uploads when another fails and saves to the original post after leaving it", async () => {
  let finish!: (value: string) => void;
  vi.mocked(readImage).mockImplementation((file) =>
    file?.name === "bad.png"
      ? Promise.reject(new Error("upload failed"))
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  const target = stored[0]!.id;
  const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
  await open(view);
  fireEvent.change(view.getByLabelText("Add images to post"), {
    target: { files: [imageFile("saved.png"), imageFile("bad.png")] },
  });
  await view.findByText(/Uploading images/);
  fireEvent.click(view.getByRole("button", { name: "← All posts" }));
  fireEvent.click(view.getByRole("button", { name: "＋ New post" }));
  await act(async () => finish("/api/assets/saved.png"));
  await waitFor(() =>
    expect(stored.find((item) => item.id === target)?.artworks).toHaveLength(1),
  );
  expect(stored.find((item) => item.id === target)?.artworks?.[0]?.name).toBe(
    "saved.png",
  );
  expect(view.getByLabelText("Post name").getAttribute("value")).toBe(
    "New social post",
  );
  expect(view.queryByLabelText("saved.png")).toBeNull();
  expect(
    await view.findByText(/1 images added. 1 files could not be uploaded/),
  ).toBeTruthy();
  expect(requestAi).not.toHaveBeenCalled();
});

it("drops multiple files over a product as independent canvas images without replacing it", async () => {
  const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
  await open(view);
  const product = view
    .getByAltText("First product")
    .closest(".social-product")!;
  const drop = createEvent.drop(product, {
    dataTransfer: {
      types: ["Files"],
      files: [imageFile("mark.png"), imageFile("extra.png")],
    },
  });
  Object.defineProperties(drop, {
    clientX: { value: 450 },
    clientY: { value: 300 },
  });
  fireEvent(product, drop);
  await view.findByLabelText("mark.png");
  await view.findByLabelText("extra.png");
  await waitFor(() => expect(stored[0]?.artworks).toHaveLength(2), {
    timeout: 2500,
  });
  expect(stored[0]?.products[0]?.image).toBe("/prepared-one.png");
  expect(
    stored[0]?.artworks?.find((item) => item.name === "mark.png"),
  ).toMatchObject({ x: 45, y: 30 });
  expect(requestAi).not.toHaveBeenCalled();
});

it("saves edit-mode dimensions, guide visibility and product grid while preserving artwork placement", async () => {
  stored[0]!.artworks = [
    {
      id: "art",
      name: "existing.png",
      image: "/existing.png",
      x: 76,
      y: 82,
      width: 31,
    },
  ];
  const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
  await open(view);
  const canvas = view.getByLabelText("existing.png").closest(".social-canvas")!;
  selectSetting(view, "Post size", "custom");
  fireEvent.change(view.getByLabelText("Post width in pixels"), {
    target: { value: "1440" },
  });
  fireEvent.change(view.getByLabelText("Post height in pixels"), {
    target: { value: "1920" },
  });
  fireEvent.change(view.getByLabelText("Product grid rows"), {
    target: { value: "2" },
  });
  fireEvent.change(view.getByLabelText("Product grid columns"), {
    target: { value: "1" },
  });
  fireEvent.change(view.getByLabelText("Product grid spacing (%)"), {
    target: { value: "8" },
  });
  fireEvent.click(view.getByRole("button", { name: "Show grid" }));
  fireEvent.click(view.getByRole("button", { name: "Apply product grid" }));
  expect(canvas.getAttribute("style")).toContain("aspect-ratio: 1440 / 1920");
  expect(canvas.classList.contains("social-guides")).toBe(true);
  await waitFor(
    () =>
      expect(stored[0]?.productGrid).toEqual({ rows: 2, columns: 1, gap: 8 }),
    { timeout: 2500 },
  );
  expect(stored[0]?.artworks?.[0]).toMatchObject({ x: 76, y: 82, width: 31 });
  expect(stored[0]?.products.map((item) => item.y)).toEqual([35.5, 62.5]);
  view.unmount();
  const restored = render(<SocialStudio catalog={[]} campaigns={[]} />);
  await open(restored);
  expect(
    (restored.getByLabelText("Post width in pixels") as HTMLInputElement).value,
  ).toBe("1440");
  expect(
    restored
      .getByRole("button", { name: "Hide grid" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    restored.getByLabelText("existing.png").getAttribute("style"),
  ).toContain("left: 76%");
  fireEvent.click(restored.getByRole("button", { name: "Preview" }));
  expect(restored.queryByLabelText("Post size")).toBeNull();
  expect(
    restored
      .getByLabelText("existing.png")
      .closest(".social-canvas")
      ?.classList.contains("social-guides"),
  ).toBe(false);
  expect(requestAi).not.toHaveBeenCalled();
});

it("hides disabled posts from workspace users and lets only superadmins enable them", async () => {
  setLanguage("en");
  stored = [
    {
      ...fixture(),
      name: "Disabled social sample",
      disabledAt: "2026-10-15T10:00:00Z",
      version: 4,
    },
  ];
  const ordinary = render(<SocialStudio catalog={[]} campaigns={[]} />);
  await ordinary.findByText(/No posts yet/);
  expect(ordinary.queryByText("Disabled social sample")).toBeNull();
  expect(
    ordinary.queryByRole("button", { name: /Post visibility/ }),
  ).toBeNull();
  ordinary.unmount();
  vi.mocked(restorePost).mockImplementation(async (item) => {
    stored = [{ ...item, disabledAt: null, disabledBy: null, version: 5 }];
    return stored[0]!;
  });
  const admin = render(
    <SocialStudio catalog={[]} campaigns={[]} canManageDisabled />,
  );
  await admin.findByRole("button", { name: "Post visibility: Active posts" });
  fireEvent.click(
    admin.getByRole("button", { name: "Post visibility: Active posts" }),
  );
  fireEvent.click(admin.getByRole("option", { name: "Disabled posts" }));
  expect(admin.getByText("Disabled social sample")).toBeTruthy();
  expect(
    admin.queryByRole("button", { name: /Disabled social sample/ }),
  ).toBeNull();
  fireEvent.click(admin.getByRole("button", { name: "Enable post" }));
  await admin.findByText("Post enabled.");
  expect(restorePost).toHaveBeenCalledOnce();
  expect(savePost).not.toHaveBeenCalled();
  expect(requestAi).not.toHaveBeenCalled();
  fireEvent.click(
    admin.getByRole("button", { name: "Post visibility: Disabled posts" }),
  );
  fireEvent.click(admin.getByRole("option", { name: "Active posts" }));
  expect(
    admin.getByRole("button", { name: /Disabled social sample/ }),
  ).toBeTruthy();
});

it("saves the latest edits before disabling an existing post", async () => {
  setLanguage("en");
  const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
  await open(view);
  fireEvent.change(view.getByRole("textbox", { name: "Post name" }), {
    target: { value: "Latest saved name" },
  });
  fireEvent.click(view.getByRole("button", { name: "Disable" }));
  fireEvent.click(view.getByRole("button", { name: "Disable post" }));
  await view.findByText("Post disabled.");
  expect(savePost).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Latest saved name" }),
  );
  expect(vi.mocked(savePost).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(removePost).mock.invocationCallOrder[0]!,
  );
  expect(view.queryByRole("textbox", { name: "Post name" })).toBeNull();
  expect(requestAi).not.toHaveBeenCalled();
});
it("saves a new draft before disabling it rather than dropping an unsaved post", async () => {
  setLanguage("en");
  const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
  await view.findByRole("button", { name: /Social QA/ });
  fireEvent.click(view.getByRole("button", { name: "＋ New post" }));
  fireEvent.change(view.getByRole("textbox", { name: "Post name" }), {
    target: { value: "New draft to keep" },
  });
  fireEvent.click(view.getByRole("button", { name: "Disable" }));
  fireEvent.click(view.getByRole("button", { name: "Disable post" }));
  await view.findByText("Post disabled.");
  expect(stored.some((item) => item.name === "New draft to keep")).toBe(true);
  expect(vi.mocked(savePost).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(removePost).mock.invocationCallOrder[0]!,
  );
  expect(requestAi).not.toHaveBeenCalled();
});
