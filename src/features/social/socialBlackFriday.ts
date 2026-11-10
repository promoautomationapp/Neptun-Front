import type { Campaign, SocialPost } from "../../domain/models";
import { isBlackFridayBrochure } from "../brochure/blackFridayDesign";

export const BLACK_FRIDAY_SOCIAL_TEMPLATE = "black-friday";
export const BLACK_FRIDAY_SOCIAL_HEADING = "social-black-friday-heading";
export const BLACK_FRIDAY_SOCIAL_LOGO =
  "/brochure-presets/black-friday/cover-logo.png";

export function isBlackFridayCampaign(campaign: Campaign | null) {
  return Boolean(
    campaign &&
    (isBlackFridayBrochure(campaign) ||
      /\bblack[\s-]*friday\b|\bbf\b/i.test(
        `${campaign.name} ${campaign.type || ""}`,
      )),
  );
}

/** This is a reusable design, not a baked campaign image. Staff retain their
 * products and layers; its heading is ordinary editable, rotatable text. */
export function applyBlackFridaySocialDesign(post: SocialPost): SocialPost {
  post.template = BLACK_FRIDAY_SOCIAL_TEMPLATE;
  post.background = { ...post.background, type: "solid", color: "#000000" };
  post.showNeptunLogo = true;
  post.logoVariant = "white";
  post.logoLayout = "corner";
  post.logoPosition = "top-left";
  post.logoScale = 180;
  post.neptunLogoUpload ||= BLACK_FRIDAY_SOCIAL_LOGO;
  if (post.logoCoords) delete post.logoCoords.neptun;
  post.showEventLogo = false;
  post.artworks ||= [];
  if (
    !post.artworks.some((artwork) => artwork.id === BLACK_FRIDAY_SOCIAL_HEADING)
  )
    post.artworks.push({
      id: BLACK_FRIDAY_SOCIAL_HEADING,
      name: "BLACK FRIDAY",
      type: "text",
      text: "BLACK\nFRIDAY",
      x: 75,
      y: 4,
      width: 20,
      height: 9,
      fontFamily: "Cera Pro",
      fontSize: 3.8,
      fontWeight: 900,
      color: "#ffffff",
      rotation: -6,
      lineHeight: 0.9,
      textAlign: "center",
      whiteSpace: "pre-wrap",
    });
  return post;
}
