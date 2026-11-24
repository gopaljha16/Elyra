import { Router } from "express";
import { z } from "zod";
import type { PrismaClient, User } from "@prisma/client";
import { ApiError } from "../onboarding/profile.js";
import { clerkId } from "../onboarding/routes.js";
import { dateActivities } from "./options.js";
import { nearbyVenues } from "./venues.js";

const idBody = z.object({ userId: z.string().min(1) });
const reportBody = idBody.extend({ reason: z.string().trim().min(5).max(500) });
const preferences = z.object({ minAge: z.number(), maxAge: z.number(), gender: z.string(), maxDistance: z.number() });

function eligible(user: User) {
  if (!user.isActive || !user.isOnboarded || user.verificationStatus !== "VERIFIED") {
    throw new ApiError(403, "Complete profile verification before matching.");
  }
}

function fits(viewer: User, candidate: User) {
  const prefs = preferences.safeParse(viewer.preferences);
  if (!prefs.success) return false;
  const p = prefs.data;
  const acceptedGender = p.gender === "Everyone" || p.gender === ({ Woman: "Women", Man: "Men" } as Record<string, string>)[candidate.gender]
    || p.gender === "Nonbinary people" && candidate.gender === "Nonbinary";
  const distance = viewer.latitude != null && viewer.longitude != null && candidate.latitude != null && candidate.longitude != null
    ? Math.hypot((viewer.latitude - candidate.latitude) * 111, (viewer.longitude - candidate.longitude) * 111) : null;
  return acceptedGender && candidate.age >= p.minAge && candidate.age <= p.maxAge
    && distance !== null && distance <= p.maxDistance;
}

function shared(a: User, b: User) {
  return {
    interests: a.interests.filter((item) => b.interests.includes(item)),
    activities: a.dateActivities.filter((item) => b.dateActivities.includes(item)),
  };
}

