/**
 * Regression check for the Task participant unread/new-activity notification
 * feature (Task.lastActivityAt + TaskReadState), against a real database.
 * Exercises the actual touchTaskActivity/markTaskViewed/hasUnreadTasks/
 * getVisibleTasks functions from src/lib/data/tasks.ts, plus the pure
 * permission helpers from src/lib/permissions.ts.
 *
 * Creates and tears down its own throwaway Company/User/Task rows (two
 * isolated companies, never touching the seeded TECHFIX company or any of
 * its real data) — everything is deleted at the end, success or failure.
 * Run directly with:
 *   npx tsx scripts/test-task-unread-notifications.ts
 */
import "dotenv/config"
import { prisma } from "../src/lib/prisma"
import { touchTaskActivity, markTaskViewed, hasUnreadTasks, getVisibleTasks } from "../src/lib/data/tasks"
import { canViewTask, isTaskParticipant, canManageTaskParticipants } from "../src/lib/permissions"

let failures = 0
function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  OK — ${label}`)
  } else {
    console.error(`  FAIL — ${label}`)
    failures++
  }
}

async function unreadFor(companyId: string, userId: string, role: "ADMIN" | "MANAGER" | "ENGINEER" | "RECEPTIONIST", taskId: string) {
  const tasks = await getVisibleTasks(companyId, userId, role)
  const task = tasks.find((t) => t.id === taskId)
  return task?.unread
}

async function main() {
  const suffix = Date.now()

  // ── Isolated Company 1: D (creator, ADMIN), E, F (participants) ─────────
  const company1 = await prisma.company.create({
    data: { name: `Test Co 1 ${suffix}`, code: `TESTCO1-${suffix}` },
  })
  const passwordHash = "test-hash-not-used-for-login"
  const D = await prisma.user.create({
    data: { companyId: company1.id, name: "D", email: `d-${suffix}@test.local`, passwordHash, role: "ADMIN" },
  })
  const E = await prisma.user.create({
    data: { companyId: company1.id, name: "E", email: `e-${suffix}@test.local`, passwordHash, role: "ENGINEER" },
  })
  const F = await prisma.user.create({
    data: { companyId: company1.id, name: "F", email: `f-${suffix}@test.local`, passwordHash, role: "RECEPTIONIST" },
  })

  // ── Isolated Company 2: G — used only for cross-tenant leak checks ──────
  const company2 = await prisma.company.create({
    data: { name: `Test Co 2 ${suffix}`, code: `TESTCO2-${suffix}` },
  })
  const G = await prisma.user.create({
    data: { companyId: company2.id, name: "G", email: `g-${suffix}@test.local`, passwordHash, role: "ADMIN" },
  })

  let taskId = ""

  try {
    console.log("\nCase A — D creates a Task with participants E, F")
    const now = new Date()
    const task = await prisma.task.create({
      data: {
        companyId: company1.id,
        title: "Install printer at HQ",
        createdById: D.id,
        createdAt: now,
        lastActivityAt: now,
        participants: { create: [{ userId: E.id }, { userId: F.id }] },
        steps: { create: { title: "Step 1", order: 1, createdById: D.id } },
        readStates: { create: { userId: D.id, lastViewedAt: now } },
      },
    })
    taskId = task.id

    check("A (creator) has no unread for their own new task", (await unreadFor(company1.id, D.id, "ADMIN", taskId)) === false)
    check("B/E has unread (new participant, never viewed)", (await unreadFor(company1.id, E.id, "ENGINEER", taskId)) === true)
    check("C/F has unread (new participant, never viewed)", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === true)
    check("Sidebar: E has an unread task", (await hasUnreadTasks(company1.id, E.id)) === true)
    check("Sidebar: F has an unread task", (await hasUnreadTasks(company1.id, F.id)) === true)
    check("Sidebar: D has no unread task", (await hasUnreadTasks(company1.id, D.id)) === false)

    console.log("\nCase B — E opens the Task")
    await markTaskViewed(taskId, E.id, (await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).lastActivityAt)
    check("E is now read", (await unreadFor(company1.id, E.id, "ENGINEER", taskId)) === false)
    check("F is still unread", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === true)

    console.log("\nCase C — D adds a new Task Step")
    await prisma.taskStep.create({ data: { taskId, title: "Step 2", order: 2, createdById: D.id } })
    await touchTaskActivity(taskId, D.id)
    check("D (actor) has no unread from their own action", (await unreadFor(company1.id, D.id, "ADMIN", taskId)) === false)
    check("E becomes unread again (new activity since last view)", (await unreadFor(company1.id, E.id, "ENGINEER", taskId)) === true)
    check("F remains unread", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === true)

    console.log("\nCase D — E opens the Task again")
    await markTaskViewed(taskId, E.id, (await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).lastActivityAt)
    check("E is read", (await unreadFor(company1.id, E.id, "ENGINEER", taskId)) === false)
    check("F is unread", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === true)

    console.log("\nCase E — F opens the Task")
    await markTaskViewed(taskId, F.id, (await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).lastActivityAt)
    check("E is read", (await unreadFor(company1.id, E.id, "ENGINEER", taskId)) === false)
    check("F is read", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === false)
    check("Sidebar red dot cleared for E", (await hasUnreadTasks(company1.id, E.id)) === false)
    check("Sidebar red dot cleared for F", (await hasUnreadTasks(company1.id, F.id)) === false)

    console.log("\nCase F — E adds their own Task Step (self-action must not self-notify)")
    await prisma.taskStep.create({ data: { taskId, title: "Step 3", order: 3, createdById: E.id } })
    await touchTaskActivity(taskId, E.id)
    check("E (actor) has no unread from their own step", (await unreadFor(company1.id, E.id, "ENGINEER", taskId)) === false)
    check("D (creator/participant) becomes unread", (await unreadFor(company1.id, D.id, "ADMIN", taskId)) === true)
    check("F (participant) becomes unread", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === true)

    console.log("\ncomplete/reopen — status change is business activity")
    await markTaskViewed(taskId, D.id, (await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).lastActivityAt)
    await prisma.task.update({ where: { id: taskId }, data: { status: "COMPLETED", completedAt: new Date() } })
    await touchTaskActivity(taskId, D.id)
    check("D (actor of completeTask) has no unread", (await unreadFor(company1.id, D.id, "ADMIN", taskId)) === false)
    check("F becomes unread on completeTask", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === true)
    await markTaskViewed(taskId, F.id, (await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).lastActivityAt)
    await prisma.task.update({ where: { id: taskId }, data: { status: "ACTIVE", completedAt: null } })
    await touchTaskActivity(taskId, D.id)
    check("F becomes unread again on reopenTask", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === true)

    console.log("\nimage add/delete activity")
    await markTaskViewed(taskId, F.id, (await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).lastActivityAt)
    const step = await prisma.taskStep.findFirstOrThrow({ where: { taskId }, orderBy: { order: "asc" } })
    const image = await prisma.taskStepImage.create({
      data: { stepId: step.id, url: "/uploads/test.jpg", filename: "test.jpg", uploadedById: D.id },
    })
    await touchTaskActivity(taskId, D.id)
    check("F becomes unread when an image is added", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === true)
    await markTaskViewed(taskId, F.id, (await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).lastActivityAt)
    await prisma.taskStepImage.delete({ where: { id: image.id } })
    await touchTaskActivity(taskId, D.id)
    check("F becomes unread when an image is deleted", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === true)

    console.log("\nadd/remove participant activity + removed participant stops being notified")
    await markTaskViewed(taskId, F.id, (await prisma.task.findUniqueOrThrow({ where: { id: taskId } })).lastActivityAt)
    const participantRow = await prisma.taskParticipant.findFirstOrThrow({ where: { taskId, userId: F.id } })
    await prisma.taskParticipant.delete({ where: { id: participantRow.id } })
    await touchTaskActivity(taskId, D.id)
    check("Removed participant F is no longer in D's/anyone's unread scope for this task", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === undefined)
    check("Sidebar: removed F has no unread task (isolated company, no other tasks)", (await hasUnreadTasks(company1.id, F.id)) === false)

    await prisma.taskParticipant.create({ data: { taskId, userId: F.id } })
    await touchTaskActivity(taskId, D.id)
    check("Re-added F is unread again (fresh participation, never viewed)", (await unreadFor(company1.id, F.id, "RECEPTIONIST", taskId)) === true)

    console.log("\npermission / tenant isolation")
    check(
      "canViewTask: non-participant, non-admin role cannot view",
      canViewTask("RECEPTIONIST", G.id, { createdById: D.id, participants: [{ userId: E.id }] }) === false
    )
    check(
      "isTaskParticipant: creator counts as participant even without an explicit row",
      isTaskParticipant(D.id, { createdById: D.id, participants: [] }) === true
    )
    check(
      "canManageTaskParticipants: plain participant (not creator) cannot manage",
      canManageTaskParticipants("ENGINEER", E.id, { status: "ACTIVE", createdById: D.id }) === false
    )

    const nonExistentId = "00000000-0000-0000-0000-000000000000"
    const missing = await prisma.task.findFirst({ where: { id: nonExistentId, companyId: company1.id } })
    check("Non-existent taskId resolves to null (no read-state can be created)", missing === null)

    const crossCompany = await prisma.task.findFirst({ where: { id: taskId, companyId: company2.id } })
    check("Cross-company taskId lookup (task1 scoped to company2) returns null", crossCompany === null)

    check("Company2 user G is unaffected by Company1 task activity", (await hasUnreadTasks(company2.id, G.id)) === false)

    const visibleToG = await getVisibleTasks(company2.id, G.id, "ADMIN")
    check("getVisibleTasks(company2, G) never returns Company1's task", !visibleToG.some((t) => t.id === taskId))
  } finally {
    console.log("\nCleaning up test data...")
    if (taskId) await prisma.task.delete({ where: { id: taskId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { companyId: { in: [company1.id, company2.id] } } })
    await prisma.company.deleteMany({ where: { id: { in: [company1.id, company2.id] } } })
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`)
  await prisma.$disconnect()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
