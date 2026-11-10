import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  BlackFridayDetailContent,
  blackFridayDetail,
  blackFridayDetailStyle,
} from "../../src/features/brochure/BlackFridayDetails";
import { blackFridayReference } from "../../src/features/brochure/blackFridayDesign";

afterEach(cleanup);

it("preserves mixed source character colors and switches to edited text after a fact changes", () => {
  const detail = blackFridayReference.pages
    .flatMap((page) => page.frames.flatMap((frame) => frame.detailRects || []))
    .find(
      (detail) =>
        new Set(detail.characterRuns?.map((run) => run.color)).size > 1,
    )!;
  expect(detail).toBeTruthy();
  const view = render(
    <BlackFridayDetailContent detail={detail} text={detail.text} />,
  );
  const runs = [
    ...view.container.querySelectorAll<HTMLElement>(".bf-source-detail-run"),
  ];
  expect(runs).toHaveLength(detail.characterRuns!.length);
  detail.characterRuns!.forEach((source, index) => {
    const probe = document.createElement("span");
    probe.style.color = /^#(?:ffffff|000000)$/i.test(source.color)
      ? "inherit"
      : source.color;
    expect(runs[index]!.style.color).toBe(probe.style.color);
    expect(runs[index]!.textContent).toBe(
      source.text.replace(/\\n/g, "\n").replace(/\n[ \t]+/g, "\n"),
    );
  });
  view.rerender(
    <BlackFridayDetailContent detail={detail} text="Updated specification" />,
  );
  expect(view.container.querySelector(".bf-source-detail-run")).toBeNull();
  expect(view.container.textContent).toBe("Updated specification");
});

it("uses source cell geometry and finds warranty separately from ordinary details", () => {
  const frame = blackFridayReference.pages
    .flatMap((page) => page.frames)
    .find(
      (frame) =>
        frame.specs && frame.detailRects?.some((detail) => detail.warranty),
    )!;
  const detail = blackFridayDetail(frame, 0)!;
  expect(detail.warranty).not.toBe(true);
  expect(blackFridayDetail(frame, 0, true)?.warranty).toBe(true);
  const style = blackFridayDetailStyle(frame, detail)!;
  expect(parseFloat(String(style.left))).toBeCloseTo(
    ((detail.x - frame.specs!.x) / frame.specs!.width) * 100,
  );
  expect(parseFloat(String(style.width))).toBeCloseTo(
    (detail.width / frame.specs!.width) * 100,
  );
  expect(style).not.toHaveProperty("background");
  expect(style).not.toHaveProperty("backgroundColor");
});

it("retains line breaks in plain edited fallback and supports lowercase italic face names", () => {
  const detail = {
    id: "test",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    text: "Source",
    pointSize: 10,
    fontFamily: "TSTAR",
    fontWeight: 400,
    characterRuns: [
      {
        text: "Source",
        color: "#ffffff",
        fontFamily: "TSTAR",
        fontWeight: 400,
        fontStyle: "italic",
        fontSize: 10,
      },
    ],
  };
  const view = render(
    <BlackFridayDetailContent detail={detail} text="Source" />,
  );
  expect(view.container.querySelector<HTMLElement>("em")?.style.fontStyle).toBe(
    "italic",
  );
  view.rerender(
    <BlackFridayDetailContent detail={detail} text={"Updated\\nvalue"} />,
  );
  expect(view.container.textContent).toBe("Updated\nvalue");
});
