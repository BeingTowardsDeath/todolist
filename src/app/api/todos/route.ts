import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { getSnapshot, errorMessage, generateId, createLogBuffer, toTodo } from '@/lib/db';
import type { Todo } from '@/types';

// GET /api/todos — paginated task list with optional filters.
// Query: ?status= &category= &priority= &branchId= (or "none") &q= &page= &pageSize=
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const branchId = searchParams.get('branchId');
    const q = searchParams.get('q');
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

    const where: Prisma.TodoWhereInput = { userId: user.id };
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (branchId) where.branchId = branchId === 'none' ? null : branchId;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.todo.findMany({
        where,
        orderBy: { seq: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.todo.count({ where }),
    ]);

    return NextResponse.json({
      data: rows.map(toTodo),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '获取任务失败') },
      { status: 500 }
    );
  }
}

// POST /api/todos — create a task, optionally spinning up a linked dev branch.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = (await request.json()) as {
      title: string;
      description: string;
      category: Todo['category'];
      priority: Todo['priority'];
      status: Todo['status'];
      branchId: string | null;
      dueDate: string;
      createBranchName?: string;
    };
    const { title, description, category, priority, status, branchId, dueDate, createBranchName } = body;

    await prisma.$transaction(async (tx) => {
      const logs = createLogBuffer(user.id);
      let finalBranchId: string | null = branchId ?? null;

      if (finalBranchId) {
        const linkedBranch = await tx.branch.findFirst({
          where: { id: finalBranchId, userId: user.id },
          select: { id: true },
        });
        finalBranchId = linkedBranch ? finalBranchId : null;
      }

      if (createBranchName && category === 'dev') {
        const newBranchId = generateId();
        await tx.branch.create({
          data: {
            id: newBranchId,
            userId: user.id,
            name: createBranchName,
            impact: title,
            base: 'master',
            status: 'Draft',
            history: {
              create: {
                id: 'h-' + generateId(),
                timestamp: new Date().toISOString(),
                action: '创建分支',
                details: `基于关联任务 "${title}" 从 master 动态创建。`,
              },
            },
          },
        });
        finalBranchId = newBranchId;

        logs.push('command', `git checkout -b ${createBranchName}`);
        logs.push('success', `已从 master 创建本地分支 '${createBranchName}'。`);
        logs.push('info', `已自动将任务 "${title}" 关联到 '${createBranchName}'。`);
      }

      await tx.todo.create({
        data: {
          id: generateId(),
          userId: user.id,
          title,
          description,
          category,
          priority,
          status,
          branchId: finalBranchId,
          dueDate,
          createdAt: new Date().toISOString(),
        },
      });

      logs.push(
        'info',
        `已创建任务 [${category.toUpperCase()}]："${title}" [优先级：${priority.toUpperCase()}]`
      );

      await tx.consoleLog.createMany({ data: logs.items });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '创建任务失败') },
      { status: 500 }
    );
  }
}
