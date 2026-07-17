import { expect, test } from "@playwright/test";

const viewports = [
  { width: 320, height: 720 },
  { width: 360, height: 780 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 }
];

for (const viewport of viewports) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport });

    for (const path of ["/", "/search", "/auth"]) {
      test(`${path} ne déborde pas horizontalement`, async ({ page }) => {
        await page.route("**/_next/image?*", route => route.abort());
        await page.goto(path, { waitUntil: "domcontentloaded" });
        const dimensions = await page.evaluate(() => ({
          body: document.body.scrollWidth,
          root: document.documentElement.scrollWidth,
          viewport: window.innerWidth
        }));
        expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
        expect(dimensions.root).toBeLessThanOrEqual(dimensions.viewport + 1);
        await expect(page.locator("body")).toBeVisible();
      });
    }
  });
}
