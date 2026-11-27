import { expect, test } from "@playwright/test";

// No place is picked, so the server makes no outbound calls: templates and the
// estimated traffic only.
test("issues three slips at 360px and keeps them in the drawer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Excuse slip");
  await expect(page.getByText("Estimated, not live").first()).toBeVisible();
  await expect(page.getByText("Demo data").first()).toBeVisible();

  // Nothing overflows sideways on a small phone.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Issue excuses" }).click();
  await expect(page.locator("[aria-invalid='true']").first()).toBeFocused();

  await page.getByLabel("What for").fill("the Monday standup");
  await page.getByRole("radio", { name: "boss" }).check();
  await page.getByRole("button", { name: "Issue excuses" }).click();

  const results = page.getByRole("region", { name: "Your slips" });
  await expect(results).toBeVisible();
  await expect(results.getByRole("listitem")).toHaveCount(3);
  await expect(results.getByText("Offline mode")).toBeVisible();

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await results.getByRole("button", { name: "Copy" }).first().click();
  await expect(page.getByRole("button", { name: /Drawer \(1\)/ })).toBeVisible();

  await page.goBack();
  await expect(page.getByLabel("What for")).toHaveValue("the Monday standup");
});
