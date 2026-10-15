import type { ReactNode } from "react";
import "./nav-icon.css";

const artwork: Record<string, ReactNode> = {
  campaigns: (
    <>
      <rect x="4" y="2.5" width="12" height="15" rx="1.5" />
      <path d="M7.5 2.5v15M10 6h3.5M10 9h3.5M10 12h3.5" />
    </>
  ),
  catalog: (
    <>
      <path d="m3.5 5.5 1.5-3h10l1.5 3M3.5 5.5h13v10.5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 16Z" />
      <path d="M7.5 9h5" />
    </>
  ),
  social: (
    <>
      <path d="M15 3H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2.5v3L12 14h3a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
      <path d="M6.5 7h7M6.5 10.5h4" />
    </>
  ),
  stores: (
    <>
      <path d="m8 2-.5 2a6.3 6.3 0 0 0-1.3.8l-2-.5-1.9 3.4 1.5 1.4a6.3 6.3 0 0 0 0 1.8L2.3 12l1.9 3.4 2-.5a6.3 6.3 0 0 0 1.3.8l.5 2h4l.5-2a6.3 6.3 0 0 0 1.3-.8l2 .5 1.9-3.4-1.5-1.3a6.3 6.3 0 0 0 0-1.8l1.5-1.4-1.9-3.4-2 .5a6.3 6.3 0 0 0-1.3-.8L12 2Z" />
      <circle cx="10" cy="10" r="2.5" />
    </>
  ),
  users: (
    <>
      <circle cx="7.5" cy="6.5" r="2.5" />
      <path d="M2.5 17v-1.5a5 5 0 0 1 10 0V17M13 4a2.5 2.5 0 0 1 0 5M15 12a4 4 0 0 1 2.5 3.7V17" />
    </>
  ),
  activity: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 5.5v5l3 2" />
    </>
  ),
  insights: (
    <>
      <path d="M2.5 2.5v15h15M6 13v-3M10 13V7M14 13V4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" />
      <circle cx="10" cy="10" r="2.5" />
    </>
  ),
  edit: (
    <>
      <path d="m3 13 9.5-9.5 4 4L7 17H3Z M10.5 5.5l4 4" />
    </>
  ),
  profile: (
    <>
      <path d="m10 2 6.5 2.5v5.2c0 3.6-2.7 6.7-6.5 8.3-3.8-1.6-6.5-4.7-6.5-8.3V4.5Z" />
      <circle cx="10" cy="8" r="2" />
      <path d="M6.8 14a3.4 3.4 0 0 1 6.4 0" />
    </>
  ),
  menu: <path d="M3.5 5h13M3.5 10h13M3.5 15h13" />,
  close: <path d="m5 5 10 10M15 5 5 15" />,
  copy: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M12.5 4V2.5h-10v10H4" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="3" width="14" height="4" rx="1" />
      <path d="M4.5 7v10h11V7M7.5 10h5" />
    </>
  ),
  trash: <path d="M3.5 5h13M7 5V2.5h6V5M5 5l.75 12.5h8.5L15 5M8 8v6M12 8v6" />,
  "arrow-right": <path d="M3.5 10h13M11.5 5l5 5-5 5" />,
  download: <path d="M10 2.5v10m-4-4 4 4 4-4M3 13.5v4h14v-4" />,
  search: (
    <>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m12.5 12.5 4.5 4.5" />
    </>
  ),
  filter: <path d="M3 3.5h14l-5 6v7l-4-2v-5Z" />,
  plus: <path d="M4 10h12M10 4v12" />,
  refresh: (
    <>
      <path d="M16.5 7.5A6.8 6.8 0 0 0 4.7 5.1L2.5 7.5M3.5 12.5a6.8 6.8 0 0 0 11.8 2.4l2.2-2.4" />
      <path d="M2.5 3.5v4h4M17.5 16.5v-4h-4" />
    </>
  ),
  check: <path d="m3.5 10 4.5 4.5 8.5-9" />,
  "chevron-down": <path d="m5 7.5 5 5 5-5" />,
};

/** Decorative navigation artwork; the enclosing button supplies its accessible name. */
export function NavIcon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      className="cs-nav-icon"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {artwork[name] || artwork.campaigns}
    </svg>
  );
}
