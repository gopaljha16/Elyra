import { Router } from "express";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { ApiError, lock } from "../onboarding/profile.js";
import { clerkId } from "../onboarding/routes.js";

export function moderationRoutes(db: PrismaClient, adminIds: string[]) {
  const router = Router();
  router.use((req, res, next) => {
    const reviewer = clerkId(req);
    if (!adminIds.includes(reviewer)) throw new ApiError(403, "Administrator access required.");
    res.set("Cache-Control", "no-store");
    next();
  });

  router.get("/reports", async (_req, res) => {
    const reports = await db.userReport.findMany({
      where: { resolvedAt: null },
      include: {
        reporter: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    res.json({ reports });
  });

  router.post("/reports/:id/resolve", async (req, res) => {
    const reviewerId = clerkId(req);
    const { disposition } = z
      .object({ disposition: z.enum(["DISMISSED", "SUSPENDED"]) })
      .parse(req.body);
    const id = String(req.params.id);
    const report = await db.$transaction(async (tx) => {
      await lock(tx, `report:${id}`);
      const current = await tx.userReport.findUnique({ where: { id } });
      if (!current) throw new ApiError(404, "Report not found.");
      if (current.resolvedAt) return current;
      if (disposition === "SUSPENDED") {
        await tx.user.update({ where: { id: current.subjectId }, data: { isActive: false } });
        const matches = await tx.match.findMany({
          where: { OR: [{ user1Id: current.subjectId }, { user2Id: current.subjectId }] },
          select: { id: true },
        });
        await tx.match.updateMany({
          where: { id: { in: matches.map((match) => match.id) } },
          data: { status: "REJECTED" },
        });
        await tx.datePlan.updateMany({
          where: { matchId: { in: matches.map((match) => match.id) } },
          data: { status: "CANCELLED" },
        });
      }
      return tx.userReport.update({
        where: { id },
        data: { resolvedAt: new Date(), disposition, reviewerId },
      });
    });
    res.json({ report });
  });

  return router;
}
