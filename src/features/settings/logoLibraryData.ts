import { LOGO_ROLES } from "./options";
export const logoRuleDefaults = [
  {
    id: "builtin-cover",
    name: "NEPTUN · original cover",
    url: "/api/assets/legacy/assets/neptun-cover-logo.png",
  },
  {
    id: "builtin-framed",
    name: "NEPTUN · framed",
    url: "/api/assets/legacy/assets/neptun-logo-framed.png",
  },
  ...LOGO_ROLES.map((role) => ({
    id: `builtin-${role.id}`,
    name: role.label,
    url: role.image,
  })),
];
