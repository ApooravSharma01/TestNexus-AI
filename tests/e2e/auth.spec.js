import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const pageUrl = pathToFileURL(join(process.cwd(), "demo-app/index.html")).href;

test("user can log in with valid credentials", async ({ page }) => {
  await page.goto(pageUrl);
  await page.fill("#username", "admin");
  await page.fill("#password", "secret");
  await page.click("#login");
  await expect(page.locator("#message")).toHaveText("Welcome");
});

test("login rejects an empty password", async ({ page }) => {
  await page.goto(pageUrl);
  await page.fill("#username", "admin");
  await page.click("#login");
  await expect(page.locator("#message")).toHaveText("Password is required");
});
