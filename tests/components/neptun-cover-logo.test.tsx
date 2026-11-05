import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CoverPage } from "../../src/features/brochure/Brochure";
import { builtinCoverLogo } from "../../src/features/brochure/NeptunCoverLogo";

afterEach(cleanup);
const source = "/api/assets/12345678-1234-4234-8234-123456789012";

it("shows only the built-in frame and one editable tagline below its blank red bar", () => {
  const view = render(
    <CoverPage
      campaign={{
        id: "logo",
        name: "Offers",
        products: [],
        coverLogoStyle: "original",
        coverLogoSource: source,
        coverBandVariant: "hajde",
      }}
    />,
  );
  const logo = view.container.querySelector<HTMLElement>(
    ".cover-element-logo",
  )!;
  const tagline = view.container.querySelector<HTMLElement>(
    ".cover-element-brand-tagline",
  )!;
  expect(
    logo.querySelector('[data-builtin-cover-logo="original"]'),
  ).not.toBeNull();
  expect(logo.querySelector("img")?.getAttribute("src")).toBe(source);
  expect(view.getAllByText("Jeto më mirë, çdo ditë.")).toHaveLength(1);
  expect(Number.parseFloat(tagline.style.top)).toBeGreaterThan(10.18);
  expect(logo.querySelector("em")).toBeNull();
});

it("preserves a custom upload and a deliberately moved tagline", () => {
  const view = render(
    <CoverPage
      campaign={{
        id: "custom",
        name: "Offers",
        products: [],
        coverLogoStyle: "custom",
        coverLogoSource: source,
        coverBandVariant: "hajde",
        coverElementPlacements: {
          "brand-tagline": { x: 12, y: 20, width: 24 },
        },
      }}
    />,
  );
  expect(view.container.querySelector("[data-builtin-cover-logo]")).toBeNull();
  expect(
    view.container.querySelector<HTMLElement>(".cover-element-brand-tagline")
      ?.style.top,
  ).toBe("20%");
});

it("recognizes saved built-in aliases but leaves the clean native SVG and rule overrides alone", () => {
  expect(
    builtinCoverLogo({}, "/api/assets/legacy/assets/neptun-logo-framed.png"),
  ).toBe("framed");
  expect(
    builtinCoverLogo({}, "/brochure-presets/october/neptun-cover.svg"),
  ).toBeNull();
  expect(
    builtinCoverLogo(
      { coverLogoSource: source, coverLogoStyle: "original" },
      "/custom-rule.svg",
    ),
  ).toBeNull();
});
