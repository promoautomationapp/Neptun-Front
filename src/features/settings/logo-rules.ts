import type { Campaign } from "../../domain/models";
import { logoRuleDefaults } from "./logoLibraryData";
export { logoRuleDefaults };
/** Rules are deliberately snapshotted; future workspace changes do not restyle a brochure. */
export function logoForBackground(
  campaign: Partial<Campaign>,
  target: "cover" | "pages",
  color: string,
  fallback: string,
  light?: boolean,
) {
  const snapshot = campaign.logoRuleDefaults;
  const selected =
    target === "cover"
      ? campaign.coverLogoSource || ""
      : campaign.brandAssets?.neptun || "";
  // A deliberate logo edit in an individual brochure wins over its inherited rules.
  if (snapshot && selected !== snapshot[target]) return fallback;
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "";
  const isLight =
    light ?? (hex ? luminance(hex) > 0.45 : campaign.theme === "light");
  const rules = (campaign.logoRules || []).filter(
    (rule) =>
      rule.enabled && (rule.target === target || rule.target === "both"),
  );
  const exact =
    hex &&
    rules.find(
      (rule) => rule.background === "color" && rule.color.toLowerCase() === hex,
    );
  const contrast = rules.find(
    (rule) => rule.background === (isLight ? "light" : "dark"),
  );
  return (exact || contrast)?.image || fallback;
}
function luminance(color: string) {
  const values = [1, 3, 5].map((offset) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * values[0]! + 0.7152 * values[1]! + 0.0722 * values[2]!;
}
