import { expect, it } from "vitest";
import { detailTypography } from "../../src/features/brochure/detailTypography";

it("preserves every imported label, separator and numeric value", () => {
  for (const source of [
    "RROTULLIME:\n1400",
    "PROGRAME: 16",
    "RROTULLIME:1400",
    "PROGRAME\r\n16",
    "  PROGRAME:  16  ",
    "NIVELET: 1, 2, 3",
  ]) {
    const detail = detailTypography(source, { imported: true });
    expect(detail.kind).toBe("number");
    expect((detail.label ?? "") + (detail.separator ?? "") + detail.value).toBe(
      source,
    );
  }
});

it("distinguishes supplied numeric facts from measurements without adding labels", () => {
  expect(detailTypography("1400", { label: "RROTULLIME" })).toEqual({
    label: "RROTULLIME",
    separator: "\n",
    value: "1400",
    kind: "number",
  });
  for (const value of ["7 KG", "76 L", "120 Hz", "800 W"]) {
    expect(detailTypography(value, { label: "Kapaciteti" })).toEqual({
      value,
      kind: "metric",
    });
  }
});

it("retains text, units and manual line breaks when choosing short or long copy", () => {
  for (const source of [
    "Bluetooth: v5.4",
    "BLDC\nSMART\nINVERTER",
    "Koha e përdorimit:\nVetëm kufjet deri në 7 h",
    "Mbushje me kuti/\nPërdorim deri në 37 h",
    "4 SIPËRFAQE TË NGROHJES",
    "AMD Ryzen 3 30",
    "Memorie: 128 GB, 8 GB RAM",
  ]) {
    const detail = detailTypography(source, { imported: true });
    expect(detail.label).toBeUndefined();
    expect(detail.value).toBe(source);
    expect(["copy", "copy-long"]).toContain(detail.kind);
  }
  expect(detailTypography("Bluetooth: v5.4", { imported: true }).kind).toBe(
    "copy",
  );
  expect(
    detailTypography("Koha e përdorimit:\nVetëm kufjet deri në 7 h", {
      imported: true,
    }).kind,
  ).toBe("copy-long");
});
