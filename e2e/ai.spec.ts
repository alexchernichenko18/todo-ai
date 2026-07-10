import { test, expect, type Page } from "@playwright/test";

async function addTask(page: Page, title: string) {
  await page.getByRole("button", { name: "Add Task" }).click();
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create task" }).click();
  await expect(page.getByText(title)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("shows a message when history is insufficient", async ({ page }) => {
  await page.getByRole("button", { name: "Get AI recommendations" }).click();
  await expect(
    page.getByText("Add or complete a few tasks", { exact: false }),
  ).toBeVisible();
});

test("turns a text goal into a proposed task and adds it", async ({ page }) => {
  await page
    .getByLabel("Describe a goal")
    .fill("Prepare for a full stack interview next month");
  await page.getByRole("button", { name: "Generate task" }).click();

  await expect(
    page.getByRole("heading", { name: "Proposed task" }),
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Why AI suggested this")).toBeVisible();
  expect((await page.getByLabel("Title").inputValue()).length).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Add to tasks" }).click();
  await expect(page.getByRole("tab", { name: /Active \(1\)/ })).toBeVisible();
});

test("generates history recommendations and adds one", async ({ page }) => {
  await addTask(page, "Learn React");
  await addTask(page, "Learn TypeScript");
  await addTask(page, "Build a Next.js app");

  await page.getByRole("button", { name: "Get AI recommendations" }).click();
  await expect(
    page.getByRole("heading", { name: "AI recommendations" }),
  ).toBeVisible({ timeout: 10000 });

  const cards = page.getByRole("button", { name: "View & edit" });
  await expect(cards.first()).toBeVisible();
  await cards.first().click();

  await expect(
    page.getByRole("heading", { name: "Proposed task" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add to tasks" }).click();

  await expect(page.getByRole("tab", { name: /Active \(4\)/ })).toBeVisible();
});
