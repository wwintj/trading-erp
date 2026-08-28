import { expect, test } from "@playwright/test";

test("login form renders", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("Trading ERP")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeEnabled();
});

test("unauthenticated dashboard redirects to login", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});

test("unauthenticated root redirects to login", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
});

test("unauthenticated account redirects to login", async ({ page }) => {
  await page.goto("/account");

  await expect(page).toHaveURL(/\/login$/);
});

test("unauthenticated company redirects to login", async ({ page }) => {
  await page.goto("/company");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});

for (const path of ["/suppliers", "/suppliers/new", "/suppliers/missing-id"]) {
  test(`unauthenticated ${path} redirects to login`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });
}

for (const path of ["/products", "/products/new", "/products/missing-id"]) {
  test(`unauthenticated ${path} redirects to login`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });
}

for (const path of [
  "/purchase-contracts",
  "/purchase-contracts/new",
  "/purchase-contracts/missing-id",
]) {
  test(`unauthenticated ${path} redirects to login`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });
}
