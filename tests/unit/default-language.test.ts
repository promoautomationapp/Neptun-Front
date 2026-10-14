import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  localStorage.removeItem("neptun-studio-language");
  vi.resetModules();
});

describe("default language", () => {
  it("selects Albanian and sets the page language for a fresh session", async () => {
    localStorage.removeItem("neptun-studio-language");
    vi.resetModules();
    const { getLanguage, t } = await import("../../src/features/brochure/i18n");
    expect(getLanguage()).toBe("sq");
    expect(document.documentElement.lang).toBe("sq");
    expect(t("Continue")).toBe("Vazhdo");
  });

  it("remembers an explicit English choice across sessions", async () => {
    localStorage.setItem("neptun-studio-language", "en");
    vi.resetModules();
    const { getLanguage, setLanguage } =
      await import("../../src/features/brochure/i18n");
    expect(getLanguage()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    setLanguage("sq");
    vi.resetModules();
    const restored = await import("../../src/features/brochure/i18n");
    expect(restored.getLanguage()).toBe("sq");
    expect(localStorage.getItem("neptun-studio-language")).toBe("sq");
  });
});
