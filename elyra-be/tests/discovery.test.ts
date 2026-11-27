import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient, User } from "@prisma/client";
import { areaBounds, discover, fits } from "../src/dating/discovery.js";
const member = {
  id: "viewer",
  name: "A",
  age: 30,
  gender: "Woman",
  location: "West",
  latitude: 0,
  longitude: 179.99,
  interests: [],
  dateActivities: [],
  personalityAnswers: {},
  preferences: {
    gender: "Everyone",
    minAge: 24,
    maxAge: 40,
    maxDistance: 10,
    relationship: "Long term",
  },
} as unknown as User;
test("radius discovery spans town labels, the date line and dense pages", async () => {
  const near = { ...member, location: "East", longitude: -179.99 };
  assert.ok(fits(member, near));
  assert.ok(!fits({ ...member, latitude: null }, near));
  assert.ok(!fits(member, { ...near, latitude: 1 }));
  assert.ok("OR" in areaBounds(0, 179.99, 10));
  assert.ok(!("longitude" in areaBounds(89.99, 10, 50)));
  const rows = Array.from({ length: 257 }, (_, i) => ({
    ...near,
    id: String(i).padStart(3, "0"),
    interests: i === 256 ? ["art"] : [],
  }));
  let calls = 0;
  const db = {
    user: {
      fields: { primaryPhotoUrl: "column" },
      findMany: async ({ where, take }: any) => {
        calls++;
        const query = where.AND?.[0] ?? where;
        assert.equal(query.blocksMade.none.blockedId, "viewer");
        assert.equal(query.blocksReceived.none.blockerId, "viewer");
        assert.ok(query.OR);
        assert.ok(!("location" in query));
        return rows.slice(calls === 1 ? 0 : 256, calls === 1 ? take : 257);
      },
    },
  };
  const result = await discover(
    db as unknown as PrismaClient,
    { ...member, interests: ["art"] },
    true,
  );
  assert.equal(result.length, 20);
  assert.equal(result[0].id, "256");
  assert.equal(calls, 2);
});
