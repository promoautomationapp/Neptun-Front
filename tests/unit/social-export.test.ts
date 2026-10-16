import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { captureSocialPost } from "../../src/features/social/socialExport";
import { setLanguage } from "../../src/features/brochure/i18n";

vi.mock("html-to-image", () => ({
  toCanvas: vi.fn(),
  getFontEmbedCSS: vi.fn(),
}));

const fontCSS =
  '@font-face{font-family:"TSTAR Headline";src:url(data:font/ttf;base64,font)}';

beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    queueMicrotask(() => callback(performance.now()));
    return 1;
  });
  vi.mocked(getFontEmbedCSS).mockResolvedValue(fontCSS);
});
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function fixture() {
  const root = document.createElement("section");
  root.className = "social-canvas";
  root.style.fontFamily = "SkolaSans";
  root.innerHTML =
    '<svg><text data-brochure-export-font="existing" style="font-family: TSTAR Headline; font-size: 29.44px; font-weight: 700">65”</text></svg><button data-export-hide="true">Move</button>';
  document.body.append(root);
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
    width: 1080,
    height: 1350,
  } as DOMRect);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  return { root, canvas };
}

it("captures the live output render with SVG fonts and exact typography, excluding editor controls", async () => {
  const { root, canvas } = fixture();
  vi.mocked(getFontEmbedCSS).mockImplementation(async (node) => {
    // SVG-only families need HTML probes for html-to-image's font discovery.
    expect(
      [...node.querySelectorAll("span")].some((probe) =>
        /TSTAR Headline/.test(probe.style.fontFamily),
      ),
    ).toBe(true);
    return fontCSS;
  });
  vi.mocked(toCanvas).mockImplementation(async (node, options) => {
    expect(node).toBe(root);
    expect(options).toMatchObject({
      width: 1080,
      height: 1350,
      pixelRatio: 1,
      skipAutoScale: true,
      fontEmbedCSS: fontCSS,
    });
    const typography = root.querySelector("style")!.textContent;
    expect(typography).toContain('font-family: "TSTAR Headline" !important');
    expect(typography).toContain("font-size: 29.44px !important");
    expect(typography).toContain("font-weight: 700 !important");
    expect(options?.filter?.(root.querySelector("button")!)).toBe(false);
    expect(options?.filter?.(root)).toBe(true);
    return canvas;
  });

  expect(await captureSocialPost(root, 1080, 1350)).toBe(canvas);
  expect(root.querySelector("style")).toBeNull();
  expect(
    root.querySelector("text")!.getAttribute("data-brochure-export-font"),
  ).toBe("existing");
  expect(root.querySelectorAll('[data-export-hide="true"]')).toHaveLength(1);
});

it("waits for fonts, image decoding and frame measurements before capturing", async () => {
  const { root, canvas } = fixture();
  const originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
  let resolveFonts!: () => void;
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: {
      ready: new Promise<void>((resolve) => {
        resolveFonts = resolve;
      }),
    },
  });
  const image = document.createElement("img");
  Object.defineProperties(image, {
    complete: { value: true },
    naturalWidth: { value: 100 },
  });
  image.decode = vi.fn(async () => {});
  root.append(image);
  let frames = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    queueMicrotask(() => {
      frames += 1;
      root.querySelector("text")!.style.fontSize = "40.5px";
      callback(performance.now());
    });
    return 1;
  });
  vi.mocked(toCanvas).mockImplementation(async () => {
    expect(image.decode).toHaveBeenCalled();
    expect(frames).toBeGreaterThanOrEqual(2);
    expect(root.querySelector("style")!.textContent).toContain(
      "font-size: 40.5px !important",
    );
    return canvas;
  });
  try {
    const capture = captureSocialPost(root, 1080, 1350);
    await Promise.resolve();
    expect(toCanvas).not.toHaveBeenCalled();
    resolveFonts();
    expect(await capture).toBe(canvas);
  } finally {
    if (originalFonts) Object.defineProperty(document, "fonts", originalFonts);
    else Reflect.deleteProperty(document, "fonts");
  }
});

it.each(["", '@font-face{font-family:TSTAR;src:url("")}'])(
  "rejects missing embedded fonts before rasterizing: %s",
  async (css) => {
    const { root } = fixture();
    vi.mocked(getFontEmbedCSS).mockResolvedValue(css);
    await expect(captureSocialPost(root, 1080, 1350)).rejects.toThrow(
      "Brochure fonts could not be loaded",
    );
    expect(toCanvas).not.toHaveBeenCalled();
    expect(root.querySelectorAll('[data-export-hide="true"]')).toHaveLength(1);
  },
);

it.each(["capture", "dimensions"])(
  "restores measured typography when %s fails",
  async (failure) => {
    const { root, canvas } = fixture();
    if (failure === "capture")
      vi.mocked(toCanvas).mockRejectedValue(new Error("Capture failed"));
    else {
      canvas.width = 640;
      vi.mocked(toCanvas).mockResolvedValue(canvas);
    }
    await expect(captureSocialPost(root, 1080, 1350)).rejects.toThrow(
      failure === "capture" ? "Capture failed" : "post size is incorrect",
    );
    expect(root.querySelector("style")).toBeNull();
    expect(
      root.querySelector("text")!.getAttribute("data-brochure-export-font"),
    ).toBe("existing");
  },
);

it("rejects a preview-sized canvas instead of silently scaling measured artwork", async () => {
  const { root } = fixture();
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
    width: 540,
    height: 675,
  } as DOMRect);
  await expect(captureSocialPost(root, 1080, 1350)).rejects.toThrow(
    "does not match the selected size",
  );
  expect(toCanvas).not.toHaveBeenCalled();
});

it.each(["load", "decode"])(
  "times out stalled image %s and releases its listeners",
  async (phase) => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { root } = fixture();
    const image = document.createElement("img");
    Object.defineProperties(image, {
      complete: { value: phase === "decode" },
      naturalWidth: { value: 100 },
    });
    image.decode = vi.fn(() => new Promise<void>(() => {}));
    const remove = vi.spyOn(image, "removeEventListener");
    root.append(image);
    const capture = captureSocialPost(root, 1080, 1350);
    const rejected = expect(capture).rejects.toThrow(
      "A post image did not finish loading",
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(remove).toHaveBeenCalledWith("load", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("error", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
    expect(toCanvas).not.toHaveBeenCalled();
  },
);
