import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { DetailContent } from "../../src/features/brochure/DetailContent";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.querySelector("style[data-detail-fit-test]")?.remove();
});

it("renders semantic imported values without losing wording or line breaks", () => {
  const numeric = renderToStaticMarkup(
    <DetailContent
      product={{}}
      label="0"
      value={"RROTULLIME:\n1400"}
      imported
      layout="strip"
      reference="red"
    />,
  );
  expect(numeric).toBe(
    '<small class="detail-strip-label">RROTULLIME:</small>\n<b class="detail-fitted-value detail-number">1400</b>',
  );

  const metric = renderToStaticMarkup(
    <DetailContent
      product={{}}
      label="1"
      value="7 KG"
      imported
      layout="strip"
      reference="red"
    />,
  );
  expect(metric).toBe('<b class="detail-fitted-value detail-metric">7 KG</b>');

  const long = renderToStaticMarkup(
    <DetailContent
      product={{}}
      label="2"
      value={"Mbushje me kuti/\nPërdorim deri në 37 h"}
      imported
      layout="strip"
      reference="blue"
    />,
  );
  expect(long).toBe(
    '<b class="detail-fitted-value detail-copy-long">Mbushje me kuti/\nPërdorim deri në 37 h</b>',
  );
});

it("keeps the phone reference wording and special air-conditioner facts", () => {
  const phone = renderToStaticMarkup(
    <DetailContent
      product={{ name: "REDMI 17", subcategory: "SMARTPHONE" }}
      label="Kamera"
      value="13MP, Front:8MP"
      layout="left"
      reference="blue"
    />,
  );
  expect(phone).toContain("detail-mobile-reference");
  expect(phone).toContain("Kamera: 13MP\nFront: 8MP");

  const temperature = renderToStaticMarkup(
    <DetailContent
      product={{ name: "KLIMË INVERTER", subcategory: "KONDICIONER" }}
      label="Temperatura"
      value="-25°C deri +50°C"
      layout="strip"
      reference="red"
    />,
  );
  expect(temperature).toContain('class="detail-temperature-low">-25°C');
  expect(temperature).toContain('class="detail-temperature-high">+50°C');
});

it("recomputes fitted type when the reference changes without a resize or text edit", () => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(20);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return (
        Number.parseFloat(
          this.style.fontSize || getComputedStyle(this).fontSize,
        ) * 2
      );
    },
  );
  const styles = document.createElement("style");
  styles.dataset.detailFitTest = "true";
  styles.textContent =
    ".fit-red,.fit-blue{padding:0}.fit-red>b{font-size:20px}.fit-blue>b{font-size:10px}";
  document.head.append(styles);

  const view = render(
    <span className="fit-red">
      <DetailContent
        product={{}}
        label="0"
        value="7 KG"
        layout="strip"
        reference="red"
      />
    </span>,
  );
  const value = view.container.querySelector("b");
  if (!value) throw new Error("Detail value missing");
  expect(Number.parseFloat(value.style.fontSize)).toBeLessThan(11);
  view.rerender(
    <span className="fit-blue">
      <DetailContent
        product={{}}
        label="0"
        value="7 KG"
        layout="strip"
        reference="blue"
      />
    </span>,
  );
  expect(value.style.fontSize).toBe("");
  expect(getComputedStyle(value).fontSize).toBe("10px");
});
