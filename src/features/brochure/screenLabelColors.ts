/** Reusable vector ink presets. Labels stay native SVG; both color versions
 * can be selected/saved without raster generation or repeat AI requests. */
export const SCREEN_LABEL_COLOR_PRESETS = [
  { name: "White screen labels", color: "#ffffff", background: "#1c4075" },
  { name: "Black screen labels", color: "#000000", background: "#eef1f4" },
] as const;
