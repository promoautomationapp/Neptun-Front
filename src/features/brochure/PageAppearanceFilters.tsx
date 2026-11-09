import type { Campaign } from "../../domain/models";
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
  if (!hasPageAppearance(campaign, kind, page)) return null;
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      className="page-appearance-filters"
    >
      <defs>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feFlood
            floodColor={resolvedPageAppearance(campaign, kind, page).brandColor}
          />
          <feComposite in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
