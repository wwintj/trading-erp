import { expect, test } from "@playwright/test";

test("login placeholder renders", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("Trading ERP")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeDisabled();
});

test("dashboard placeholder renders", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByText("Trading ERP")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
});
