/** Recolors existing transparent artwork locally, including exported pages. */
export function BrandLogoTintFilter({
  id,
  color,
}: {
  id: string;
  color: string;
}) {
  return (
    <svg
      width="0"
      height="0"
      aria-hidden="true"
      className="page-appearance-filters"
    >
      <defs>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feFlood floodColor={color} />
          <feComposite in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
