import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrochureZoomControls } from "../../src/features/brochure/BrochureZoomControls";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function fixture() {
  const view = render(
    <div className="cs-page-preview">
      <BrochureZoomControls />
      <div className="cs-preview-viewport">
        <div className="cs-preview-paper">Page artwork</div>
      </div>
      <div data-testid="outside">Outside the canvas</div>
    </div>,
  );
  const surface =
    view.container.querySelector<HTMLElement>(".cs-page-preview")!;
  const viewport = view.container.querySelector<HTMLElement>(
    ".cs-preview-viewport",
  )!;
  const paper = view.container.querySelector<HTMLElement>(".cs-preview-paper")!;
  Object.defineProperties(viewport, {
    clientHeight: { value: 400 },
    clientWidth: { value: 500 },
    scrollHeight: { value: 1500 },
  });
  vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 500, 400),
  );
  vi.spyOn(paper, "getBoundingClientRect").mockImplementation(() => {
    const zoom =
      Number(surface.style.getPropertyValue("--brochure-preview-zoom")) || 1;
    return new DOMRect(
      -viewport.scrollLeft,
      -viewport.scrollTop,
      500 * zoom,
      625 * zoom,
    );
  });
  return { ...view, surface, viewport, paper };
}
function wheel(target: HTMLElement, deltaY: number, ctrlKey = false) {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ctrlKey,
    deltaY,
    clientX: 200,
    clientY: 100,
  });
  fireEvent(target, event);
  return event;
}
function gesture(target: HTMLElement, type: string, scale?: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    scale: { value: scale },
    clientX: { value: 200 },
    clientY: { value: 100 },
  });
  fireEvent(target, event);
  return event;
}

it("leaves normal two-finger scrolling and browser gestures outside the canvas alone", () => {
  const view = fixture();
  expect(wheel(view.viewport, 80).defaultPrevented).toBe(false);
  expect(wheel(view.getByTestId("outside"), -40, true).defaultPrevented).toBe(
    false,
  );
  expect(view.getByRole("status").textContent).toBe("100%");
});

it("zooms only a ctrl-wheel pinch and retains the artwork point underneath the gesture", () => {
  const view = fixture();
  view.viewport.scrollLeft = 19;
  view.viewport.scrollTop = 37;
  const before = { x: (200 + 19) / 500, y: (100 + 37) / 625 };
  expect(wheel(view.viewport, -20, true).defaultPrevented).toBe(true);
  expect(view.getByRole("status").textContent).toBe("122%");
  expect(view.surface.style.getPropertyValue("--brochure-preview-zoom")).toBe(
    "1.22",
  );
  expect((200 + view.viewport.scrollLeft) / 610).toBeCloseTo(before.x);
  expect((100 + view.viewport.scrollTop) / 762.5).toBeCloseTo(before.y);
  fireEvent.click(view.getByRole("button", { name: "Zoom out" }));
  expect(view.getByRole("status").textContent).toBe("97%");
});

it("accumulates small pinch deltas and clamps repeated gestures to the supported zoom bounds", () => {
  const view = fixture();
  act(() => {
    for (let i = 0; i < 10; i++) wheel(view.viewport, -0.1, true);
  });
  expect(view.getByRole("status").textContent).toBe("101%");
  wheel(view.viewport, -500, true);
  expect(view.getByRole("status").textContent).toBe("200%");
  expect(view.getByRole("button", { name: "Zoom in" })).toHaveProperty(
    "disabled",
    true,
  );
  wheel(view.viewport, 500, true);
  expect(view.getByRole("status").textContent).toBe("25%");
  expect(view.getByRole("button", { name: "Zoom out" })).toHaveProperty(
    "disabled",
    true,
  );
});

it("supports Safari pinch scale events without also applying duplicate wheel deltas", () => {
  const view = fixture();
  expect(gesture(view.viewport, "gesturestart", 1).defaultPrevented).toBe(true);
  expect(gesture(view.viewport, "gesturechange", 1.5).defaultPrevented).toBe(
    true,
  );
  expect(view.getByRole("status").textContent).toBe("150%");
  wheel(view.viewport, -20, true);
  expect(view.getByRole("status").textContent).toBe("150%");
  expect(gesture(view.viewport, "gestureend", 1.5).defaultPrevented).toBe(true);
  wheel(view.viewport, 10, true);
  expect(view.getByRole("status").textContent).toBe("136%");
  expect(wheel(view.viewport, 80).defaultPrevented).toBe(false);
});
