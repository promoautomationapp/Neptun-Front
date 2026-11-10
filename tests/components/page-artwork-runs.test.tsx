import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Artwork } from "../../src/domain/models";
import { PageArtwork } from "../../src/features/brochure/PageArtwork";
import { campaignSchema } from "../../src/domain/schemas";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(cleanup);
const artwork: Artwork = {
  id: "percent",
  type: "text",
  x: 1,
  y: 1,
  width: 15,
  text: "25%",
  fontSize: 8,
  textRuns: [
    { text: "25", fontScale: 1 },
    { text: "%", fontScale: 38.96 / 66.83, verticalAlign: "super" },
  ],
};

it("renders the printed superscript percent and clears run formatting after plain-text editing", () => {
  setLanguage("en");
  const change = vi.fn();
  const campaign = {
    id: "bf",
    name: "BF",
    products: [],
    pageArtworks: { cover: [artwork] },
  };
  expect(
    campaignSchema.parse(campaign).pageArtworks!.cover![0]!.textRuns,
  ).toEqual(artwork.textRuns);
  const view = render(
    <PageArtwork campaign={campaign} pageKey="cover" onChange={change} />,
  );
  const runs =
    view.container.querySelectorAll<HTMLElement>(".page-text-runs em");
  expect(runs).toHaveLength(2);
  expect(runs[1]!.style.verticalAlign).toBe("super");
  expect(parseFloat(runs[1]!.style.fontSize)).toBeCloseTo(38.96 / 66.83);
  expect(runs[0]!.style.fontStyle).toBe("normal");
  const input = view.getByRole("textbox", { name: "Edit page text" });
  input.textContent = "30%";
  fireEvent.blur(input);
  expect(change).toHaveBeenLastCalledWith(
    "percent",
    expect.objectContaining({ text: "30%", textRuns: undefined }),
  );
});

it("ignores stale runs when the visible text differs and rejects unbounded font scales", () => {
  const view = render(
    <PageArtwork
      campaign={{ pageArtworks: { cover: [{ ...artwork, text: "30%" }] } }}
      pageKey="cover"
    />,
  );
  expect(view.container.textContent).toBe("30%");
  expect(view.container.querySelector(".page-text-runs")).toBeNull();
  expect(
    campaignSchema.safeParse({
      id: "bf",
      name: "BF",
      products: [],
      pageArtworks: {
        cover: [{ ...artwork, textRuns: [{ text: "25%", fontScale: 1000 }] }],
      },
    }).success,
  ).toBe(false);
});

it("restores source inline formatting after canceling an in-place text edit", () => {
  setLanguage("en");
  const change = vi.fn();
  const view = render(
    <PageArtwork
      campaign={{ pageArtworks: { cover: [artwork] } }}
      pageKey="cover"
      onChange={change}
    />,
  );
  const input = view.getByRole("textbox", { name: "Edit page text" });
  input.textContent = "Unwanted edit";
  fireEvent.keyDown(input, { key: "Escape" });
  expect(view.container.querySelectorAll(".page-text-runs em")).toHaveLength(2);
  expect(view.container.querySelector(".page-layer-text")?.textContent).toBe(
    "25%",
  );
  expect(change).not.toHaveBeenCalled();
});
