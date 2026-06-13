import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { getSnapshot, errorMessage, generateId, getTimestamp } from '@/lib/db';
import type { Todo } from '@/types';

// PATCH /api/todos/batch — bulk operations on multiple tasks.
// Body: { action: 'updateStatus', ids: string[], status: Todo['status'] }
//     | { action: 'delete', ids: string[] }
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = (await request.json()) as {
      action: 'updateStatus' | 'delete';
      ids: string[];
      status?: Todo['status'];
    };
    const { action, ids, status } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids 必须是非空数组。' }, { status: 400 });
    }
    if (action !== 'updateStatus' && action !== 'delete') {
      return NextResponse.json({ error: '不支持的批量操作。' }, { status: 400 });
    }
    if (action === 'updateStatus' && !status) {
      return NextResponse.json({ error: '批量更新状态时必须提供 status。' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const matched = await tx.todo.findMany({
        where: { id: { in: ids }, userId: user.id },
        select: { id: true },
      });
      const matchedCount = matched.length;
      const matchedIds = matched.map((todo) => todo.id);

      if (action === 'updateStatus' && status) {
        await tx.todo.updateMany({ where: { id: { in: matchedIds }, userId: user.id }, data: { status } });
        await tx.consoleLog.create({
          data: {
            id: generateId(),
            userId: user.id,
            timestamp: getTimestamp(),
            type: 'info',
            text: `已批量更新 ${matchedCount} 个任务的状态为 ${status}。`,
          },
        });
      } else if (action === 'delete') {
        await tx.todo.deleteMany({ where: { id: { in: matchedIds }, userId: user.id } });
        await tx.consoleLog.create({
          data: {
            id: generateId(),
            userId: user.id,
            timestamp: getTimestamp(),
            type: 'warning',
            text: `已批量删除 ${matchedCount} 个任务。`,
          },
        });
      }
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '执行批量操作失败') },
      { status: 500 }
    );
  }
}
