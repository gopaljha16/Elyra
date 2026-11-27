import { test } from "node:test";
import assert from "node:assert/strict";
import { walkingOptions, middleLongitude } from "../src/dating/travel.js";
const venues = ["A", "B", "C", "D"].map((id) => ({ id, name: id, address: "public centre" }));
const origins: [{ latitude: number; longitude: number }, { latitude: number; longitude: number }] =
  [
    { latitude: 1, longitude: 2 },
    { latitude: 2, longitude: 1 },
  ];
test("walking pilot limits calls, handles unordered and missing routes, and keeps only personal estimates", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    assert.equal(body.origins.length, 2);
    assert.equal(body.destinations.length, 3);
    return Response.json(
      [
        [1, 1, 1500],
        [0, 1, 1320],
        [1, 0, 2400],
        [0, 0, 600],
        [0, 2, 300],
      ].map(([originIndex, destinationIndex, seconds]) => ({
        originIndex,
        destinationIndex,
        duration: seconds + "s",
        condition: "ROUTE_EXISTS",
      })),
    );
  });
  const ranked = await walkingOptions(venues, origins, "fixture");
  assert.deepEqual(
    ranked.map((v) => v.id),
    ["B", "A", "C", "D"],
  );
  assert.deepEqual(ranked[0], { ...venues[1], walkingMinutes: 22, balanced: true });
  assert.deepEqual(ranked[2], { ...venues[2], walkingMinutes: 5, balanced: false });
  fetch.mock.mockImplementation(async () => new Response(null, { status: 503 }));
  assert.deepEqual(await walkingOptions(venues, origins, "fixture"), venues);
  assert.deepEqual(await walkingOptions(venues, origins, ""), venues);
  assert.equal(fetch.mock.callCount(), 2);
  assert.equal(Math.abs(middleLongitude(179, -179)), 180);
});
