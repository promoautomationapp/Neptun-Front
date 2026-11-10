import type { Campaign } from "../../domain/models";
import { BrandLogoTintFilter } from "./BrandLogoTintFilter";
import { validBackgroundColor } from "./pageBackground";
import {
  hasPageAppearance,
  resolvedPageAppearance,
  type AppearancePage,
  type PageAppearanceKind,
} from "./pageAppearance";
/** Recolors the alpha of existing transparent logos. No generated assets or
 * network calls are needed when switching colors, including in exported pages. */
export function PageAppearanceFilters({
  campaign,
  kind,
  page,
  id,
}: {
  campaign: Partial<Campaign>;
  kind: PageAppearanceKind;
  page?: AppearancePage;
  id: string;
}) {
  if (
    !hasPageAppearance(campaign, kind, page) &&
    !validBackgroundColor(campaign.brandLogoColor)
  )
    return null;
  return (
    <BrandLogoTintFilter
      id={id}
      color={resolvedPageAppearance(campaign, kind, page).brandColor}
    />
  );
}
