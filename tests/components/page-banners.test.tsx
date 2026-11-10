import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { PageArtwork } from "../../src/features/brochure/PageArtwork";
import {
  BannerImageFields,
  PageBannerFields,
} from "../../src/features/brochure/PageBannerFields";
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

it("edits an image banner overlay independently and removes it without replacing the source photo", () => {
  setLanguage("en");
  let banner: Artwork = {
    id: "image",
    type: "image",
    layoutRole: "banner",
    image: "/photo.jpg",
    x: 0,
    y: 0,
    width: 100,
    height: 25,
  };
  const update = (change: Partial<Artwork>) => {
    banner = { ...banner, ...change };
  };
  const view = render(<BannerImageFields artwork={banner} onChange={update} />);
  fireEvent.click(view.getByRole("button", { name: "Gradient" }));
  view.rerender(<BannerImageFields artwork={banner} onChange={update} />);
  fireEvent.change(view.getByRole("slider", { name: "Overlay opacity" }), {
    target: { value: "65" },
  });
  expect(banner.image).toBe("/photo.jpg");
  expect(banner.bannerOverlay).toMatchObject({
    type: "gradient",
    opacity: 0.65,
  });
  view.rerender(<BannerImageFields artwork={banner} onChange={update} />);
  expect(
    view.container.querySelector<HTMLElement>(".page-banner-image-overlay")
      ?.style.opacity,
  ).toBe("0.65");
  fireEvent.click(view.getByRole("button", { name: "None" }));
  expect(banner.bannerOverlay).toBeUndefined();
  expect(banner.image).toBe("/photo.jpg");
});

it("exports a clipped image overlay over the banner while keeping the original image and opacity separate", () => {
  const view = render(
    <PageArtwork
      campaign={{
        pageArtworks: {
          cover: [
            {
              id: "image",
              type: "image",
              layoutRole: "banner",
              image: "/base.jpg",
              x: 0,
              y: 0,
              width: 100,
              height: 100,
              opacity: 0.9,
              bannerOverlay: {
                type: "image",
                image: "/texture.png",
                opacity: 0.3,
              },
            },
          ],
        },
      }}
      pageKey="cover"
    />,
  );
  const base = view.container.querySelector('img[src="/base.jpg"]');
  const overlay = view.container.querySelector<HTMLElement>(
    ".page-banner-image-overlay",
  )!;
  expect(base).toBeTruthy();
  expect(overlay.querySelector("img")?.getAttribute("src")).toBe(
    "/texture.png",
  );
  expect(overlay.style.opacity).toBe("0.3");
  expect(
    base?.closest<HTMLElement>(".page-banner-artwork")?.style.opacity,
  ).toBe("0.9");
});
