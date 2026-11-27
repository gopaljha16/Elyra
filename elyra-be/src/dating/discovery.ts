import { z } from "zod";
import type { Prisma, PrismaClient, User } from "@prisma/client";

const fields = {
  id: true,
  age: true,
  name: true,
  gender: true,
  location: true,
  latitude: true,
  longitude: true,
  preferences: true,
  interests: true,
  dateActivities: true,
  personalityAnswers: true,
} as const;
type Profile = Pick<User, keyof typeof fields>;
const preferences = z.object({
  minAge: z.number(),
  maxAge: z.number(),
  gender: z.string(),
  maxDistance: z.number(),
  relationship: z.string(),
});

export function fits(viewer: Profile, candidate: Profile) {
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

export function shared(a: Profile, b: Profile) {
  return {
    interests: a.interests.filter((item) => b.interests.includes(item)),
    activities: a.dateActivities.filter((item) => b.dateActivities.includes(item)),
  };
}

export function compatibility(a: Profile, b: Profile) {
  const common = shared(a, b);
  const first = z.record(z.string(), z.string()).safeParse(a.personalityAnswers);
  const second = z.record(z.string(), z.string()).safeParse(b.personalityAnswers);
  const personality =
    first.success && second.success
      ? Object.keys(first.data).filter((key) => first.data[key] === second.data[key]).length
      : 0;
  return common.interests.length * 2 + common.activities.length * 3 + personality;
}

export function areaBounds(latitude: number, longitude: number, km: number): Prisma.UserWhereInput {
  const degrees = 180 / Math.PI;
  const angle = km / 6371;
  const delta = angle * degrees;
  const latitudeRange = { latitude: { gte: latitude - delta, lte: latitude + delta } };
  if (Math.abs(latitude) + delta >= 90) return latitudeRange;
  const span = degrees * Math.asin(Math.sin(angle) / Math.cos(latitude / degrees));
  const west = longitude - span,
    east = longitude + span;
  if (west < -180 || east > 180) {
    return {
      ...latitudeRange,
      OR: [
        { longitude: { gte: west < -180 ? west + 360 : west } },
        { longitude: { lte: east > 180 ? east - 360 : east } },
      ],
    };
  }
  return { ...latitudeRange, longitude: { gte: west, lte: east } };
}

function rank(user: Profile, candidates: Profile[]) {
  return candidates
    .filter((other) => fits(user, other) && fits(other, user))
    .map((other) => {
      const common = shared(user, other);
      return {
        id: other.id,
        name: other.name,
        age: other.age,
        location: other.location,
        ...common,
        score: compatibility(user, other),
      };
    });
}
type Candidate = ReturnType<typeof rank>[number];
export async function discover(db: PrismaClient, user: User, radius: boolean) {
  const prefs = preferences.safeParse(user.preferences);
  if (!prefs.success || user.latitude === null || user.longitude === null) return [];
  const where: Prisma.UserWhereInput = {
    isActive: true,
    isOnboarded: true,
    verificationStatus: "VERIFIED",
    liveVerifiedAt: { not: null },
    id: { not: user.id },
    livePrimaryPhotoUrl: { equals: db.user.fields.primaryPhotoUrl },
    blocksMade: { none: { blockedId: user.id } },
    blocksReceived: { none: { blockerId: user.id } },
    matchesAsUser1: { none: { user2Id: user.id } },
    matchesAsUser2: { none: { user1Id: user.id } },
    ...(radius
      ? {
          ...areaBounds(user.latitude, user.longitude, prefs.data.maxDistance),
          age: { gte: prefs.data.minAge, lte: prefs.data.maxAge },
        }
      : { location: { equals: user.location, mode: "insensitive" } }),
  };
  const size = radius ? 256 : 100;
  let lastId: string | undefined;
  let best: Candidate[] = [];
  do {
    const batch: Profile[] = await db.user.findMany({
      where: lastId ? { AND: [where, { id: { gt: lastId } }] } : where,
      select: fields,
      take: size,
      orderBy: { id: "asc" },
    });
    best = best
      .concat(rank(user, batch))
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, 20);
    lastId = radius && batch.length === size ? batch[batch.length - 1].id : undefined;
  } while (lastId);
  return best;
}
