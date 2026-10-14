import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { NeptunWordmark } from "../../src/features/brochure/NeptunWordmark";
import { resolveAsset } from "../../src/api/client";

afterEach(cleanup);

it("preserves the original footer artwork and light/dark treatment", () => {
  const view = render(<NeptunWordmark />);
  const image = view.getByRole("img", { name: "NEPTUN" });
  expect(image.getAttribute("src")).toBe(resolveAsset("/api/assets/app/logo"));
  expect(image.parentElement?.className).toBe("neptun-wordmark light");
  view.rerender(<NeptunWordmark dark />);
  expect(image.parentElement?.className).toBe("neptun-wordmark dark");
});

it("uses the brochure's framed logo without applying the original wordmark coloring", () => {
  const view = render(
    <NeptunWordmark campaign={{ neptunLogoOption: "framed" }} />,
  );
  const image = view.getByRole("img", { name: "NEPTUN" });
  expect(image.getAttribute("src")).toBe(
    resolveAsset("/api/assets/legacy/assets/neptun-logo-framed.png"),
  );
  expect(image.parentElement?.className).toBe("neptun-wordmark artwork");
});

it("lets brochure artwork override the framed preset and retains the uploaded artwork's colors", () => {
  const source = "/api/assets/12345678-1234-4234-8234-123456789012";
  const view = render(
    <NeptunWordmark
      dark
      campaign={{ neptunLogoOption: "framed", brandAssets: { neptun: source } }}
    />,
  );
  const image = view.getByRole("img", { name: "NEPTUN" });
  expect(image.getAttribute("src")).toBe(resolveAsset(source));
  expect(image.parentElement?.className).toBe("neptun-wordmark artwork");
});
