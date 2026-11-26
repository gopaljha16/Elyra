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
      await expect(page.getByRole("heading", { name: /Dating made for real life/i })).toBeVisible();

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
        const wordmark = page.getByRole("link", { name: "Elyra home" });
        await expect(wordmark).toHaveText("elyra.");
        await expect(wordmark).toHaveAttribute("href", "/");
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow).toBe(false);
      }
    });

    test("visitors can explore the dating preview and open an FAQ", async ({ page }) => {
      await page.goto("/");
      const navigation = page.getByRole("navigation", { name: "Main navigation" });
      await navigation.getByRole("link", { name: "How it works" }).click();
      await expect(page).toHaveURL(/#how-it-works$/);

      await page.getByRole("link", { name: "Try a sample match" }).click();
      await expect(page).toHaveURL(/#preview$/);
      const coffee = page.getByRole("radio", { name: "Coffee" });
      await expect(coffee).toBeChecked();
      await coffee.focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("radio", { name: "Museum" })).toBeChecked();
      await expect(page.getByRole("tabpanel")).toContainText("You both picked a museum visit.");

      const discover = page.getByRole("tab", { name: "Discover" });
      await expect(discover).toHaveAttribute("aria-selected", "true");
      await discover.focus();
      await page.keyboard.press("ArrowRight");
      const match = page.getByRole("tab", { name: "Match" });
      await expect(match).toHaveAttribute("aria-selected", "true");
      await discover.click();
      await page.getByRole("button", { name: "Send sample invitation" }).click();
      await expect(match).toBeFocused();
      await page.getByRole("button", { name: "See the date plan" }).click();
      await expect(page.getByRole("tab", { name: "Plan a date" })).toBeFocused();
      const plan = page.getByRole("tabpanel");
      await expect(plan).toContainText("A local art museum");
      await expect(plan.getByText("Date confirmed")).toBeVisible();
      await page.getByRole("radio", { name: "Walk" }).check();
      await expect(plan).toContainText("The park entrance");

      await navigation.getByRole("link", { name: "FAQs" }).click();
      await expect(page).toHaveURL(/#faq$/);
      await page.getByText("Who can join Elyra?", { exact: true }).click();
      await expect(page.getByText(/Elyra is for adults aged 18 and over/)).toBeVisible();
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
