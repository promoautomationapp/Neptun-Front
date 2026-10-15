import { expect, it } from "vitest";
import { logoForBackground } from "../../src/features/settings/logo-rules";
import {
  resolveSettings,
  workspaceSettingsSchema,
} from "../../src/features/settings/settings.schema";
import { campaignDefaults } from "../../src/features/settings/campaign-defaults";
it("keeps reference logos until a rule is chosen, prioritizes exact colors and snapshots every choice", () => {
  const settings = resolveSettings(null),
    fallback = settings.brochure.coverLogoSource;
  expect(logoForBackground({}, "cover", "#1c4075", fallback)).toBe(fallback);
  settings.logoRules = [
    {
      id: "dark",
      target: "both",
      background: "dark",
      color: "",
      image: "/api/assets/legacy/assets/white.png",
      enabled: true,
    },
    {
      id: "blue",
      target: "cover",
      background: "color",
      color: "#1C4075",
      image: "/api/assets/legacy/assets/blue.png",
      enabled: true,
    },
  ];
  const campaign = campaignDefaults(settings);
  settings.logoRules[0]!.image = "/api/assets/legacy/assets/later.png";
  expect(logoForBackground(campaign, "cover", "#1c4075", fallback)).toBe(
    "/api/assets/legacy/assets/blue.png",
  );
  expect(logoForBackground(campaign, "pages", "#111111", fallback)).toBe(
    "/api/assets/legacy/assets/white.png",
  );
  expect(logoForBackground(campaign, "cover", "#ffffff", fallback)).toBe(
    fallback,
  );
  expect(
    logoForBackground(
      { ...campaign, coverLogoSource: "/api/assets/legacy/assets/manual.png" },
      "cover",
      "#1c4075",
      "/api/assets/legacy/assets/manual.png",
    ),
  ).toBe("/api/assets/legacy/assets/manual.png");
});
it("rejects an unowned external logo or an incomplete color choice", () => {
  expect(
    workspaceSettingsSchema.safeParse({
      logoRules: [
        {
          id: "1",
          target: "both",
          background: "color",
          color: "",
          image: "/api/assets/app/logo",
        },
      ],
    }).success,
  ).toBe(false);
  expect(
    workspaceSettingsSchema.safeParse({
      logoRules: [
        {
          id: "1",
          target: "both",
          background: "dark",
          color: "",
          image: "https://external.example/logo.png",
        },
      ],
    }).success,
  ).toBe(false);
});
