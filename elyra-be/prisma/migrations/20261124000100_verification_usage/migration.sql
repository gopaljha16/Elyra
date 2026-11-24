BEGIN;
ALTER TABLE "verification_logs"
  ADD COLUMN "failureReason" TEXT,
  ADD COLUMN "attemptIpHash" TEXT,
  ADD COLUMN "geminiRequestedAt" TIMESTAMP(3),
  ADD COLUMN "geminiImageBytes" INTEGER;
CREATE INDEX "verification_logs_userId_createdAt_idx" ON "verification_logs"("userId", "createdAt");
CREATE INDEX "verification_logs_attemptIpHash_createdAt_idx" ON "verification_logs"("attemptIpHash", "createdAt");
CREATE INDEX "verification_logs_geminiRequestedAt_idx" ON "verification_logs"("geminiRequestedAt");
COMMIT;
