import React, { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LayerOpacityControl } from "../../src/features/brochure/LayerOpacityControl";
import { setLanguage } from "../../src/features/brochure/i18n";

beforeEach(() => setLanguage("en"));
afterEach(() => cleanup());

function Harness({ onChange = vi.fn() }) {
  const [value, setValue] = useState(0.5);
  return (
    <LayerOpacityControl
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

it("supports precise percentage editing and a visible slider while preserving fractional opacity", () => {
  const change = vi.fn();
  const view = render(<Harness onChange={change} />);
  const number = view.getByRole("spinbutton", { name: "Opacity (%)" });
  fireEvent.change(number, { target: { value: "37" } });
  expect(change).toHaveBeenLastCalledWith(0.37);
  const slider = view.getByRole("slider", { name: "Opacity" });
  expect(slider.getAttribute("aria-valuetext")).toBe("37%");
  expect(
    (slider as HTMLInputElement).style.getPropertyValue(
      "--layer-opacity-percent",
    ),
  ).toBe("37%");
  fireEvent.change(slider, { target: { value: "0" } });
  expect(change).toHaveBeenLastCalledWith(0);
  expect((number as HTMLInputElement).value).toBe("0");
});

it("keeps an empty or out of range draft from changing opacity until it can be restored or bounded", () => {
  const change = vi.fn();
  const view = render(<Harness onChange={change} />);
  const number = view.getByRole("spinbutton", { name: "Opacity (%)" });
  fireEvent.change(number, { target: { value: "" } });
  expect(change).not.toHaveBeenCalled();
  fireEvent.blur(number);
  expect((number as HTMLInputElement).value).toBe("50");
  fireEvent.change(number, { target: { value: "150" } });
  expect(change).not.toHaveBeenCalled();
  fireEvent.blur(number);
  expect(change).toHaveBeenLastCalledWith(1);
  fireEvent.change(number, { target: { value: "-10" } });
  fireEvent.blur(number);
  expect(change).toHaveBeenLastCalledWith(0);
});

it("reflects externally selected layer opacity and translates its presets for Albanian", () => {
  setLanguage("sq");
  const change = vi.fn();
  const view = render(
    <LayerOpacityControl
      value={1}
      label="Dukshmëria e shtresës"
      onChange={change}
    />,
  );
  view.rerender(
    <LayerOpacityControl
      value={0}
      label="Dukshmëria e shtresës"
      onChange={change}
    />,
  );
  expect(
    (
      view.getByRole("spinbutton", {
        name: "Dukshmëria e shtresës (%)",
      }) as HTMLInputElement
    ).value,
  ).toBe("0");
  expect(view.getByRole("slider").getAttribute("aria-valuetext")).toBe("0%");
  fireEvent.click(
    view.getByRole("button", { name: "Vendos dukshmërinë: 50%" }),
  );
  expect(change).toHaveBeenCalledExactlyOnceWith(0.5);
  expect(view.getByText("0% · I tejdukshëm")).toBeTruthy();
  expect(view.getByText("100% · I plotë")).toBeTruthy();
});
