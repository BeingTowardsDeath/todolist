import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { errorMessage } from '@/lib/db';

const countBy = <T>(items: T[], getKey: (item: T) => string): Record<string, number> =>
  items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

// GET /api/stats — aggregate dashboard metrics for tasks and branches.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const [todos, branches] = await Promise.all([
      prisma.todo.findMany({ where: { userId: user.id } }),
      prisma.branch.findMany({ where: { userId: user.id } }),
    ]);

    return NextResponse.json({
      tasks: {
        total: todos.length,
        completed: todos.filter((todo) => todo.status === 'done').length,
        byStatus: countBy(todos, (todo) => todo.status),
        byPriority: countBy(todos, (todo) => todo.priority),
        byCategory: countBy(todos, (todo) => todo.category),
      },
      branches: {
        total: branches.length,
        byStatus: countBy(branches, (branch) => branch.status),
        byType: countBy(branches, (branch) => branch.type ?? 'None'),
        deployments: {
          dev: branches.filter((branch) => branch.dev).length,
          qa: branches.filter((branch) => branch.qa).length,
          uat: branches.filter((branch) => branch.uat).length,
          pro: branches.filter((branch) => branch.pro).length,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '计算统计数据失败') },
      { status: 500 }
    );
  }
}
