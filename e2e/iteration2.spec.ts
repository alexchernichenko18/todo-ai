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

test("new tasks appear on top of the active list", async ({ page }) => {
  await addTask(page, "First task");
  await addTask(page, "Second task");

  const topLabel = await page
    .getByRole("checkbox")
    .first()
    .getAttribute("aria-label");
  expect(topLabel).toContain("Second task");
});

test("subtasks show progress and toggle in details", async ({ page }) => {
  await page.getByRole("button", { name: "Add study task" }).click();
  await page.getByLabel("Title").fill("Ship feature");
  await page.getByRole("button", { name: "Add subtask" }).click();
  await page.getByRole("button", { name: "Add subtask" }).click();
  await page.getByPlaceholder("Subtask").nth(0).fill("Write code");
  await page.getByPlaceholder("Subtask").nth(1).fill("Write tests");
  await page.getByRole("button", { name: "Create study task" }).click();

  await expect(page.getByText("0/2")).toBeVisible();

  await page.getByText("Ship feature").click();
  await expect(
    page.getByRole("heading", { name: "Ship feature" }),
  ).toBeVisible();
  await page.getByRole("dialog").getByRole("checkbox").first().click();
  await expect(page.getByRole("dialog").getByText("1/2")).toBeVisible();
});

test("subtasks can be expanded and toggled from the card", async ({ page }) => {
  await page.getByRole("button", { name: "Add study task" }).click();
  await page.getByLabel("Title").fill("Launch feature");
  await page.getByRole("button", { name: "Add subtask" }).click();
  await page.getByRole("button", { name: "Add subtask" }).click();
  await page.getByPlaceholder("Subtask").nth(0).fill("Plan");
  await page.getByPlaceholder("Subtask").nth(1).fill("Execute");
  await page.getByRole("button", { name: "Create study task" }).click();

  await page.getByRole("checkbox", { name: "Plan" }).click();

  await expect(
    page.getByRole("button", { name: "Toggle subtasks" }),
  ).toContainText("1/2");
});

test("AI task gets an AI badge, and AI edited after editing", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Plan a goal" }).click();
  await page
    .getByLabel("Your learning goal")
    .fill("I want to learn PostgreSQL properly");
  await page.getByRole("button", { name: "Build the plan" }).click();
  await expect(
    page.getByRole("heading", { name: "Suggested study task" }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Add to tasks" }).click();

  await expect(page.getByText("AI", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Task actions" }).first().click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByLabel("Title").fill("Learn PostgreSQL fundamentals");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("AI · edited")).toBeVisible();
});

test("reorder active tasks by dragging", async ({ page }) => {
  await addTask(page, "Task A");
  await addTask(page, "Task B");

  const handle = page.getByRole("button", { name: "Drag to reorder" }).first();
  const box = await handle.boundingBox();
  if (!box) throw new Error("no drag handle box");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 40, { steps: 5 });
  await page.mouse.move(box.x + box.width / 2, box.y + 150, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(async () =>
      page.getByRole("checkbox").first().getAttribute("aria-label"),
    )
    .toContain("Task A");
});
