import { afterEach, expect, it, vi } from "vitest";
import { formatCatalogTime } from "../../src/features/products/catalogDate";

afterEach(() => vi.restoreAllMocks());
it("uses deterministic English and Albanian month/link words in Europe/Belgrade", () => {
  expect(formatCatalogTime("2026-10-31T19:06:00Z", "sq")).toBe(
    "31 tetor, ora 20:06",
  );
  expect(formatCatalogTime("2026-10-31T19:06:00Z", "en")).toBe(
    "31 October at 20:06",
  );
  expect(formatCatalogTime("2026-11-01T23:15:00Z", "sq")).toBe(
    "2 nëntor, ora 00:15",
  );
});
it("keeps daylight saving and UTC date rollover accurate", () => {
  expect(formatCatalogTime("2026-07-01T22:06:00Z", "sq")).toBe(
    "2 korrik, ora 00:06",
  );
  expect(formatCatalogTime("2026-10-25T00:30:00Z", "en")).toBe(
    "25 October at 02:30",
  );
  expect(formatCatalogTime("2026-10-25T01:30:00Z", "sq")).toBe(
    "25 tetor, ora 02:30",
  );
});
it("does not depend on Albanian ICU locale support or its English fallback", () => {
  const NativeDateTimeFormat = Intl.DateTimeFormat;
  const formatter = vi
    .spyOn(Intl, "DateTimeFormat")
    .mockImplementation(function (locale, options) {
      if (String(locale).startsWith("sq"))
        throw new RangeError("Albanian locale unavailable");
      return new NativeDateTimeFormat("en-US", options);
    });
  expect(formatCatalogTime("2026-10-31T19:06:00Z", "sq")).toBe(
    "31 tetor, ora 20:06",
  );
  expect(formatter).toHaveBeenCalledWith(
    "en-GB-u-nu-latn",
    expect.objectContaining({ timeZone: "Europe/Belgrade", month: "numeric" }),
  );
});
it("returns no display date for absent or invalid server timestamps", () => {
  for (const value of [undefined, null, "", "not-a-date"])
    expect(formatCatalogTime(value, "sq")).toBeNull();
});
