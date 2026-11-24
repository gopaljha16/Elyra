ALTER TABLE "user_reports" ADD COLUMN "resolvedAt" TIMESTAMP(3), ADD COLUMN "disposition" TEXT, ADD COLUMN "reviewerId" TEXT;
CREATE INDEX "user_reports_resolvedAt_createdAt_idx" ON "user_reports"("resolvedAt", "createdAt");
