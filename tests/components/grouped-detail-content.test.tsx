import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { DetailContent } from "../../src/features/brochure/DetailContent";
import { ScreenSizeAnnotation } from "../../src/features/brochure/ScreenSizeAnnotation";

const phone = { name: "Samsung Galaxy A17", subcategory: "SMARTPHONE" };
const conditioner = { name: "FUEGO KONDICIONER", subcategory: "KONDICIONER" };
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.querySelector("style[data-grouped-fit-test]")?.remove();
});

it("renders compact grouped phone facts with storage above RAM and no redundant memory label", () => {
  const memory = renderToStaticMarkup(
    <DetailContent
      product={phone}
      label="RAM / Memorje"
      value="8GB / 128GB"
      layout="strip"
      reference="red"
    />,
  );
  expect(memory).toContain("128GB\n8GB");
  expect(memory).not.toContain("Memorje");
  expect(memory).not.toContain("RAM");
  const importedMemory = renderToStaticMarkup(
    <DetailContent
      product={phone}
      label="0"
      value="Memory: 128GB, 8GB RAM"
      imported
      layout="strip"
      reference="red"
    />,
  );
  expect(importedMemory).toContain("128GB\n8GB");
  expect(importedMemory).not.toContain("Memory");
  const cameras = renderToStaticMarkup(
    <DetailContent
      product={phone}
      label="Kamera"
      value={"50MP\nFront: 13MP"}
      layout="strip"
      reference="red"
    />,
  );
  expect(cameras).toContain("Kamera: 50MP\nFront: 13MP");
  expect(cameras.match(/<b /g)).toHaveLength(1);
  const os = renderToStaticMarkup(
    <DetailContent
      product={phone}
      label="Sistemi"
      value="Android 15"
      layout="strip"
      reference="red"
    />,
  );
  expect(os).toContain("Android\n15");
  const battery = renderToStaticMarkup(
    <DetailContent
      product={phone}
      label="Bateria"
      value="Li-Ion 5000mAh"
      layout="strip"
      reference="red"
    />,
  );
  expect(battery).toContain("Bateria:\nLi-Ion 5000mAh");
});

it("renders power as a value-only measurement and keeps unrelated imported facts intact", () => {
  for (const value of ["Fuqia860W", "Fuqia: 860W", "Power 860W"]) {
    expect(
      renderToStaticMarkup(
        <DetailContent
          product={{}}
          label="0"
          value={value}
          imported
          layout="strip"
          reference="red"
        />,
      ),
    ).toBe('<b class="detail-fitted-value detail-metric">860W</b>');
  }
  expect(
    renderToStaticMarkup(
      <DetailContent
        product={{}}
        label="0"
        value="Bluetooth: v5.4"
        imported
        layout="strip"
        reference="red"
      />,
    ),
  ).toContain("Bluetooth: v5.4");
});

it("keeps energy/temperature in one fitted block each and preserves supplied range signs", () => {
  const energy = renderToStaticMarkup(
    <DetailContent
      product={conditioner}
      label="Klasa energjisë"
      value="A++ / A+"
      layout="strip"
      reference="red"
    />,
  );
  expect(energy.match(/<b /g)).toHaveLength(1);
  expect(energy).toContain("detail-energy-stacked");
  expect(energy).toContain("<em>A++</em><em>A+</em>");
  expect(energy).not.toContain(">/</span>");
  const temperature = renderToStaticMarkup(
    <DetailContent
      product={conditioner}
      label="Temperatura"
      value="-20°C deri +53°C"
      layout="strip"
      reference="red"
    />,
  );
  expect(temperature.match(/<b /g)).toHaveLength(1);
  expect(temperature).toContain('class="detail-temperature-low">-20°C');
  expect(temperature).toContain('class="detail-temperature-high">+53°C');
  const unsigned = renderToStaticMarkup(
    <DetailContent
      product={conditioner}
      label="Temperatura"
      value="-20°C deri 53°C"
      layout="strip"
      reference="red"
    />,
  );
  expect(unsigned).toContain('class="detail-temperature-high">53°C');
});

it("measures all stacked AC text when the compact box requires a smaller font", () => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(60);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(20);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(60);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return (
        Number.parseFloat(
          this.style.fontSize || getComputedStyle(this).fontSize,
        ) * 3
      );
    },
  );
  const styles = document.createElement("style");
  styles.dataset.groupedFitTest = "true";
  styles.textContent = ".fit-stacked{padding:0}.fit-stacked>b{font-size:20px}";
  document.head.append(styles);
  const view = render(
    <span className="fit-stacked">
      <DetailContent
        product={conditioner}
        label="Temperatura"
        value="-20°C deri +53°C"
        layout="strip"
        reference="red"
      />
    </span>,
  );
  const fitted = view.container.querySelector("b");
  expect(fitted?.classList.contains("detail-fitted-value")).toBe(true);
  expect(Number.parseFloat(fitted?.style.fontSize || "0")).toBeLessThan(7);
});

it("renders the folded gradient corner for phone inches while other devices keep the arrow annotation", () => {
  const phoneCorner = renderToStaticMarkup(
    <ScreenSizeAnnotation inches={6.7} type="phone" />,
  );
  expect(phoneCorner).toContain("screen-size-phone");
  expect(phoneCorner).toContain("linearGradient");
  expect(phoneCorner).toContain("6.7”");
  expect(phoneCorner).not.toContain(">INCH</text>");
  const tablet = renderToStaticMarkup(
    <ScreenSizeAnnotation inches={11} type="other" />,
  );
  expect(tablet).toContain(">INCH</text>");
});
