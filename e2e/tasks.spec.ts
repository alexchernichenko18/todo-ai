import { test, expect, type Page } from "@playwright/test";

async function addTask(page: Page, title: string, description?: string) {
  await page.getByRole("button", { name: "Add Task" }).click();
  await page.getByLabel("Title").fill(title);
  if (description) await page.getByLabel("Description").fill(description);
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByText(title)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("create, persist across reload, complete and restore", async ({ page }) => {
  await expect(page.getByText("You have no active tasks yet.")).toBeVisible();

  await addTask(page, "Buy milk", "2 litres");
  await expect(page.getByRole("tab", { name: /Active \(1\)/ })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Buy milk")).toBeVisible();

  await page.getByRole("checkbox", { name: 'Complete "Buy milk"' }).click();
  await expect(page.getByText("You have no active tasks yet.")).toBeVisible();

  await page.getByRole("tab", { name: /Done \(1\)/ }).click();
  await expect(page.getByText("Buy milk")).toBeVisible();

  await page.getByRole("button", { name: "Task actions" }).click();
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await page.getByRole("tab", { name: /Active \(1\)/ }).click();
  await expect(page.getByText("Buy milk")).toBeVisible();
});

test("edit a task", async ({ page }) => {
  await addTask(page, "Draft report");

  await page.getByRole("button", { name: "Task actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByLabel("Title").fill("Draft final report");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Draft final report")).toBeVisible();
});

test("delete a task with confirmation", async ({ page }) => {
  await addTask(page, "Temporary task");

  await page.getByRole("button", { name: "Task actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.getByText("Temporary task")).toHaveCount(0);
  await expect(page.getByText("You have no active tasks yet.")).toBeVisible();
});

test("create a category inline and assign it", async ({ page }) => {
  await page.getByRole("button", { name: "Add Task" }).click();
  await page.getByLabel("Title").fill("Go for a run");

  await page.getByText("No category").click();
  await page.getByText("Create new category").click();
  await page.getByPlaceholder("New category name").fill("Health");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Create task" }).click();

  await expect(page.getByText("Go for a run")).toBeVisible();
  await expect(page.getByText("Health")).toBeVisible();
});
