import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CoverElement } from "../../src/features/brochure/CoverElement";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);
const placement = { x: 4, y: 8, width: 70, height: 35, hidden: true };

it.each(["campaign-photo", "october-hajde", "october-awards", "custom-layer"])(
  "omits hidden %s from preview/export, including its editing and file controls",
  (kind) => {
    const view = render(
      <CoverElement
        campaign={{ coverElementPlacements: { [kind]: placement } }}
        kind={kind}
        onHide={vi.fn()}
        onReplaceFile={vi.fn()}
      >
        <img src="/art.png" alt="Cover artwork" />
      </CoverElement>,
    );
    expect(view.container.childElementCount).toBe(0);
  },
);

it("offers a small export-hidden restore control and preserves placement when restored", () => {
  const change = vi.fn();
  const view = render(
    <CoverElement
      campaign={{ coverElementPlacements: { "campaign-photo": placement } }}
      kind="campaign-photo"
      onChange={change}
    >
      <img src="/art.png" alt="Cover photograph" />
    </CoverElement>,
  );
  const restore = view.getByRole("button", {
    name: "Restore Cover photograph",
  });
  expect(restore.getAttribute("data-export-hide")).toBe("true");
  expect(view.queryByAltText("Cover photograph")).toBeNull();
  fireEvent.click(restore);
  expect(change).toHaveBeenCalledOnce();
  expect(change).toHaveBeenCalledWith("campaign-photo", {
    ...placement,
    hidden: false,
  });
  expect(view.getByAltText("Cover photograph")).toBeTruthy();
  expect(
    view.queryByRole("button", { name: "Restore Cover photograph" }),
  ).toBeNull();
  const element = view.container.querySelector<HTMLElement>(
    ".cover-element-campaign-photo",
  )!;
  expect(element.style.left).toBe("4%");
  expect(element.style.top).toBe("8%");
  expect(element.style.width).toBe("70%");
  expect(element.style.height).toBe("35%");
});

it("reflects a new hidden saved placement and keeps its restoration reachable near the page edge", () => {
  const change = vi.fn();
  const view = render(
    <CoverElement
      campaign={{}}
      kind="october-awards"
      onChange={change}
      defaultPlacement={{ x: 70, y: 90, width: 20, height: 6 }}
    >
      Awards
    </CoverElement>,
  );
  expect(view.getByText("Awards")).toBeTruthy();
  view.rerender(
    <CoverElement
      campaign={{
        coverElementPlacements: {
          "october-awards": { ...placement, x: 99, y: 99 },
        },
      }}
      kind="october-awards"
      onChange={change}
      defaultPlacement={{ x: 70, y: 90, width: 20, height: 6 }}
    >
      Awards
    </CoverElement>,
  );
  const restore = view.getByRole("button", { name: "Restore Awards" });
  expect(restore.style.left).toBe("80%");
  expect(restore.style.top).toBe("94%");
  expect(view.container.querySelector(".cover-editable-element")).toBeNull();
});

it("scales cover text relative to the preset width rather than the previously saved width", () => {
  const view = render(
    <CoverElement
      kind="message"
      campaign={{
        showCoverBand: false,
        coverElementPlacements: { message: { x: 10, y: 25, width: 40 } },
      }}
    >
      Message
    </CoverElement>,
  );
  const scale = () =>
    view.container
      .querySelector<HTMLElement>(".cover-element-message")!
      .style.getPropertyValue("--cover-text-scale");
  expect(Number(scale())).toBe(0.5);
  view.rerender(
    <CoverElement
      kind="message"
      campaign={{
        showCoverBand: false,
        coverElementPlacements: { message: { x: 10, y: 25, width: 120 } },
      }}
    >
      Message
    </CoverElement>,
  );
  expect(Number(scale())).toBe(1.5);
  view.rerender(
    <CoverElement
      kind="message"
      campaign={{
        coverElementPlacements: { message: { width: 98 } },
      }}
      defaultPlacement={{ x: 47, y: 39, width: 49, height: 7 }}
    >
      Message
    </CoverElement>,
  );
  expect(Number(scale())).toBe(2);
});
