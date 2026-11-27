import { Router } from "express";
import { z } from "zod";
import type { PrismaClient, User } from "@prisma/client";
import { ApiError } from "../onboarding/profile.js";
import { clerkId } from "../onboarding/routes.js";
import { dateActivities } from "./options.js";
import { nearbyVenues } from "./venues.js";
import sharp from "sharp";
import type { Storage } from "../onboarding/routes.js";

const idBody = z.object({ userId: z.string().min(1) });
const reportBody = idBody.extend({ reason: z.string().trim().min(5).max(500) });
const preferences = z.object({
  minAge: z.number(),
  maxAge: z.number(),
  gender: z.string(),
  maxDistance: z.number(),
  relationship: z.string(),
});

function eligible(user: User) {
  if (
    !user.isActive ||
    !user.isOnboarded ||
    user.verificationStatus !== "VERIFIED" ||
    !user.liveVerifiedAt ||
    user.livePrimaryPhotoUrl !== user.primaryPhotoUrl
  ) {
    throw new ApiError(403, "Complete live face verification before matching.");
  }
}

function fits(viewer: User, candidate: User) {
  const prefs = preferences.safeParse(viewer.preferences);
  if (!prefs.success) return false;
  const p = prefs.data;
  const otherPreferences = preferences.safeParse(candidate.preferences);
  if (!otherPreferences.success) return false;
  const relationshipFits =
    p.relationship === otherPreferences.data.relationship ||
    p.relationship === "Still figuring it out" ||
    otherPreferences.data.relationship === "Still figuring it out";
  const acceptedGender =
    p.gender === "Everyone" ||
    p.gender === ({ Woman: "Women", Man: "Men" } as Record<string, string>)[candidate.gender] ||
    (p.gender === "Nonbinary people" && candidate.gender === "Nonbinary");
  const distance =
    viewer.latitude != null &&
    viewer.longitude != null &&
    candidate.latitude != null &&
    candidate.longitude != null
      ? (() => {
          const toRadians = Math.PI / 180;
          const deltaLatitude = (candidate.latitude! - viewer.latitude!) * toRadians;
          const deltaLongitude = (candidate.longitude! - viewer.longitude!) * toRadians;
          const arc =
            Math.sin(deltaLatitude / 2) ** 2 +
            Math.cos(viewer.latitude! * toRadians) *
              Math.cos(candidate.latitude! * toRadians) *
              Math.sin(deltaLongitude / 2) ** 2;
          return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(arc)));
        })()
      : null;
  return (
    relationshipFits &&
    acceptedGender &&
    candidate.age >= p.minAge &&
    candidate.age <= p.maxAge &&
    distance !== null &&
    distance <= p.maxDistance
  );
}

function shared(a: User, b: User) {
  return {
    interests: a.interests.filter((item) => b.interests.includes(item)),
    activities: a.dateActivities.filter((item) => b.dateActivities.includes(item)),
  };
}

function compatibility(a: User, b: User) {
  const common = shared(a, b);
  const first = z.record(z.string(), z.string()).safeParse(a.personalityAnswers);
  const second = z.record(z.string(), z.string()).safeParse(b.personalityAnswers);
  const personality =
    first.success && second.success
      ? Object.keys(first.data).filter((key) => first.data[key] === second.data[key]).length
      : 0;
  return common.interests.length * 2 + common.activities.length * 3 + personality;
}

