import { test, expect, type Page } from "@playwright/test";

async function addTask(page: Page, title: string) {
  await page.getByRole("button", { name: "Add study task" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create study task" }).click();
  await expect(page.getByText(title)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("shows a message when history is insufficient", async ({ page }) => {
  await page.getByRole("button", { name: "AI recommendations" }).click();
  await expect(
    page.getByText("Add or complete a few study tasks", { exact: false }),
  ).toBeVisible();
});

test("turns a text goal into a proposed task and adds it", async ({ page }) => {
  await page.getByRole("button", { name: "Plan a goal" }).click();
  await page
    .getByLabel("Your learning goal")
    .fill("Prepare for a full stack interview next month");
  await page.getByRole("button", { name: "Build the plan" }).click();

  await expect(
    page.getByRole("heading", { name: "Suggested study task" }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Why AI suggested this")).toBeVisible();

  await page.getByRole("button", { name: "Add to tasks" }).click();
  await expect(page.getByRole("tab", { name: /In progress \(1\)/ })).toBeVisible();
});

test("generates history recommendations and adds one", async ({ page }) => {
  await addTask(page, "Learn React");
  await addTask(page, "Learn TypeScript");
  await addTask(page, "Build a Next.js app");

  await page.getByRole("button", { name: "AI recommendations" }).click();

  const cards = page.getByRole("button", { name: "View & edit" });
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Recommended reading")).toBeVisible();
  await cards.first().click();

  await expect(
    page.getByRole("heading", { name: "Suggested study task" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to tasks" }).click();

  await expect(page.getByRole("tab", { name: /In progress \(4\)/ })).toBeVisible();
});

test("declines a goal that is not about learning", async ({ page }) => {
  await page.getByRole("button", { name: "Plan a goal" }).click();
  await page
    .getByLabel("Your learning goal")
    .fill("vacuum the flat and take out the bins");
  await page.getByRole("button", { name: "Build the plan" }).click();

  const goalDialog = page.getByRole("dialog");
  await expect(
    goalDialog.getByText("This planner is for learning goals", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: "Suggested study task" }),
  ).toBeHidden();
});

test("a learning goal comes back with a reading list", async ({ page }) => {
  await page.getByRole("button", { name: "Plan a goal" }).click();
  await page
    .getByLabel("Your learning goal")
    .fill("Learn SQL basics over the next month");
  await page.getByRole("button", { name: "Build the plan" }).click();

  await expect(
    page.getByRole("heading", { name: "Suggested study task" }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Reading list", { exact: true })).toBeVisible();
});

test("a task's own details dialog shows its reading list and tracks read progress", async ({
  page,
}) => {
  const title = "Learn SQL basics over the next month";
  await page.getByRole("button", { name: "Plan a goal" }).click();
  await page.getByLabel("Your learning goal").fill(title);
  await page.getByRole("button", { name: "Build the plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Suggested study task" }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Add to tasks" }).click();

  await page.getByText(title).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: title })).toBeVisible();
  await expect(dialog.getByText("Reading list", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/0\/\d+ read/)).toBeVisible();

  await dialog
    .getByRole("checkbox", { name: /Mark ".*" as read/ })
    .first()
    .check();

  await expect(dialog.getByText(/1\/\d+ read/)).toBeVisible();
});
