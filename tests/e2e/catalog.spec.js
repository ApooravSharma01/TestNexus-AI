import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const pageUrl = pathToFileURL(join(process.cwd(), "demo-app/index.html")).href;

test("catalog shows a product", async ({ page }) => {
  await page.goto(pageUrl);
  await expect(page.locator("#product")).toHaveText("Notebook");
});
