import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { createLogBuffer, errorMessage, generateId, getSnapshot, getTimestamp, toNote } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import type { Note, NoteColor, NoteUpdateInput } from '@/types';

const noteColors: readonly NoteColor[] = ['default', 'blue', 'green', 'yellow', 'rose'];

const isNoteColor = (color: unknown): color is NoteColor =>
  typeof color === 'string' && noteColors.includes(color as NoteColor);

const deriveNoteTitle = (title: string, content: string): string => {
  if (title) {
    return title;
  }

  const compactContent = content.replace(/\s+/g, ' ').trim();
  return compactContent.slice(0, 40) || '未命名记事';
};

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
    const note = await prisma.note.findFirst({ where: { id, userId: user.id } });
    if (!note) {
      return NextResponse.json({ error: '记事不存在。' }, { status: 404 });
    }

    return NextResponse.json(toNote(note));
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '获取记事失败') },
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
    const body = (await request.json()) as { updates?: NoteUpdateInput };
    const updates = body.updates ?? {};
    const existing = await prisma.note.findFirst({ where: { id, userId: user.id } });

    if (!existing) {
      return NextResponse.json({ error: '记事不存在。' }, { status: 404 });
    }

    const candidateTitle = updates.title !== undefined ? updates.title.trim() : existing.title;
    const candidateContent = updates.content !== undefined ? updates.content.trim() : existing.content;

    if (!candidateTitle && !candidateContent) {
      return NextResponse.json({ error: '请至少保留标题或内容。' }, { status: 400 });
    }

    const updateData: {
      title?: string;
      content?: string;
      color?: Note['color'];
      isPinned?: boolean;
      updatedAt: string;
    } = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.title !== undefined) {
      updateData.title = deriveNoteTitle(candidateTitle, candidateContent);
    }
    if (updates.content !== undefined) {
      updateData.content = candidateContent;
    }
    if (updates.color !== undefined) {
      if (!isNoteColor(updates.color)) {
        return NextResponse.json({ error: '记事颜色无效。' }, { status: 400 });
      }
      updateData.color = updates.color;
    }
    if (updates.isPinned !== undefined) {
      if (typeof updates.isPinned !== 'boolean') {
        return NextResponse.json({ error: '置顶状态无效。' }, { status: 400 });
      }
      updateData.isPinned = updates.isPinned;
    }

    await prisma.$transaction(async (tx) => {
      const logs = createLogBuffer(user.id);
      await tx.note.update({ where: { id }, data: updateData });

      if (updateData.isPinned !== undefined && updateData.isPinned !== existing.isPinned) {
        const action = updateData.isPinned ? '置顶' : '取消置顶';
        logs.push('info', `已${action}记事："${existing.title}"`);
      } else {
        logs.push('info', `已更新记事："${updateData.title ?? existing.title}"`);
      }

      await tx.consoleLog.createMany({ data: logs.items });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '更新记事失败') },
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
    const existing = await prisma.note.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: '记事不存在。' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.note.delete({ where: { id } });
      await tx.consoleLog.create({
        data: {
          id: generateId(),
          userId: user.id,
          timestamp: getTimestamp(),
          type: 'info',
          text: `已删除记事："${existing.title}"`,
        },
      });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '删除记事失败') },
      { status: 500 }
    );
  }
}