export function datingRoutes(db: PrismaClient, placesKey = "", storage?: Storage) {
  const router = Router();
  router.use((req, res, next) => {
    clerkId(req);
    res.set("Cache-Control", "no-store");
    next();
  });

  async function self(clerk: string) {
    const user = await db.user.findUnique({ where: { clerkId: clerk } });
    if (!user) throw new ApiError(403, "Complete onboarding first.");
    eligible(user);
    return user;
  }

  router.put("/area", async (req, res) => {
    const user = await self(clerkId(req));
    const area = z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        location: z.string().trim().min(2).max(120),
      })
      .parse(req.body);
    await db.user.update({ where: { id: user.id }, data: area });
    res.json({ saved: true });
  });

  router.get("/candidates", async (req, res) => {
    const user = await self(clerkId(req));
    const excluded = await db.userBlock.findMany({
      where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] },
    });
    const ids = new Set(
      excluded.map((block) => (block.blockerId === user.id ? block.blockedId : block.blockerId)),
    );
    const existing = await db.match.findMany({
      where: { OR: [{ user1Id: user.id }, { user2Id: user.id }] },
    });
    for (const match of existing)
      ids.add(match.user1Id === user.id ? match.user2Id : match.user1Id);
    ids.add(user.id);
    const candidates = await db.user.findMany({
      where: {
        id: { notIn: [...ids] },
        isActive: true,
        isOnboarded: true,
        verificationStatus: "VERIFIED",
        liveVerifiedAt: { not: null },
        location: { equals: user.location, mode: "insensitive" },
      },
      take: 100,
    });
    const ranked = candidates
      .filter(
        (person) =>
          person.livePrimaryPhotoUrl === person.primaryPhotoUrl &&
          fits(user, person) &&
          fits(person, user),
      )
      .map((person) => {
        const common = shared(user, person);
        return {
          id: person.id,
          name: person.name,
          age: person.age,
          location: person.location,
          interests: common.interests,
          activities: common.activities,
          score: compatibility(user, person),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    console.info(JSON.stringify({ event: "discovery_results", count: ranked.length }));
    res.json({ candidates: ranked });
  });

  router.get("/people/:id/photo", async (req, res) => {
    const user = await self(clerkId(req));
    const other = await db.user.findUnique({ where: { id: String(req.params.id) } });
    if (
      !storage ||
      !other?.primaryPhotoUrl ||
      other.location.toLowerCase() !== user.location.toLowerCase() ||
      !fits(user, other) ||
      !fits(other, user)
    )
      throw new ApiError(404, "Photo unavailable.");
    eligible(other);
    const blocked = await db.userBlock.count({
      where: {
        OR: [
          { blockerId: user.id, blockedId: other.id },
          { blockerId: other.id, blockedId: user.id },
        ],
      },
    });
    if (blocked) throw new ApiError(404, "Photo unavailable.");
    const { bytes } = await storage.download(other.primaryPhotoUrl, other.clerkId);
    const thumbnail = await sharp(bytes)
      .rotate()
      .resize(320, 320, { fit: "cover" })
      .webp({ quality: 65 })
      .toBuffer();
    res.set("Cache-Control", "private, max-age=60").type("image/webp").send(thumbnail);
  });

  router.post("/blocks", async (req, res) => {
    const user = await self(clerkId(req));
    const { userId } = idBody.parse(req.body);
    if (userId === user.id) throw new ApiError(400, "Choose another account.");
    await db.$transaction(async (tx) => {
      await tx.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: user.id, blockedId: userId } },
        create: { blockerId: user.id, blockedId: userId },
        update: {},
      });
      await tx.match.updateMany({
        where: {
          OR: [
            { user1Id: user.id, user2Id: userId },
            { user1Id: userId, user2Id: user.id },
          ],
        },
        data: { status: "REJECTED" },
      });
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
    if (!other || !fits(user, other) || !fits(other, user))
      throw new ApiError(409, "This match is unavailable.");
    eligible(other);
    const blocked = await db.userBlock.count({
      where: {
        OR: [
          { blockerId: user.id, blockedId: other.id },
          { blockerId: other.id, blockedId: user.id },
        ],
      },
    });
    if (blocked) throw new ApiError(403, "This match is unavailable.");
    const [user1Id, user2Id] = [user.id, other.id].sort();
    const match = await db.match.upsert({
      where: { pairKey: `${user1Id}:${user2Id}` },
      create: {
        pairKey: `${user1Id}:${user2Id}`,
        user1Id,
        user2Id,
        requestedById: user.id,
        acceptedByUser1: user.id === user1Id,
        acceptedByUser2: user.id === user2Id,
        compatibilityScore: compatibility(user, other),
      },
      update: {},
    });
    res.status(201).json({ match });
  });

  router.get("/matches", async (req, res) => {
    const user = await self(clerkId(req));
    const matches = await db.match.findMany({
      where: { status: { not: "REJECTED" }, OR: [{ user1Id: user.id }, { user2Id: user.id }] },
      include: {
        user1: true,
        user2: true,
        datePlan: true,
        feedbacks: {
          select: { userId: true, attended: true, wouldMeetAgain: true, planVersion: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json({
      matches: matches.map((match) => {
        const other = match.user1Id === user.id ? match.user2 : match.user1;
        const feedback = match.feedbacks.filter(
          (entry) => entry.planVersion === match.datePlan?.proposalVersion,
        );
        return {
          id: match.id,
          status: match.status,
          acceptedByMe: match.user1Id === user.id ? match.acceptedByUser1 : match.acceptedByUser2,
          acceptedByThem: match.user1Id === user.id ? match.acceptedByUser2 : match.acceptedByUser1,
          person: { id: other.id, name: other.name, age: other.age },
          activities: shared(user, other).activities,
          plan: match.datePlan,
          feedbackSubmitted: feedback.some((entry) => entry.userId === user.id),
          bothWantAgain:
            feedback.length === 2 &&
            feedback.every((entry) => entry.attended && entry.wouldMeetAgain),
        };
      }),
    });
  });

  router.post("/matches/:id/accept", async (req, res) => {
    const user = await self(clerkId(req));
    const match = await db.match.findFirst({
      where: { id: String(req.params.id), OR: [{ user1Id: user.id }, { user2Id: user.id }] },
    });
    if (!match || match.status === "REJECTED") throw new ApiError(404, "Match unavailable.");
    const otherId = match.user1Id === user.id ? match.user2Id : match.user1Id;
    const blocked = await db.userBlock.count({
      where: {
        OR: [
          { blockerId: user.id, blockedId: otherId },
          { blockerId: otherId, blockedId: user.id },
        ],
      },
    });
    if (blocked) throw new ApiError(403, "Match unavailable.");
    const updated = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${match.id}, 0))`;
      const current = await tx.match.findUniqueOrThrow({ where: { id: match.id } });
      if (current.status === "REJECTED") throw new ApiError(409, "Match unavailable.");
      return tx.match.update({
        where: { id: match.id },
        data: {
          ...(match.user1Id === user.id ? { acceptedByUser1: true } : { acceptedByUser2: true }),
          status:
            match.user1Id === user.id
              ? current.acceptedByUser2
                ? "ACTIVE"
                : "PENDING"
              : current.acceptedByUser1
                ? "ACTIVE"
                : "PENDING",
        },
      });
    });
    res.json({ match: updated });
  });

  router.post("/matches/:id/decline", async (req, res) => {
    const user = await self(clerkId(req));
    await db.match.updateMany({
      where: { id: String(req.params.id), OR: [{ user1Id: user.id }, { user2Id: user.id }] },
      data: { status: "REJECTED" },
    });
    res.status(204).end();
  });

  async function activeMatch(matchId: string, user: User) {
    const match = await db.match.findFirst({
      where: {
        id: matchId,
        status: { in: ["ACTIVE", "COMPLETED"] },
        OR: [{ user1Id: user.id }, { user2Id: user.id }],
      },
      include: { user1: true, user2: true, datePlan: true },
    });
    if (!match) throw new ApiError(404, "Match unavailable.");
    const other = match.user1Id === user.id ? match.user2 : match.user1;
    if (
      !other.isActive ||
      (await db.userBlock.count({
        where: {
          OR: [
            { blockerId: user.id, blockedId: other.id },
            { blockerId: other.id, blockedId: user.id },
          ],
        },
      }))
    )
      throw new ApiError(403, "Match unavailable.");
    return { match, other };
  }

  router.get("/matches/:id/venues", async (req, res) => {
    const user = await self(clerkId(req));
    const { other } = await activeMatch(String(req.params.id), user);
    const activity = z.enum(dateActivities).parse(req.query.activity);
    if (!shared(user, other).activities.includes(activity))
      throw new ApiError(400, "Choose a shared activity.");
    if (
      user.latitude == null ||
      user.longitude == null ||
      other.latitude == null ||
      other.longitude == null
    )
      throw new ApiError(409, "Both people need to set an area.");
    const latitude = (user.latitude + other.latitude) / 2;
    const longitude = (user.longitude + other.longitude) / 2;
    res.json({ venues: await nearbyVenues(placesKey, activity, latitude, longitude) });
  });

  router.post("/matches/:id/plan", async (req, res) => {
    const user = await self(clerkId(req));
    const { match, other } = await activeMatch(String(req.params.id), user);
    const input = z
      .object({
        activity: z.enum(dateActivities),
        venueId: z.string().min(1),
        scheduledAt: z.iso.datetime(),
      })
      .parse(req.body);
    if (!shared(user, other).activities.includes(input.activity))
      throw new ApiError(400, "Choose a shared activity.");
    const scheduledAt = new Date(input.scheduledAt);
    if (+scheduledAt < Date.now() + 30 * 60_000 || +scheduledAt > Date.now() + 30 * 86400_000)
      throw new ApiError(400, "Choose a time in the next 30 days.");
    if (
      user.latitude == null ||
      user.longitude == null ||
      other.latitude == null ||
      other.longitude == null
    )
      throw new ApiError(409, "Both people need to set an area.");
    const venues = await nearbyVenues(
      placesKey,
      input.activity,
      (user.latitude + other.latitude) / 2,
      (user.longitude + other.longitude) / 2,
    );
    const venue = venues.find((place) => place.id === input.venueId);
    if (!venue) throw new ApiError(400, "Choose an available venue.");
    const data = {
      activity: input.activity,
      venueId: venue.id,
      scheduledAt,
      location: venue.name,
      activities: [input.activity],
      status: "PROPOSED",
      proposedById: user.id,
      acceptedByUser1: match.user1Id === user.id,
      acceptedByUser2: match.user2Id === user.id,
    };
    const plan = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${match.id}, 0))`;
      const current = await tx.datePlan.findUnique({ where: { matchId: match.id } });
      if (current?.status === "CONFIRMED") {
        if (current.scheduledAt && +current.scheduledAt > Date.now())
          throw new ApiError(409, "Cancel the confirmed plan before proposing another.");
        const feedback = await tx.feedback.findMany({
          where: { matchId: match.id, planVersion: current.proposalVersion },
          select: { attended: true, wouldMeetAgain: true },
        });
        if (
          feedback.length !== 2 ||
          !feedback.every((entry) => entry.attended && entry.wouldMeetAgain)
        )
          throw new ApiError(409, "Another date needs interest from both people.");
      }
      return current
        ? tx.datePlan.update({
            where: { id: current.id },
            data: { ...data, proposalVersion: { increment: 1 } },
          })
        : tx.datePlan.create({
            data: { matchId: match.id, ...data, totalBudget: "", duration: "", vibe: "" },
          });
    });
    res.json({ plan });
  });

  router.post("/matches/:id/plan/accept", async (req, res) => {
    const user = await self(clerkId(req));
    const { match } = await activeMatch(String(req.params.id), user);
    const { version } = z.object({ version: z.number().int().min(0) }).parse(req.body);
    const plan = await db.datePlan.findUnique({ where: { matchId: match.id } });
    if (!plan || plan.status !== "PROPOSED" || plan.proposalVersion !== version)
      throw new ApiError(409, "This proposal changed. Refresh and review it.");
    const updated = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${plan.id}, 0))`;
      const current = await tx.datePlan.findUniqueOrThrow({ where: { id: plan.id } });
      if (current.status !== "PROPOSED" || current.proposalVersion !== version)
        throw new ApiError(409, "This proposal changed. Refresh and review it.");
      return tx.datePlan.update({
        where: { id: plan.id },
        data: {
          ...(match.user1Id === user.id ? { acceptedByUser1: true } : { acceptedByUser2: true }),
          status:
            match.user1Id === user.id
              ? current.acceptedByUser2
                ? "CONFIRMED"
                : "PROPOSED"
              : current.acceptedByUser1
                ? "CONFIRMED"
                : "PROPOSED",
        },
      });
    });
    res.json({ plan: updated });
  });

  router.post("/matches/:id/plan/cancel", async (req, res) => {
    const user = await self(clerkId(req));
    const { match } = await activeMatch(String(req.params.id), user);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${match.id}, 0))`;
      await tx.datePlan.updateMany({
        where: { matchId: match.id, status: { in: ["PROPOSED", "CONFIRMED"] } },
        data: { status: "CANCELLED", proposalVersion: { increment: 1 } },
      });
    });
    res.status(204).end();
  });

  router.post("/matches/:id/feedback", async (req, res) => {
    const user = await self(clerkId(req));
    const { match } = await activeMatch(String(req.params.id), user);
    const plan = match.datePlan;
    if (plan?.status !== "CONFIRMED" || !plan.scheduledAt || +plan.scheduledAt > Date.now())
      throw new ApiError(409, "Feedback opens after a confirmed date.");
    const version = z
      .object({ version: z.number().int().optional(), formVersion: z.literal(2).optional() })
      .parse(req.body);
    if (version.version !== undefined && version.version !== plan.proposalVersion)
      throw new ApiError(409, "This date changed. Refresh your matches.");
    const input =
      req.body.attended === false
        ? { attended: false, rating: null, comfort: null, enjoyment: null, wouldMeetAgain: null }
        : z
            .object({
              attended: z.literal(true),
              rating: z.number().int().min(1).max(5),
              comfort: z.number().int().min(1).max(5),
              enjoyment: z.number().int().min(1).max(5),
              wouldMeetAgain: z.boolean(),
              review: z.string().trim().max(500).optional(),
            })
            .parse(req.body);
    await db.feedback.upsert({
      where: {
        matchId_userId_planVersion: {
          matchId: match.id,
          userId: user.id,
          planVersion: plan.proposalVersion,
        },
      },
      create: {
        matchId: match.id,
        userId: user.id,
        planVersion: plan.proposalVersion,
        ...input,
        formVersion: version.formVersion ?? 1,
      },
      update: { ...input, formVersion: version.formVersion ?? 1 },
    });
    res.json({ submitted: true });
  });

  router.post("/matches/:id/no-show", async (req, res) => {
    const user = await self(clerkId(req));
    const { match } = await activeMatch(String(req.params.id), user);
    const plan = match.datePlan;
    if (plan?.status !== "CONFIRMED" || !plan.scheduledAt || +plan.scheduledAt > Date.now())
      throw new ApiError(409, "No-show reporting opens after a confirmed date.");
    await db.feedback.upsert({
      where: {
        matchId_userId_planVersion: {
          matchId: match.id,
          userId: user.id,
          planVersion: plan.proposalVersion,
        },
      },
      create: {
        matchId: match.id,
        userId: user.id,
        planVersion: plan.proposalVersion,
        attended: false,
        rating: null,
        comfort: null,
        enjoyment: null,
        wouldMeetAgain: null,
      },
      update: {
        attended: false,
        rating: null,
        comfort: null,
        enjoyment: null,
        wouldMeetAgain: null,
      },
    });
    res.json({ submitted: true });
  });

  return router;
}
