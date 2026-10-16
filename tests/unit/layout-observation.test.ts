import { expect, it } from "vitest";
import {
  requestedLayoutChanged,
  stableMeasurement,
} from "../../src/features/brochure/layoutObservation";

function watch() {
  const element = document.createElement("div");
  element.style.transform = "translate(10px, 20px)";
  const observer = new MutationObserver(() => {});
  observer.observe(element, {
    attributes: true,
    attributeOldValue: true,
    childList: true,
    subtree: true,
    characterData: true,
  });
  return { element, observer };
}
it("does not schedule another layout pass for automatic translate and scale corrections", () => {
  const { element, observer } = watch();
  element.style.translate = "0 12px";
  element.style.scale = "0.95";
  expect(requestedLayoutChanged(observer.takeRecords())).toBe(false);
  element.style.removeProperty("translate");
  element.style.removeProperty("scale");
  element.style.translate = "0 12px";
  element.style.scale = "0.95";
  expect(requestedLayoutChanged(observer.takeRecords())).toBe(false);
  observer.disconnect();
});
it("remeasures actual drag, resize, typography, image and content edits", () => {
  const { element, observer } = watch();
  for (const change of [
    () => {
      element.style.transform = "translate(30px, 40px)";
    },
    () => {
      element.style.width = "200px";
    },
    () => {
      element.style.fontSize = "18px";
    },
    () => {
      element.setAttribute("src", "/new-product.png");
    },
    () => {
      element.setAttribute("class", "editing-photo");
    },
    () => {
      element.textContent = "New product title";
    },
  ]) {
    change();
    expect(requestedLayoutChanged(observer.takeRecords())).toBe(true);
  }
  observer.disconnect();
});
it("ignores temporary measurement styles restored within the same observer batch", () => {
  const { element, observer } = watch();
  element.style.transform = "none";
  element.style.transform = "translate(10px, 20px)";
  expect(requestedLayoutChanged(observer.takeRecords())).toBe(false);
  observer.disconnect();
});
it("retains the previous measurement when the screen selection box has not moved", () => {
  const previous = { x: 12, y: 35, width: 40, height: 25 };
  expect(stableMeasurement(previous, { ...previous })).toBe(previous);
  expect(stableMeasurement(previous, { ...previous, x: 13 })).not.toBe(
    previous,
  );
  expect(stableMeasurement(previous, null)).toBeNull();
});
