import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { createLogBuffer, errorMessage, generateId, getSnapshot, getTimestamp, toIdea } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import type { Idea, IdeaUpdateInput } from '@/types';

const isIdeaStatus = (status: unknown): status is Idea['status'] =>
  status === 'open' || status === 'archived';

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
    const idea = await prisma.idea.findFirst({ where: { id, userId: user.id } });
    if (!idea) {
      return NextResponse.json({ error: '想法不存在。' }, { status: 404 });
    }

    return NextResponse.json(toIdea(idea));
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '获取想法失败') },
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
    const body = (await request.json()) as { updates?: IdeaUpdateInput };
    const updates = body.updates ?? {};
    const existing = await prisma.idea.findFirst({ where: { id, userId: user.id } });

    if (!existing) {
      return NextResponse.json({ error: '想法不存在。' }, { status: 404 });
    }

    const nextTitle = updates.title?.trim();
    const nextContent = updates.content?.trim();
    const updateData: {
      title?: string;
      content?: string;
      status?: Idea['status'];
      updatedAt: string;
    } = {
      updatedAt: new Date().toISOString(),
    };

    if (nextTitle !== undefined) {
      updateData.title = nextTitle || existing.title;
    }
    if (nextContent !== undefined) {
      updateData.content = nextContent;
    }
    if (updates.status !== undefined) {
      if (!isIdeaStatus(updates.status)) {
        return NextResponse.json({ error: '想法状态无效。' }, { status: 400 });
      }
      updateData.status = updates.status;
    }

    await prisma.$transaction(async (tx) => {
      const logs = createLogBuffer(user.id);
      await tx.idea.update({ where: { id }, data: updateData });

      if (updateData.status && updateData.status !== existing.status) {
        const action = updateData.status === 'archived' ? '归档' : '恢复';
        logs.push('info', `已${action}想法："${existing.title}"`);
      } else {
        logs.push('info', `已更新想法："${updateData.title ?? existing.title}"`);
      }

      await tx.consoleLog.createMany({ data: logs.items });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '更新想法失败') },
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
    const existing = await prisma.idea.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: '想法不存在。' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.idea.delete({ where: { id } });
      await tx.consoleLog.create({
        data: {
          id: generateId(),
          userId: user.id,
          timestamp: getTimestamp(),
          type: 'info',
          text: `已删除想法："${existing.title}"`,
        },
      });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '删除想法失败') },
      { status: 500 }
    );
  }
}
