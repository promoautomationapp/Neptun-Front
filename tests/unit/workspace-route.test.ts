import { expect, it } from "vitest";
import {
  readWorkspaceRoute,
  workspaceRouteUrl,
} from "../../src/app/workspaceRoute";
it("round trips document pages and social links without external destinations", () => {
  for (const path of [
    "/?section=catalog",
    "/?campaign=brochure-1&page=4&tab=products",
    "/?post=post-2&comment=reply-1",
    "/?section=stores&settingsArea=inside&settingsTab=products",
  ]) {
    const url = new URL(path, "https://example.test");
    expect(
      Object.fromEntries(
        new URL(workspaceRouteUrl(readWorkspaceRoute(url), url), url)
          .searchParams,
      ),
    ).toEqual(Object.fromEntries(url.searchParams));
  }
  for (const path of [
    "/unknown",
    "/?section=outside",
    "/?campaign=https://evil.test",
    "/?campaign=a&post=b",
  ])
    expect(
      readWorkspaceRoute(new URL(path, "https://example.test")).section,
    ).toBe("not-found");
  expect(
    readWorkspaceRoute(new URL("https://example.test/?campaign=a&page=-1"))
      .pageIndex,
  ).toBe(0);
});
