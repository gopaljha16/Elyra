ALTER TABLE "users" ADD COLUMN "dateActivities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "matches" ADD COLUMN "pairKey" TEXT, ADD COLUMN "requestedById" TEXT,
  ADD COLUMN "acceptedByUser1" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "acceptedByUser2" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "matches_pairKey_key" ON "matches"("pairKey");
ALTER TABLE "date_plans" ADD COLUMN "activity" TEXT, ADD COLUMN "venueId" TEXT,
  ADD COLUMN "scheduledAt" TIMESTAMP(3), ADD COLUMN "proposalVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "proposedById" TEXT, ADD COLUMN "acceptedByUser1" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "acceptedByUser2" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "feedbacks" ADD COLUMN "attended" BOOLEAN;
CREATE UNIQUE INDEX "feedbacks_matchId_userId_key" ON "feedbacks"("matchId", "userId");
CREATE TABLE "user_blocks" (
  "blockerId" TEXT NOT NULL, "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blockerId", "blockedId"),
  CONSTRAINT "user_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "user_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "user_reports" (
  "id" TEXT NOT NULL PRIMARY KEY, "reporterId" TEXT NOT NULL, "subjectId" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "user_reports_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
