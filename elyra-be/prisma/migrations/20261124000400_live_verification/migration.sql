ALTER TABLE "users" ADD COLUMN "liveVerifiedAt" TIMESTAMP(3), ADD COLUMN "livePrimaryPhotoUrl" TEXT;
CREATE TABLE "live_sessions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "primaryPhotoUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "result" TEXT NOT NULL DEFAULT 'PENDING',
  CONSTRAINT "live_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "live_sessions_userId_createdAt_idx" ON "live_sessions"("userId", "createdAt");
