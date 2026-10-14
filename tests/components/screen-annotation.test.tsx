import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EditableScreenAnnotation } from "../../src/features/brochure/EditableScreenAnnotation";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("uses the ten-percent-smaller TV default while retaining the source rotated text and fade", () => {
  const { container } = render(<EditableScreenAnnotation product={{}} inches={55} type="television" style={{ left: 300, top: 40, width: 198 }} />);
  const label = container.querySelector<HTMLElement>(".screen-size-annotation")!;
  expect(label.style.transform).toBe("translate(-0.1851851851851852cqw,0.1851851851851852cqw) scale(0.9)");
  expect(label.style.transformOrigin).toBe("top right");
  expect(label.style.width).toBe("198px");
  const text = label.querySelector("text")!;
  expect(text.getAttribute("transform")).toBe("rotate(53 51.5 37)");
  expect(text.getAttribute("font-family")).toBe("TSTAR Headline,TSTAR,Arial,sans-serif");
  expect(label.querySelectorAll("defs stop")).toHaveLength(6);
});

it("preserves a manually placed sticker, including its prior 0.8 scale, and leaves non-TV guides at their original scale", () => {
  const { container, rerender } = render(<EditableScreenAnnotation product={{ screenAnnotationPlacement: { x: -1, y: 2, scale: 0.8 } }} inches={65} type="television" />);
  expect(container.querySelector<HTMLElement>(".screen-size-annotation")!.style.transform).toBe("translate(-1cqw,2cqw) scale(0.8)");
  rerender(<EditableScreenAnnotation product={{}} inches={10.1} type="other" />);
  expect(container.querySelector<HTMLElement>(".screen-size-annotation")!.style.transform).toBe("translate(0cqw,0cqw) scale(1)");
  expect(container.querySelectorAll("text")[1]?.textContent).toBe("INCH");
});

it("starts a drag from the new default without a jump, and cancellation restores it without saving", () => {
  vi.stubGlobal("PointerEvent", MouseEvent);
  const onChange = vi.fn();
  const { container } = render(<div className="brochure-page"><EditableScreenAnnotation product={{}} inches={55} type="television" onChange={onChange} /></div>);
  const page = container.firstElementChild!;
  vi.spyOn(page, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1080, bottom: 1350, width: 1080, height: 1350, toJSON: () => ({}) });
  const label = container.querySelector<HTMLElement>(".screen-size-annotation")!;
  const initial = label.style.transform;
  fireEvent.pointerDown(label, { clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.pointerMove(label, { clientX: 110.8, clientY: 110.8, pointerId: 1 });
  expect(label.style.transform).toContain("scale(0.9)");
  expect(label.style.transform).not.toBe(initial);
  fireEvent.pointerCancel(label, { pointerId: 1 });
  expect(label.style.transform).toBe(initial);
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.pointerDown(label, { clientX: 100, clientY: 100, pointerId: 2 });
  fireEvent.pointerMove(label, { clientX: 110.8, clientY: 110.8, pointerId: 2 });
  fireEvent.pointerUp(label, { pointerId: 2 });
  expect(onChange).toHaveBeenCalledWith("screenAnnotationPlacement", expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), scale: 0.9 }));
  expect(onChange.mock.calls[0]![1].x).toBeCloseTo(1 - 2 / 1080 * 100);
});
