ALTER TABLE "feedbacks" ADD COLUMN "planVersion" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "feedbacks_matchId_userId_key";
CREATE UNIQUE INDEX "feedbacks_matchId_userId_planVersion_key" ON "feedbacks"("matchId", "userId", "planVersion");
