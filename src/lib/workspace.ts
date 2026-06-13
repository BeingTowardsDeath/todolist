import type { PrismaClient } from '@prisma/client';

export async function clearUserWorkspace(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.$transaction([
    prisma.idea.deleteMany({ where: { userId } }),
    prisma.todo.deleteMany({ where: { userId } }),
    prisma.consoleLog.deleteMany({ where: { userId } }),
    prisma.branch.deleteMany({ where: { userId } }),
  ]);
}

export async function clearAllWorkspaceData(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.idea.deleteMany(),
    prisma.todo.deleteMany(),
    prisma.branchHistoryItem.deleteMany(),
    prisma.consoleLog.deleteMany(),
    prisma.branch.deleteMany(),
  ]);
}
