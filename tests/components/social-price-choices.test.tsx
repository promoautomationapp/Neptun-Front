import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SocialStudio } from "../../src/features/social/SocialStudio";
import { createPost } from "../../src/features/social/postModel";
import { getPosts, savePost } from "../../src/features/social/socialStorage";
import { setLanguage } from "../../src/features/brochure/i18n";

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
beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal("ResizeObserver", undefined);
  vi.mocked(savePost).mockImplementation(async (post) => post);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  ["minimal", "compact", 0, "Blue brochure card"],
  ["compact", "minimal", 1, "Red haPPy offer"],
] as const)(
  "exposes only two pricing designs and normalizes saved %s/%s choices",
  async (postStyle, productStyle, selected, productLabel) => {
    const post = {
      ...createPost(),
      name: "Social price defaults",
      priceStyle: postStyle,
      products: [
        {
          code: "device",
          name: "Device",
          brand: "LG",
          image: "/prepared.png",
          cutoutStatus: "done",
          skipAiCutout: true,
          regular: 499,
          sale: 399,
          priceStyle: productStyle,
        },
      ],
    };
    vi.mocked(getPosts).mockResolvedValue([post]);
    const view = render(<SocialStudio catalog={[]} campaigns={[]} />);
    fireEvent.click(
      await view.findByRole("button", { name: /Social price defaults/ }),
    );
    const choices = view.container.querySelectorAll<HTMLButtonElement>(
      ".social-price-choice-grid > button",
    );
    expect(choices).toHaveLength(2);
    expect(choices[selected]!.getAttribute("aria-pressed")).toBe("true");
    expect(view.queryByText("Simple red price")).toBeNull();
    const product = view.getByRole("button", {
      name: `Price design for Device: ${productLabel}`,
    });
    fireEvent.click(product);
    expect(view.getAllByRole("option")).toHaveLength(3);
    expect(view.getByRole("option", { name: /^Red haPPy offer/ })).toBeTruthy();
    expect(
      view.getByRole("option", { name: /^Blue brochure card/ }),
    ).toBeTruthy();
  },
);
