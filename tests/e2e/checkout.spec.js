import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const pageUrl = pathToFileURL(join(process.cwd(), "demo-app/index.html")).href;

test("user can place an order", async ({ page }) => {
  await page.goto(pageUrl);
  await page.click("#checkout");
  await expect(page.locator("#order")).toHaveText("Order placed");
});
