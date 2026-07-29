import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

async function addLearningTaskWithReading(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Plan a goal" }).click();
  await page
    .getByLabel("Your learning goal")
    .fill("Learn SQL basics over the next month");
  await page.getByRole("button", { name: "Build the plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Suggested study task" }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Add to tasks" }).click();
}

test("saved reading shows up in the Library and survives a reload", async ({
  page,
}) => {
  await addLearningTaskWithReading(page);

  await page.getByRole("tab", { name: /Library \([1-9]/ }).click();
  await expect(page.getByText("Books")).toBeVisible();
  await expect(page.getByText("From:", { exact: false }).first()).toBeVisible();

  const firstReadCheckbox = page
    .getByRole("checkbox", { name: /Mark ".*" as read/ })
    .first();
  await firstReadCheckbox.check();
  await expect(page.getByText("1/", { exact: false }).first()).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: /Library \(/ }).click();
  await expect(
    page.getByRole("checkbox", { name: /Mark ".*" as read/ }).first(),
  ).toBeChecked();
});

test("removing a resource from the Library empties it", async ({ page }) => {
  await addLearningTaskWithReading(page);

  await page.getByRole("tab", { name: /Library \(/ }).click();

  const removeButtons = page.getByRole("button", { name: /Remove ".*"/ });
  const count = await removeButtons.count();
  for (let i = 0; i < count; i += 1) {
    await removeButtons.first().click();
  }

  await expect(page.getByText("Your reading list is empty.")).toBeVisible();
});
