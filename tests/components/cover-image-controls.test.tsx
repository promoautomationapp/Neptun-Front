import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Campaign, CampaignMutator } from "../../src/domain/models";
import { ActionMenu } from "../../src/features/brochure/ActionMenu";
import { CoverImageControls } from "../../src/features/brochure/CoverImageControls";
import { setLanguage } from "../../src/features/brochure/i18n";

vi.mock("../../src/features/brochure/lifestyleImageApi", () => ({
  lifestyleQuota: vi.fn(async () => ({
    month: "2026-10",
    used: 0,
    limit: 20,
    attempts: 0,
    attemptLimit: 30,
  })),
  generateLifestyle: vi.fn(),
  acceptLifestyle: vi.fn(),
}));
afterEach(cleanup);

it("keeps the cover editor available after its menu closes and preserves existing image placement", async () => {
  setLanguage("en");
  const placement = {
    id: "cover-lifestyle",
    type: "image" as const,
    image: "/cover.png",
    x: 7,
    y: 12,
    width: 76,
    height: 38,
    rotation: 4,
    imageFit: "contain" as const,
  };
  const campaign = {
    id: "image-control",
    products: [],
    showCoverBand: true,
    coverImage: "/cover.png",
    pageArtworks: { cover: [placement] },
  } as unknown as Campaign;
  const update = vi.fn((mutate: CampaignMutator) => mutate(campaign));
  const view = render(
    <ActionMenu label="Images">
      <CoverImageControls campaign={campaign} onUpdate={update} />
    </ActionMenu>,
  );
  const menu = view.container.querySelector("details")!;
  fireEvent.click(view.getByText("Images"));
  fireEvent.click(view.getByRole("button", { name: "Cover image" }));
  await view.findByRole("dialog");
  expect(menu.open).toBe(false);
  expect(view.getByAltText("Full image preview").getAttribute("src")).toBe(
    "/cover.png",
  );
  fireEvent.click(view.getByRole("button", { name: "Use this image" }));
  await waitFor(() => expect(update).toHaveBeenCalledOnce());
  expect(campaign.pageArtworks?.cover).toHaveLength(1);
  expect(campaign.pageArtworks?.cover?.[0]).toMatchObject(placement);
  await waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
});
