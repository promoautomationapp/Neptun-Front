import React, { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ColorField } from "../../src/features/brochure/ColorField";
import { setLanguage } from "../../src/features/brochure/i18n";
import { hexToHsv, hsvToHex } from "../../src/features/brochure/colorSpace";

beforeEach(() => setLanguage("en"));
afterEach(cleanup);

function Picker({ inline = false }: { inline?: boolean }) {
  const [color, setColor] = useState("#ff0000");
  return (
    <>
      <output aria-label="Selected color">{color}</output>
      <ColorField
        value={color}
        onChange={setColor}
        label="Background"
        inline={inline}
      />
    </>
  );
}

it("edits hue, saturation, brightness and hex in one inline surface without a native picker", () => {
  const view = render(<Picker inline />);
  expect(view.queryByRole("dialog")).toBeNull();
  expect(document.querySelector('input[type="color"]')).toBeNull();
  fireEvent.change(view.getByRole("slider", { name: "Background hue" }), {
    target: { value: "120" },
  });
  expect(view.getByRole("status", { name: "Selected color" }).textContent).toBe(
    "#00ff00",
  );
  fireEvent.keyDown(
    view.getByRole("slider", { name: "Background saturation and brightness" }),
    { key: "ArrowLeft", shiftKey: true },
  );
  expect(view.getByRole("status", { name: "Selected color" }).textContent).toBe(
    "#19ff19",
  );
  fireEvent.keyDown(
    view.getByRole("slider", { name: "Background saturation and brightness" }),
    { key: "ArrowDown", shiftKey: true },
  );
  expect(view.getByRole("status", { name: "Selected color" }).textContent).toBe(
    "#17e617",
  );
  const input = view.getByLabelText("Background hex code");
  fireEvent.change(input, { target: { value: "#123456" } });
  expect(view.getByRole("status", { name: "Selected color" }).textContent).toBe(
    "#123456",
  );
  fireEvent.change(input, { target: { value: "#12" } });
  fireEvent.blur(input);
  expect((input as HTMLInputElement).value).toBe("#123456");
});

it("closes a floating picker with Escape and returns focus to its trigger", () => {
  const view = render(<Picker />);
  const trigger = view.getByRole("button", { name: "Background: #ff0000" });
  fireEvent.click(trigger);
  const picker = view.getByRole("dialog", { name: "Background color picker" });
  fireEvent.pointerDown(picker);
  expect(view.getByRole("dialog")).toBeTruthy();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(view.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("accepts RGBA and HSLA input, synchronizes the picker and preserves opacity during hue changes", () => {
  const view = render(<Picker inline />);
  const format = view.getByRole("combobox", {
    name: "Background color format",
  });
  fireEvent.change(format, { target: { value: "rgb" } });
  fireEvent.change(view.getByLabelText("Background RGBA"), {
    target: { value: "rgba(0, 255, 0, 0.5)" },
  });
  expect(view.getByRole("status", { name: "Selected color" }).textContent).toBe(
    "#00ff0080",
  );
  expect(
    (view.getByRole("slider", { name: "Background hue" }) as HTMLInputElement)
      .value,
  ).toBe("120");
  fireEvent.change(view.getByRole("slider", { name: "Background hue" }), {
    target: { value: "240" },
  });
  expect(view.getByRole("status", { name: "Selected color" }).textContent).toBe(
    "#0000ff80",
  );
  fireEvent.change(format, { target: { value: "hsl" } });
  fireEvent.change(view.getByLabelText("Background HSLA"), {
    target: { value: "hsla(0, 100%, 50%, 1)" },
  });
  expect(view.getByRole("status", { name: "Selected color" }).textContent).toBe(
    "#ff0000",
  );
  fireEvent.change(format, { target: { value: "hex" } });
  const input = view.getByLabelText("Background hex code");
  for (const value of ["#1", "#12", "#123", "#1234", "#12345", "#123456"])
    fireEvent.change(input, { target: { value } });
  expect(view.getByRole("status", { name: "Selected color" }).textContent).toBe(
    "#123456",
  );
  expect((input as HTMLInputElement).value).toBe("#123456".toUpperCase());
});

it("preserves exact RGB values when opening and editing color choices", () => {
  for (const color of [
    "#ff0000",
    "#00ff00",
    "#0000ff",
    "#ffffff",
    "#000000",
    "#808080",
    "#1680a8",
    "#1c4075",
    "#f5e4e1",
    "#123456",
  ])
    expect(hsvToHex(hexToHsv(color))).toBe(color);
});
