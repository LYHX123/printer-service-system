// Split out from src/lib/data/tasks.ts (a server-only module that pulls in
// Prisma/pg) so client components — e.g. the App-mode Tasks list, which
// already has each task's lastActivityAt and just needs to know the
// threshold to compute the same overdue flag for display — can import this
// single constant without bundling the whole server-only data layer.
export const OVERDUE_DAYS = 2
