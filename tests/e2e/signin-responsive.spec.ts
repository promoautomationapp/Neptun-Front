import { expect, test } from "@playwright/test";

for (const [width, height] of [
  [390, 720],
  [735, 900],
  [768, 900],
  [1280, 720],
]) {
  test(`sign-in remains compact and usable at ${width} × ${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: width!, height: height! });
    await page.addInitScript(() => {
      localStorage.setItem("neptun-studio-language", "sq");
      localStorage.setItem("neptun.appearance.guest", "dark");
    });
    await page.route("**/api/team/session", (route) =>
      route.fulfill({ json: { configured: true, user: null } }),
    );
    // Login and recovery are visual interaction checks, never real account writes.
    await page.route("**/api/team/login", (route) => route.abort("failed"));
    await page.route("**/api/team/forgot-password", (route) =>
      route.fulfill({
        json: { message: "If eligible, an email will be sent." },
      }),
    );
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Mirë se vini në hapësirën tuaj." }),
    ).toBeVisible();
    const button = page.getByRole("button", { name: "Hyr në studio →" });
    await expect(button).toBeVisible();
    const rect = await button.boundingBox();
    expect(rect!.y + rect!.height).toBeLessThan(height! - 16);
    expect(
      (await page.locator(".cs-auth-form-content").boundingBox())!.width,
    ).toBeLessThanOrEqual(401);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width! <= 960)
      await expect(page.locator(".cs-signin-art-copy")).toBeHidden();
    await page.getByLabel("Email", { exact: true }).fill("staff@example.test");
    await page
      .getByLabel("Fjalëkalimi", { exact: true })
      .fill("Typed password");
    await button.click();
    const message = page.getByRole("alert");
    await expect(message).toContainText("Nuk u lidhëm dot me Neptun");
    await expect(message).toHaveClass(/error/);
    await expect(page.locator(".na-alert.success")).toHaveCount(0);
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
      "staff@example.test",
    );
    await page.screenshot({
      path: `artifacts/signin-${width}-${height}-sq-dark.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "English", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Welcome to your workspace." }),
    ).toBeVisible();
    await expect(message).toContainText("We couldn’t connect to Neptun");
    await page
      .getByRole("button", { name: "Forgot password?", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Forgot your password?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send secure reset link" }),
    ).toBeInViewport();
  });
}

test("a failed session connection is an actionable error rather than a green signed-in notice", async ({
  page,
}) => {
  await page.setViewportSize({ width: 735, height: 900 });
  await page.addInitScript(() =>
    localStorage.setItem("neptun-studio-language", "sq"),
  );
  await page.route("**/api/team/session", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Nuk u lidhëm dot me Neptun",
  );
  await expect(page.locator(".na-alert.success")).toHaveCount(0);
  await expect(page.getByText("Failed to fetch", { exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: "artifacts/signin-735-900-connection-light.png",
    fullPage: true,
  });
});
