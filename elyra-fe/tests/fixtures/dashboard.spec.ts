import { test, expect } from "@playwright/test";

for (const width of [375, 768, 1440])
  test("two members plan a date at " + width, async ({ browser }) => {
    let invited = false,
      matched = false,
      plan: null | { status: string; scheduledAt: string } = null;
    let searches = 0;
    async function member(sender: boolean) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
      });
      await page.route("**/api/dating/**", async (route) => {
        const path = new URL(route.request().url()).pathname.slice("/api/dating".length);
        let data: unknown = {};
        if (path === "/matches" && route.request().method() === "POST") invited = true;
        else if (path === "/matches")
          data = {
            matches: invited
              ? [
                  {
                    id: "pair",
                    status: matched ? "ACTIVE" : "PENDING",
                    person: { id: sender ? "b" : "a", name: sender ? "Bea" : "Ali", age: 27 },
                    acceptedByMe: sender || matched,
                    activities: ["Coffee"],
                    plan: plan && {
                      ...plan,
                      acceptedByMe: sender,
                      activity: "Coffee",
                      location: "Cafe",
                      proposalVersion: 0,
                      venueId: "cafe",
                    },
                  },
                ]
              : [],
          };
        else if (path === "/candidates") {
          searches++;
          data = {
            candidates: [
              {
                id: "b",
                name: "Bea",
                age: 27,
                location: "Town",
                interests: [],
                activities: ["Coffee"],
              },
            ],
          };
        } else if (path.endsWith("/photo")) return route.fulfill({ status: 404 });
        else if (path === "/matches/pair/accept") matched = true;
        else if (path === "/matches/pair/venues")
          data = { venues: [{ id: "cafe", name: "Cafe", address: "Centre" }] };
        else if (path === "/matches/pair/plan")
          plan = { status: "PROPOSED", scheduledAt: route.request().postDataJSON().scheduledAt };
        else if (path === "/matches/pair/plan/accept" && plan) plan.status = "CONFIRMED";
        await route.fulfill({ json: data });
      });
      await page.goto("http://127.0.0.1:3117");
      return page;
    }
    const a = await member(true);
    await a.getByRole("button", { name: "Find matches" }).press("Enter");
    await a.getByRole("button", { name: "Invite to match" }).press("Enter");
    expect(searches).toBe(1);
    const b = await member(false);
    await b.getByRole("tab", { name: /Matches/ }).press("Enter");
    await b.getByRole("button", { name: "Accept match" }).press("Enter");
    await a.reload();
    await a.getByRole("tab", { name: /Matches/ }).press("Enter");
    await a.getByRole("button", { name: "Propose a date" }).press("Enter");
    await a.getByRole("combobox", { name: "Venue", exact: true }).press("Enter");
    await a.getByRole("option", { name: /Cafe/ }).press("Enter");
    await a.getByLabel("Date and time").fill("2030-05-10T15:00");
    await a.getByRole("button", { name: "Propose this date" }).press("Enter");
    await expect(a.getByText("Date proposal sent.")).toBeVisible();
    await b.reload();
    await b.getByRole("tab", { name: /Matches/ }).press("Enter");
    await b.getByRole("button", { name: "Accept this plan" }).press("Enter");
    await expect(b.getByText(/Date confirmed/)).toBeVisible();
    expect(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await a.close();
    await b.close();
  });
