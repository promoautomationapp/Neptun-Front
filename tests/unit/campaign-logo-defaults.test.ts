import { expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import {
  campaignDefaults,
  repairDefaultType,
} from "../../src/features/settings/campaign-defaults";
import {
  resolveSettings,
  workspaceSettingsSchema,
} from "../../src/features/settings/settings.schema";
import { createPost } from "../../src/features/social/postModel";
const blackFridayLogo = "/api/assets/00000000-0000-4000-8000-000000000121";
const happyHourLogo = "/api/assets/00000000-0000-4000-8000-000000000122";
it("snapshots the selected campaign type logo as an independently editable cover image and reuses it in social posts", () => {
  const settings = resolveSettings(null);
  settings.campaignTypes[0]!.logo = blackFridayLogo;
  settings.campaignTypes[1]!.logo = happyHourLogo;
  const result = campaignDefaults(settings, 3, settings.campaignTypes[1]!.name);
  expect(result).toMatchObject({
    campaignLogo: happyHourLogo,
    defaultsVersion: 3,
    pageArtworks: {
      cover: [
        {
          name: `${settings.campaignTypes[1]!.name} logo`,
          image: happyHourLogo,
          x: 5,
          y: 22,
          width: 20,
        },
      ],
    },
  });
  const next = campaignDefaults(settings, 3, settings.campaignTypes[1]!.name);
  expect(result.pageArtworks?.cover?.[0]?.id).not.toBe(
    next.pageArtworks?.cover?.[0]?.id,
  );
  settings.campaignTypes[1]!.logo = blackFridayLogo;
  expect(result.campaignLogo).toBe(happyHourLogo);
  result.pageArtworks!.cover![0]!.width = 42;
  expect(next.pageArtworks?.cover?.[0]?.width).toBe(20);
  const social = createPost([], {
    ...result,
    id: "campaign",
    name: "Happy Hour",
    products: [],
  } as Campaign);
  expect(social.eventLogoUpload).toBe(happyHourLogo);
});
it("uses the configured default type only when no explicit type is selected and preserves no-logo campaigns", () => {
  const settings = resolveSettings(null);
  settings.campaignTypes[0]!.logo = blackFridayLogo;
  settings.campaignTypes[1]!.logo = happyHourLogo;
  settings.defaultCampaignTypeId = settings.campaignTypes[0]!.id;
  expect(campaignDefaults(settings).campaignLogo).toBe(blackFridayLogo);
  settings.campaignTypes[0]!.visible = false;
  repairDefaultType(settings);
  expect(campaignDefaults(settings).campaignLogo).toBe(happyHourLogo);
  settings.defaultCampaignTypeId = "";
  expect(campaignDefaults(settings)).not.toHaveProperty("campaignLogo");
  expect(
    campaignDefaults(settings, undefined, "Custom name"),
  ).not.toHaveProperty("pageArtworks");
});
it("round-trips per-type logos and rejects images outside authenticated project assets", () => {
  const settings = resolveSettings(null);
  settings.campaignTypes[0]!.logo = blackFridayLogo;
  expect(
    workspaceSettingsSchema.parse(JSON.parse(JSON.stringify(settings)))
      .campaignTypes[0]?.logo,
  ).toBe(blackFridayLogo);
  settings.campaignTypes[0]!.logo = "https://external.example/logo.png";
  expect(workspaceSettingsSchema.safeParse(settings).success).toBe(false);
});
