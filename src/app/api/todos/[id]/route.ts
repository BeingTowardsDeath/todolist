import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import {
  getSnapshot,
  errorMessage,
  generateId,
  getTimestamp,
  createLogBuffer,
  toTodo,
} from '@/lib/db';
import type { Todo } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const todo = await prisma.todo.findFirst({ where: { id, userId: user.id } });
    if (!todo) {
      return NextResponse.json({ error: '任务不存在。' }, { status: 404 });
    }

    return NextResponse.json(toTodo(todo));
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '获取任务失败') },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const body = (await request.json()) as { updates: Partial<Todo>; createBranchName?: string };
    const { updates, createBranchName } = body;

    const existing = await prisma.todo.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: '任务不存在。' }, { status: 404 });
    }

    const current = toTodo(existing);

    await prisma.$transaction(async (tx) => {
      const logs = createLogBuffer(user.id);
      let finalBranchId = updates.branchId;

      if (createBranchName && updates.category === 'dev') {
        const newBranchId = generateId();
        const linkedTitle = updates.title || current.title;
        await tx.branch.create({
          data: {
            id: newBranchId,
            userId: user.id,
            name: createBranchName,
            impact: linkedTitle,
            base: 'master',
            status: 'Draft',
            history: {
              create: {
                id: 'h-' + generateId(),
                timestamp: new Date().toISOString(),
                action: '创建分支',
                details: `基于关联任务 "${linkedTitle}" 从 master 动态创建。`,
              },
            },
          },
        });
        finalBranchId = newBranchId;

        logs.push('command', `git checkout -b ${createBranchName}`);
        logs.push('success', `已从 master 创建本地分支 '${createBranchName}'。`);
        logs.push('info', `已自动将任务 "${linkedTitle}" 关联到 '${createBranchName}'。`);
      }

      const updateKeys = Object.keys(updates) as Array<keyof Todo>;
      for (const field of updateKeys) {
        if (field === 'branchId') {
          const resolvedId = finalBranchId !== undefined ? finalBranchId : updates.branchId ?? null;
          const oldBranchName = current.branchId
            ? (await tx.branch.findFirst({ where: { id: current.branchId, userId: user.id } }))?.name ?? '无'
            : '无';
          const newBranchName = resolvedId
            ? (await tx.branch.findFirst({ where: { id: resolvedId, userId: user.id } }))?.name ?? '无'
            : '无';

          if (oldBranchName !== newBranchName) {
            logs.push('info', `任务 "${current.title}" 的分支关联已更新：${oldBranchName} -> ${newBranchName}`);
          }
        } else if (current[field] !== updates[field]) {
          logs.push(
            'info',
            `任务 "${current.title}" 的 ${field} 已更新：${current[field]} -> ${updates[field]}`
          );

          if (field === 'status' && updates.status === 'done' && current.branchId) {
            const branch = await tx.branch.findFirst({
              where: { id: current.branchId, userId: user.id },
            });
            if (branch && !branch.pro) {
              logs.push('warning', `关联分支 '${branch.name}' 的任务已标记完成，可准备发布到 PROD。`);
            }
          }
        }
      }

      const scalarUpdates = { ...updates };
      delete scalarUpdates.branchId;
      const linkedBranch = finalBranchId
        ? await tx.branch.findFirst({ where: { id: finalBranchId, userId: user.id } })
        : null;
      const data: Prisma.TodoUncheckedUpdateInput = {
        ...scalarUpdates,
        branchId: finalBranchId !== undefined ? linkedBranch?.id ?? null : current.branchId,
      };
      await tx.todo.update({ where: { id }, data });

      await tx.consoleLog.createMany({ data: logs.items });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '更新任务失败') },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { id } = await params;
    const existing = await prisma.todo.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: '任务不存在。' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.todo.delete({ where: { id } });
      await tx.consoleLog.create({
        data: {
          id: generateId(),
          userId: user.id,
          timestamp: getTimestamp(),
          type: 'info',
          text: `已删除任务："${existing.title}"`,
        },
      });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '删除任务失败') },
      { status: 500 }
    );
  }
}
