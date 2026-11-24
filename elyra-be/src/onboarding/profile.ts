import { z } from "zod";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";
import { answers, genders, interests, matchGenders, relationships } from "./options.js";

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(50),
  age: z.number().int().min(18).max(100),
  gender: z.enum(genders),
  location: z.string().trim().min(1).max(120),
  bio: z.string().trim().max(500).nullish().transform((value) => value ?? undefined),
  interests: z.array(z.enum(interests)).min(3).max(10)
    .refine((values) => new Set(values).size === values.length, "Select distinct interests"),
  personalityAnswers: z.object({
    weekend: z.enum(answers.weekend),
    connection: z.enum(answers.connection),
    spontaneity: z.enum(answers.spontaneity),
  }),
  preferences: z.object({
    minAge: z.number().int().min(18).max(100),
    maxAge: z.number().int().min(18).max(100),
    gender: z.enum(matchGenders),
    maxDistance: z.number().int().min(1).max(20000),
    relationship: z.enum(relationships),
  }).refine(({ minAge, maxAge }) => minAge <= maxAge, "Enter an ordered age range"),
});

export function createDatabase(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export async function lock(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
