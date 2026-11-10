import { colorLuminance } from "../brochure/backgroundContrast";
import type { Campaign } from "../../domain/models";
import { logoRuleDefaults } from "./logoLibraryData";
export { logoRuleDefaults };
/** Rules are deliberately snapshotted; future workspace changes do not restyle a brochure. */
export function logoForBackground(
  campaign: Partial<Campaign>,
  target: "cover" | "pages" | "stores" | "footer",
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
  if (snapshot && selected !== snapshot[target === "cover" ? "cover" : "pages"])
    return fallback;
  const hex = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(color)
    ? color.toLowerCase()
    : "";
  const isLight =
    light ?? (hex ? colorLuminance(hex) > 0.45 : campaign.theme === "light");
  const rules = (campaign.logoRules || [])
    .filter(
      (rule) =>
        rule.enabled && (rule.target === target || rule.target === "both"),
    )
    .sort((a, b) => Number(b.target === target) - Number(a.target === target));
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
