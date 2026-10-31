import type { SocialPost } from "../../domain/models";
import { getLanguage, t } from "../brochure/i18n";
export type SocialBrandingKind = "neptun" | "event" | "custom";
const strings: Record<string, string> = {
  "Branding & layout": "Logot dhe vendosja",
  "Add logo or badge": "Shto logo ose shenjë",
  "Manage logos and layout": "Menaxho logot dhe vendosjen",
  "Change logo": "Ndrysho logon",
  "Remove logo": "Fshij logon",
  "Add logo": "Shto logo",
  "Footer line": "Vija në fund",
  "Brand footer": "Logoja dhe vija në fund",
  "Corner logo": "Logo në kënd",
  "Logo and footer line": "Logo dhe vijë në fund",
  "Reset footer position": "Rikthe pozicionin e fundit",
  "Event branding is optional. Add a saved logo or upload your own.":
    "Logoja e eventit është opsionale. Shtoni një logo të ruajtur ose ngarkoni tuajën.",
};
export const socialBrandingText = (key: string) =>
  getLanguage() === "sq" ? strings[key] || t(key) : key;
export function socialBrandingSource(
  post: SocialPost,
  kind: SocialBrandingKind,
): string {
  if (kind === "neptun")
    return (
      post.neptunLogoUpload ||
      `/api/assets/legacy/assets/social/neptun-${post.logoVariant === "blue" ? "blue" : "white"}.png`
    );
  if (kind === "custom") return post.customLogo || "";
  return (
    post.eventLogoUpload ||
    (post.eventLogo === "happy-day"
      ? "/api/assets/legacy/assets/social/happy-day.png"
      : post.eventLogo === "back-school"
        ? "/api/assets/legacy/assets/social/back-to-school.png"
        : "")
  );
}
export const brandingVisibility = {
  neptun: "showNeptunLogo",
  event: "showEventLogo",
  custom: "showCustomLogo",
} as const;
export function chooseSocialBranding(
  post: SocialPost,
  kind: SocialBrandingKind,
  source: string,
) {
  post[brandingVisibility[kind]] = true;
  if (kind === "neptun") post.neptunLogoUpload = source;
  else if (kind === "event") post.eventLogoUpload = source;
  else post.customLogo = source;
}
