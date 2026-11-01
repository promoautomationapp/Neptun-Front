import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { Campaign } from "../../src/domain/models";
import { StoresPage } from "../../src/features/brochure/Brochure";
import {
  applyBrochurePreset,
  availableBrochurePresets,
} from "../../src/features/brochure/brochurePresets";
import { pageBackgroundReadability } from "../../src/features/brochure/pageBackground";
import { resolveSettings } from "../../src/features/settings/settings.schema";

function campaignFor(id: string) {
  const settings = resolveSettings(null);
  const campaign: Campaign = { id: "stores", name: "Stores", products: [] };
  applyBrochurePreset(
    campaign,
    availableBrochurePresets(settings).find((preset) => preset.id === id)!,
  );
  return { campaign, settings };
}
function markup(campaign: Campaign) {
  const root = document.createElement("div");
  root.innerHTML = renderToStaticMarkup(
    <StoresPage campaign={campaign} settings={resolveSettings(null)} />,
  );
  return root;
}

describe("reference stores back page", () => {
  it.each(["neptun-current", "neptun-gradient-all"])(
    "%s uses the blue back page with white logos and complete phone fields",
    (id) => {
      const { campaign, settings } = campaignFor(id);
      const page = markup(campaign);
      expect(
        page.querySelector(".stores-brand-reference.stores-blue"),
      ).not.toBeNull();
      expect(
        page
          .querySelector(".brochure-format-background-image")
          ?.getAttribute("src"),
      ).toBe("/brochure-presets/unified/stores-background.svg");
      expect(page.querySelector(".stores-hajde img")?.getAttribute("src")).toBe(
        "/brochure-presets/october/hajde-white.svg",
      );
      expect(
        page.querySelector(".stores-service img")?.getAttribute("src"),
      ).toBe("/brochure-presets/october/service-white.svg");
      expect(
        page.querySelector(".stores-balfin img")?.getAttribute("src"),
      ).toBe("/brochure-presets/october/balfin-white.svg");
      expect(page.querySelector(".stores-service")?.textContent).toContain(
        "+381 38 714 444\n+381 38 715 555",
      );
      expect(pageBackgroundReadability(campaign, "stores").needsSurface).toBe(
        false,
      );
      expect(
        Array.from(page.querySelectorAll(".store-phone")).map(
          (node) => node.textContent,
        ),
      ).toEqual([
        ...settings.stores.map((store) => store.phone),
        settings.contact.onlinePhone,
      ]);
      expect(
        page.querySelectorAll(".brochure-awards .award-badge"),
      ).toHaveLength(2);
      expect(
        page.querySelector<HTMLElement>('[data-store-element="awards"]')?.style
          .width,
      ).toBe("19.7%");
      expect(
        page.querySelector<HTMLElement>('[data-store-element="locations"]')
          ?.style.top,
      ).toBe("24.2%");
    },
  );

  it("retains saved positions, store visibility, replacement logos and custom background images", () => {
    const { campaign } = campaignFor("neptun-gradient-all");
    campaign.storesElementPlacements = {
      heading: { x: 5, y: 6, width: 60, height: 7 },
      awards: { x: 65, y: 8, width: 30, height: 9 },
    };
    campaign.selectedStoreIndexes = [2];
    campaign.brandAssets!.storesHajde = "/my-team-logo.svg";
    campaign.storesBackgroundImage = "/my-background.svg";
    const page = markup(campaign);
    expect(
      page.querySelector<HTMLElement>('[data-store-element="heading"]')?.style
        .left,
    ).toBe("5%");
    expect(
      page.querySelector<HTMLElement>('[data-store-element="awards"]')?.style
        .width,
    ).toBe("30%");
    expect(page.querySelector(".stores-hajde img")?.getAttribute("src")).toBe(
      "/my-team-logo.svg",
    );
    expect(page.querySelectorAll(".stores-card-wrapper")).toHaveLength(2);
    expect(
      page
        .querySelector(".brochure-format-background-image")
        ?.getAttribute("src"),
    ).toBe("/my-background.svg");
    expect(pageBackgroundReadability(campaign, "stores").needsSurface).toBe(
      true,
    );
  });

  it("keeps transparent corners on the actual BestBuy and QUDAL artwork files", () => {
    for (const name of ["bestbuy", "qudal"]) {
      const bytes = readFileSync(`public/brochure-presets/october/${name}.png`);
      expect(bytes[25]).toBe(6); // RGBA PNG, rather than an opaque white rectangle.
      const chunks: Buffer[] = [];
      for (let offset = 8; offset < bytes.length;) {
        const length = bytes.readUInt32BE(offset);
        if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT")
          chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
        offset += length + 12;
      }
      const firstRow = inflateSync(Buffer.concat(chunks));
      // For the first pixel, the PNG filter's preceding and upper pixels are zero.
      expect(firstRow[4]).toBe(0);
    }
  });
});
