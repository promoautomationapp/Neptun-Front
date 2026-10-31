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
import { SocialStudio } from "../../src/features/social/SocialStudio";
import { createPost } from "../../src/features/social/postModel";
import { getPosts, savePost } from "../../src/features/social/socialStorage";
import { resolveSettings } from "../../src/features/settings/settings.schema";
import { setLanguage, t } from "../../src/features/brochure/i18n";
import { socialBrandingText as copy } from "../../src/features/social/socialBranding";
vi.mock("../../src/features/social/socialStorage", () => ({
  getPosts: vi.fn(),
  savePost: vi.fn(),
  removePost: vi.fn(),
  restorePost: vi.fn(),
}));
vi.mock("../../src/features/brochure/brandLogos", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  loadPreparedBrandLogos: async () => ({}),
}));
vi.mock("../../src/features/social/plainBackgroundPreview", () => ({
  plainBackgroundPreview: async () => null,
}));
let stored: SocialPost;
const settings = resolveSettings(null);
settings.logoLibrary = [
  {
    id: "brand-logo",
    name: "Brand logo fixture",
    url: "/api/assets/legacy/brand-fixture.png",
  },
];
beforeEach(() => {
  stored = {
    ...createPost(),
    name: "Branding regression",
    showNeptunLogo: true,
    showEventLogo: true,
    showCustomLogo: true,
    customLogo: "/custom.png",
  };
  vi.mocked(getPosts).mockImplementation(async () => [structuredClone(stored)]);
  vi.mocked(savePost).mockImplementation(async (post) => {
    stored = structuredClone(post);
    return structuredClone(post);
  });
  vi.stubGlobal("PointerEvent", MouseEvent);
  vi.stubGlobal("ResizeObserver", undefined);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      return DOMRect.fromRect(
        this.classList.contains("social-canvas")
          ? { x: 0, y: 0, width: 1000, height: 1000 }
          : { x: 100, y: 100, width: 200, height: 120 },
      );
    },
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each(["en", "sq"] as const)(
  "changes and deletes explicit branding, edits footer layout and persists it (%s)",
  async (language) => {
    setLanguage(language);
    const view = render(
      <SocialStudio catalog={[]} campaigns={[]} settings={settings} />,
    );
    fireEvent.click(
      await view.findByRole("button", { name: /Branding regression/ }),
    );
    const canvas = () =>
      within(view.container.querySelector(".social-canvas")! as HTMLElement);
    expect(canvas().getByLabelText(t("Event badge"))).toBeTruthy();
    fireEvent.click(
      canvas().getByRole("button", {
        name: `${t("Remove")} ${t("Event badge")}`,
      }),
    );
    expect(canvas().queryByLabelText(t("Event badge"))).toBeNull();
    fireEvent.doubleClick(canvas().getByLabelText(t("NEPTUN logo")));
    const picker = await view.findByRole("dialog", {
      name: copy("Change logo"),
    });
    fireEvent.click(
      within(picker).getByRole("button", {
        name: `${t("Select logo")}: Brand logo fixture`,
      }),
    );
    fireEvent.click(
      within(picker).getByRole("button", { name: t("Use this logo") }),
    );
    expect(
      canvas()
        .getByRole("img", { name: t("NEPTUN logo") })
        .getAttribute("src"),
    ).toContain("brand-fixture.png");
    fireEvent.click(view.getByText(t("Images"), { exact: true }));
    fireEvent.click(
      await view.findByRole("button", {
        name: copy("Manage logos and layout"),
      }),
    );
    const panel = await view.findByRole("dialog", {
      name: copy("Branding & layout"),
    });
    fireEvent.click(
      within(panel).getByRole("button", {
        name: copy("Logo and footer line"),
      }),
    );
    fireEvent.click(
      within(panel).getByRole("checkbox", { name: copy("Footer line") }),
    );
    fireEvent.click(
      within(panel).getByRole("button", { name: t("Close") }),
    );
    expect(view.container.querySelector(".social-brand-footer")).toBeTruthy();
    expect(
      view.container.querySelector(".social-brand-footer-line"),
    ).toBeNull();
    const move = canvas().getByRole("button", {
      name: `${t("Move")} ${copy("Brand footer")}`,
    });
    fireEvent.pointerDown(move, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(move, { clientX: 200, clientY: 80 });
    fireEvent.pointerUp(move);
    await waitFor(
      () =>
        expect(stored.logoCoords?.footer).toMatchObject({
          x: 10,
          y: -2,
          scale: 1,
        }),
      { timeout: 2500 },
    );
    expect(stored).toMatchObject({
      showEventLogo: false,
      showCustomLogo: true,
      logoLayout: "footer",
      showLogoFooterLine: false,
      neptunLogoUpload: "/api/assets/legacy/brand-fixture.png",
    });
    fireEvent.click(
      canvas().getByRole("button", {
        name: `${t("Remove")} ${copy("Brand footer")}`,
      }),
    );
    await waitFor(() => expect(stored.showNeptunLogo).toBe(false), {
      timeout: 2500,
    });
    view.unmount();
    const restored = render(
      <SocialStudio catalog={[]} campaigns={[]} settings={settings} />,
    );
    fireEvent.click(
      await restored.findByRole("button", { name: /Branding regression/ }),
    );
    expect(restored.container.querySelector(".social-brand-footer")).toBeNull();
    expect(
      restored.container.querySelector(
        ".social-canvas [aria-label='" + t("Event badge") + "']",
      ),
    ).toBeNull();
  },
);
