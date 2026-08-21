-- Task participant unread/new-activity notifications.
--
-- Task.lastActivityAt: timestamp of the most recent real business action on
-- the task (step added/edited/deleted, image added/removed, status change,
-- participant added/removed — see touchTaskActivity in src/lib/data/tasks.ts).
-- Added nullable first so existing rows are never dropped, backfilled from
-- the latest of createdAt/updatedAt (the closest available signal for
-- historical tasks), then locked to NOT NULL with a DEFAULT for future rows.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

UPDATE "Task" SET "lastActivityAt" = GREATEST("createdAt", "updatedAt") WHERE "lastActivityAt" IS NULL;

ALTER TABLE "Task" ALTER COLUMN "lastActivityAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Task" ALTER COLUMN "lastActivityAt" SET NOT NULL;

-- TaskReadState: per (task, user) "last viewed" marker — a task is unread for
-- a user when it has no row here, or when Task.lastActivityAt is later than
-- this row's lastViewedAt. Deliberately per-user rather than a global
-- Task.isUnread flag, since the same task is independently read/unread for
-- each participant.
CREATE TABLE IF NOT EXISTS "TaskReadState" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastViewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskReadState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskReadState_taskId_userId_key" ON "TaskReadState"("taskId", "userId");
CREATE INDEX IF NOT EXISTS "TaskReadState_userId_idx" ON "TaskReadState"("userId");

DO $$ BEGIN
  ALTER TABLE "TaskReadState" ADD CONSTRAINT "TaskReadState_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TaskReadState" ADD CONSTRAINT "TaskReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