export function datingRoutes(db: PrismaClient, placesKey = "") {
  const router = Router();
  router.use((req, res, next) => { clerkId(req); res.set("Cache-Control", "no-store"); next(); });

  async function self(clerk: string) {
    const user = await db.user.findUnique({ where: { clerkId: clerk } });
    if (!user) throw new ApiError(403, "Complete onboarding first.");
    eligible(user);
    return user;
  }

  router.put("/area", async (req, res) => {
    const user = await self(clerkId(req));
    const area = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), location: z.string().trim().min(2).max(120) }).parse(req.body);
    await db.user.update({ where: { id: user.id }, data: area });
    res.json({ saved: true });
  });

  router.get("/candidates", async (req, res) => {
    const user = await self(clerkId(req));
    const excluded = await db.userBlock.findMany({ where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] } });
    const ids = new Set(excluded.map((block) => block.blockerId === user.id ? block.blockedId : block.blockerId));
    const existing = await db.match.findMany({ where: { OR: [{ user1Id: user.id }, { user2Id: user.id }] } });
    for (const match of existing) ids.add(match.user1Id === user.id ? match.user2Id : match.user1Id);
    ids.add(user.id);
    const candidates = await db.user.findMany({ where: { id: { notIn: [...ids] }, isActive: true, isOnboarded: true, verificationStatus: "VERIFIED", location: { equals: user.location, mode: "insensitive" } }, take: 100 });
    const ranked = candidates.filter((person) => fits(user, person) && fits(person, user)).map((person) => {
      const common = shared(user, person);
      return { id: person.id, name: person.name, age: person.age, location: person.location,
        interests: common.interests, activities: common.activities,
        score: common.interests.length * 2 + common.activities.length * 3 };
    }).sort((a, b) => b.score - a.score).slice(0, 20);
    res.json({ candidates: ranked });
  });

  router.post("/blocks", async (req, res) => {
    const user = await self(clerkId(req));
    const { userId } = idBody.parse(req.body);
    if (userId === user.id) throw new ApiError(400, "Choose another account.");
    await db.$transaction(async (tx) => {
      await tx.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: userId } }, create: { blockerId: user.id, blockedId: userId }, update: {} });
      await tx.match.updateMany({ where: { OR: [{ user1Id: user.id, user2Id: userId }, { user1Id: userId, user2Id: user.id }] }, data: { status: "REJECTED" } });
    });
    res.status(204).end();
  });

  router.post("/reports", async (req, res) => {
    const user = await self(clerkId(req));
    const { userId, reason } = reportBody.parse(req.body);
    if (userId === user.id) throw new ApiError(400, "Choose another account.");
    await db.userReport.create({ data: { reporterId: user.id, subjectId: userId, reason } });
    res.status(201).json({ submitted: true });
  });

  router.post("/matches", async (req, res) => {
    const user = await self(clerkId(req));
    const { userId } = idBody.parse(req.body);
    const other = await db.user.findUnique({ where: { id: userId } });
    if (!other || !fits(user, other) || !fits(other, user)) throw new ApiError(409, "This match is unavailable.");
    eligible(other);
    const blocked = await db.userBlock.count({ where: { OR: [{ blockerId: user.id, blockedId: other.id }, { blockerId: other.id, blockedId: user.id }] } });
    if (blocked) throw new ApiError(403, "This match is unavailable.");
    const [user1Id, user2Id] = [user.id, other.id].sort();
    const match = await db.match.upsert({ where: { pairKey: `${user1Id}:${user2Id}` }, create: {
      pairKey: `${user1Id}:${user2Id}`, user1Id, user2Id, requestedById: user.id,
      acceptedByUser1: user.id === user1Id, acceptedByUser2: user.id === user2Id,
      compatibilityScore: shared(user, other).interests.length * 2 + shared(user, other).activities.length * 3,
    }, update: {} });
    res.status(201).json({ match });
  });

  router.get("/matches", async (req, res) => {
    const user = await self(clerkId(req));
    const matches = await db.match.findMany({ where: { OR: [{ user1Id: user.id }, { user2Id: user.id }] }, include: { user1: true, user2: true, datePlan: true }, orderBy: { updatedAt: "desc" } });
    res.json({ matches: matches.map((match) => {
      const other = match.user1Id === user.id ? match.user2 : match.user1;
      return { id: match.id, status: match.status, acceptedByMe: match.user1Id === user.id ? match.acceptedByUser1 : match.acceptedByUser2,
        acceptedByThem: match.user1Id === user.id ? match.acceptedByUser2 : match.acceptedByUser1,
        person: { id: other.id, name: other.name, age: other.age }, activities: shared(user, other).activities, plan: match.datePlan };
    }) });
  });

  router.post("/matches/:id/accept", async (req, res) => {
    const user = await self(clerkId(req));
    const match = await db.match.findFirst({ where: { id: String(req.params.id), OR: [{ user1Id: user.id }, { user2Id: user.id }] } });
    if (!match || match.status === "REJECTED") throw new ApiError(404, "Match unavailable.");
    const otherId = match.user1Id === user.id ? match.user2Id : match.user1Id;
    const blocked = await db.userBlock.count({ where: { OR: [{ blockerId: user.id, blockedId: otherId }, { blockerId: otherId, blockedId: user.id }] } });
    if (blocked) throw new ApiError(403, "Match unavailable.");
    const updated = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${match.id}, 0))`;
      const current = await tx.match.findUniqueOrThrow({ where: { id: match.id } });
      if (current.status === "REJECTED") throw new ApiError(409, "Match unavailable.");
      return tx.match.update({ where: { id: match.id }, data: {
      ...(match.user1Id === user.id ? { acceptedByUser1: true } : { acceptedByUser2: true }),
      status: match.user1Id === user.id ? current.acceptedByUser2 ? "ACTIVE" : "PENDING" : current.acceptedByUser1 ? "ACTIVE" : "PENDING",
    } });
    });
    res.json({ match: updated });
  });

  router.post("/matches/:id/decline", async (req, res) => {
    const user = await self(clerkId(req));
    await db.match.updateMany({ where: { id: String(req.params.id), OR: [{ user1Id: user.id }, { user2Id: user.id }] }, data: { status: "REJECTED" } });
    res.status(204).end();
  });

  async function activeMatch(matchId: string, user: User) {
    const match = await db.match.findFirst({ where: { id: matchId, status: { in: ["ACTIVE", "COMPLETED"] }, OR: [{ user1Id: user.id }, { user2Id: user.id }] }, include: { user1: true, user2: true, datePlan: true } });
    if (!match) throw new ApiError(404, "Match unavailable.");
    const other = match.user1Id === user.id ? match.user2 : match.user1;
    if (!other.isActive || await db.userBlock.count({ where: { OR: [{ blockerId: user.id, blockedId: other.id }, { blockerId: other.id, blockedId: user.id }] } })) throw new ApiError(403, "Match unavailable.");
    return { match, other };
  }

  router.get("/matches/:id/venues", async (req, res) => {
    const user = await self(clerkId(req));
    const { other } = await activeMatch(String(req.params.id), user);
    const activity = z.enum(dateActivities).parse(req.query.activity);
    if (!shared(user, other).activities.includes(activity)) throw new ApiError(400, "Choose a shared activity.");
    if (user.latitude == null || user.longitude == null || other.latitude == null || other.longitude == null) throw new ApiError(409, "Both people need to set an area.");
    const latitude = (user.latitude + other.latitude) / 2;
    const longitude = (user.longitude + other.longitude) / 2;
    res.json({ venues: await nearbyVenues(placesKey, activity, latitude, longitude) });
  });

  router.post("/matches/:id/plan", async (req, res) => {
    const user = await self(clerkId(req));
    const { match, other } = await activeMatch(String(req.params.id), user);
    const input = z.object({ activity: z.enum(dateActivities), venueId: z.string().min(1), scheduledAt: z.iso.datetime() }).parse(req.body);
    if (!shared(user, other).activities.includes(input.activity)) throw new ApiError(400, "Choose a shared activity.");
    const scheduledAt = new Date(input.scheduledAt);
    if (+scheduledAt < Date.now() + 30 * 60_000 || +scheduledAt > Date.now() + 30 * 86400_000) throw new ApiError(400, "Choose a time in the next 30 days.");
    if (user.latitude == null || user.longitude == null || other.latitude == null || other.longitude == null) throw new ApiError(409, "Both people need to set an area.");
    const venues = await nearbyVenues(placesKey, input.activity, (user.latitude + other.latitude) / 2, (user.longitude + other.longitude) / 2);
    const venue = venues.find((place) => place.id === input.venueId);
    if (!venue) throw new ApiError(400, "Choose an available venue.");
    const data = { activity: input.activity, venueId: venue.id, scheduledAt, location: venue.name,
      activities: [input.activity], status: "PROPOSED", proposedById: user.id,
      acceptedByUser1: match.user1Id === user.id, acceptedByUser2: match.user2Id === user.id };
    const plan = await db.datePlan.upsert({ where: { matchId: match.id }, create: {
      matchId: match.id, ...data, totalBudget: "", duration: "", vibe: "",
    }, update: { ...data, proposalVersion: { increment: 1 } } });
    res.json({ plan });
  });

  router.post("/matches/:id/plan/accept", async (req, res) => {
    const user = await self(clerkId(req));
    const { match } = await activeMatch(String(req.params.id), user);
    const { version } = z.object({ version: z.number().int().min(0) }).parse(req.body);
    const plan = await db.datePlan.findUnique({ where: { matchId: match.id } });
    if (!plan || plan.status !== "PROPOSED" || plan.proposalVersion !== version) throw new ApiError(409, "This proposal changed. Refresh and review it.");
    const updated = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${plan.id}, 0))`;
      const current = await tx.datePlan.findUniqueOrThrow({ where: { id: plan.id } });
      if (current.status !== "PROPOSED" || current.proposalVersion !== version) throw new ApiError(409, "This proposal changed. Refresh and review it.");
      return tx.datePlan.update({ where: { id: plan.id }, data: {
      ...(match.user1Id === user.id ? { acceptedByUser1: true } : { acceptedByUser2: true }),
      status: match.user1Id === user.id ? current.acceptedByUser2 ? "CONFIRMED" : "PROPOSED" : current.acceptedByUser1 ? "CONFIRMED" : "PROPOSED",
    } });
    });
    res.json({ plan: updated });
  });

  router.post("/matches/:id/plan/cancel", async (req, res) => {
    const user = await self(clerkId(req));
    const { match } = await activeMatch(String(req.params.id), user);
    await db.datePlan.updateMany({ where: { matchId: match.id }, data: { status: "CANCELLED" } });
    res.status(204).end();
  });

  router.post("/matches/:id/feedback", async (req, res) => {
    const user = await self(clerkId(req));
    const { match } = await activeMatch(String(req.params.id), user);
    const plan = match.datePlan;
    if (!plan?.scheduledAt || +plan.scheduledAt > Date.now()) throw new ApiError(409, "Feedback opens after the planned date.");
    const input = z.object({ attended: z.boolean(), rating: z.number().int().min(1).max(5), comfort: z.number().int().min(1).max(5), enjoyment: z.number().int().min(1).max(5), wouldMeetAgain: z.boolean(), review: z.string().trim().max(500).optional() }).parse(req.body);
    await db.feedback.upsert({ where: { matchId_userId: { matchId: match.id, userId: user.id } }, create: { matchId: match.id, userId: user.id, ...input }, update: input });
    res.json({ submitted: true });
  });

  return router;
}
