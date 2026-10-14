import { expect, it } from "vitest";
import {
  BROCHURE_FORMATS,
  brochureExportGeometry,
  brochureFormatContentGeometry,
  brochureFormatFrameStyle,
} from "../../src/features/brochure/brochureFormat";

it.each(BROCHURE_FORMATS)(
  "uses the selected $id proportions for preview, export and fitted composition",
  (format) => {
    const campaign = { brochureFormat: format.id };
    const output = brochureExportGeometry(campaign, 760);
    const frame = brochureFormatContentGeometry(campaign, 760);
    expect(output.previewWidth / output.previewHeight).toBeCloseTo(
      format.ratio,
      10,
    );
    expect(frame.width / frame.height).toBeCloseTo(format.ratio, 10);
    // Paper raster dimensions round to whole pixels at 300 DPI.
    expect(output.width / output.height).toBeCloseTo(format.ratio, 3);
    expect(output.pdfWidthMm / output.pdfHeightMm).toBeCloseTo(
      format.ratio,
      10,
    );
    expect(brochureFormatFrameStyle(campaign)["--brochure-page-aspect"]).toBe(
      format.aspectRatio,
    );
    expect(frame.contentWidth / frame.contentHeight).toBeCloseTo(
      1080 / 1350,
      10,
    );
    expect(frame.contentWidth).toBeLessThanOrEqual(frame.width);
    expect(frame.contentHeight).toBeLessThanOrEqual(frame.height + 0.001);
  },
);
