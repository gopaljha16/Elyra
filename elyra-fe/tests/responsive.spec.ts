import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

for (const vp of viewports) {
  test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("landing page renders with custom fonts and zero horizontal overflow", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: /Make room for a real connection/i }),
      ).toBeVisible();

      const signIn = page.getByRole("link", { name: "Sign in" });
      const signUp = page.getByRole("link", { name: "Create an account" });
      await expect(signIn).toBeVisible();
      await expect(signUp).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);

      const fontFamilies = await page.evaluate(() => {
        const h1 = document.querySelector("h1");
        const body = document.body;
        return {
          h1Font: h1 ? getComputedStyle(h1).fontFamily : "",
          bodyFont: getComputedStyle(body).fontFamily,
        };
      });
      expect(fontFamilies.h1Font.toLowerCase()).toContain("fraunces");
      expect(fontFamilies.bodyFont.toLowerCase()).toContain("plus jakarta sans");
    });

    test("sign-in and sign-up pages render cleanly without horizontal overflow", async ({
      page,
    }) => {
      for (const route of ["/sign-in", "/sign-up"]) {
        await page.goto(route);
        await expect(page.getByRole("link", { name: /Elyra/i })).toBeVisible();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow).toBe(false);
      }
    });

    test("protected routes redirect cleanly when unauthenticated", async ({ page }) => {
      for (const route of ["/onboarding", "/dashboard", "/admin/reports"]) {
        const response = await page.goto(route);
        expect(response?.status()).toBeLessThan(500);
        await expect(page).toHaveURL(/\/sign-in/);
      }
    });
  });
}
