import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { PageArtwork } from "../../src/features/brochure/PageArtwork";
import { PageBannerFields } from "../../src/features/brochure/PageBannerFields";
import { PageBannerMenu } from "../../src/features/brochure/PageBannerMenu";
import { setLanguage } from "../../src/features/brochure/i18n";
import type { Artwork, Campaign } from "../../src/domain/models";

afterEach(cleanup);

it("keeps the clean Black Friday heading when adding a banner and places the banner below it", async () => {
  setLanguage("en");
  const campaign: Campaign = {
    id: "clean-banner",
    name: "Black collection",
    brochureReferenceDesign: "black-collection",
    products: [],
  };
  const view = render(
    <PageBannerMenu
      campaign={campaign}
      pageKey="product-0"
      onUpdate={(mutate) => mutate(campaign)}
    />,
  );
  fireEvent.click(view.getByLabelText("Add page banner"));
  fireEvent.click(await view.findByRole("button", { name: /Colored banner/ }));
  const layers = campaign.pageArtworks!["product-0"]!;
  expect(
    layers.find((layer) => layer.id === "black-collection-heading")?.text,
  ).toBe("BLACK \nFRIDAY");
  expect(
    layers.find((layer) => layer.layoutRole === "banner")?.y,
  ).toBeGreaterThan(5.7);
});

it("renders an editable independent banner frame and leaves hidden artwork out of preview/export", () => {
  setLanguage("en");
  const banner: Artwork = {
    id: "banner",
    type: "text",
    layoutRole: "banner",
    x: 1,
    y: 1,
    width: 98,
    height: 7,
    text: "An editable title",
    color: "#ffffff",
    backgroundColor: "#ff3b1f",
  };
  const view = render(
    <PageArtwork
      campaign={{
        pageArtworks: {
          cover: [
            banner,
            { ...banner, id: "hidden", text: "Hidden", hidden: true },
          ],
        },
      }}
      pageKey="cover"
      onChange={() => {}}
      onRemove={() => {}}
    />,
  );
  const text = view.getByRole("textbox", { name: "Edit page text" });
  expect(text.textContent).toBe("An editable title");
  expect(view.queryByText("Hidden")).toBeNull();
  const frame = text.closest<HTMLElement>(".page-banner-artwork")!;
  expect(frame.style.background).toBe("rgb(255, 59, 31)");
  expect(frame.style.height).toBe("7%");
  fireEvent.focus(text);
  expect(view.getByRole("spinbutton", { name: "Banner height" })).toBeTruthy();
});

it("edits banner width, height and transparent fill directly from the small toolbar", () => {
  setLanguage("en");
  const changes: Partial<Artwork>[] = [];
  const view = render(
    <PageBannerFields
      artwork={{
        id: "banner",
        x: 0,
        y: 0,
        width: 98,
        height: 7,
        backgroundColor: "#ff3b1f",
      }}
      onChange={(value) => changes.push(value)}
    />,
  );
  fireEvent.change(view.getByRole("spinbutton", { name: "Banner width" }), {
    target: { value: "70" },
  });
  fireEvent.change(view.getByRole("spinbutton", { name: "Banner height" }), {
    target: { value: "12" },
  });
  fireEvent.click(
    view.getByRole("button", { name: "Transparent banner background" }),
  );
  expect(changes).toEqual([
    { width: 70 },
    { height: 12 },
    { backgroundColor: "#00000000" },
  ]);
});
