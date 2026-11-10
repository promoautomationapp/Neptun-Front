import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DetailsPlacementChoices } from "../../src/features/brochure/DetailsPlacementChoices";
import { ProductLayoutControls } from "../../src/features/brochure/ProductLayoutControls";
import { setLanguage } from "../../src/features/brochure/i18n";

afterEach(cleanup);
it("offers compact left/right/bottom choices with a clear selected state", () => {
  setLanguage("en");
  const change = vi.fn();
  const view = render(
    <DetailsPlacementChoices value="left" onChange={change} />,
  );
  expect(
    view
      .getByRole("button", { name: "Left of image" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(view.getByRole("button", { name: "Right of image" }));
  expect(change).toHaveBeenLastCalledWith("right");
  fireEvent.click(view.getByRole("button", { name: "Below image" }));
  expect(change).toHaveBeenLastCalledWith("bottom");
});
it("changes only the layout choice, keeping saved photo and individual block coordinates authoritative", () => {
  setLanguage("en");
  const change = vi.fn();
  const view = render(
    <ProductLayoutControls
      product={{
        code: "phone",
        name: "Galaxy A37",
        detailPlacement: "left",
        brochureImagePlacement: { x: 42, y: 45, scale: 1.1 },
        detailBlockPlacements: { memory: { x: 3, y: -1 } },
      }}
      campaign={{ offerStyle: "card" }}
      onChange={change}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: "Right of image" }));
  expect(change).toHaveBeenCalledExactlyOnceWith("detailPlacement", "right");
});
