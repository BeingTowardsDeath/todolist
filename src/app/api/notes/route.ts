import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { createLogBuffer, errorMessage, generateId, getSnapshot, toNote } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import type { NoteColor } from '@/types';

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

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const color = searchParams.get('color');
    const pinned = searchParams.get('pinned');
    const q = searchParams.get('q');
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

    const where: Prisma.NoteWhereInput = { userId: user.id };
    if (isNoteColor(color)) {
      where.color = color;
    }
    if (pinned === 'true' || pinned === 'false') {
      where.isPinned = pinned === 'true';
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.note.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }, { seq: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.note.count({ where }),
    ]);

    return NextResponse.json({
      data: rows.map(toNote),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '获取记事失败') },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = (await request.json()) as {
      title?: string;
      content?: string;
      color?: NoteColor;
    };
    const rawTitle = body.title?.trim() ?? '';
    const content = body.content?.trim() ?? '';
    const color = isNoteColor(body.color) ? body.color : 'default';

    if (!rawTitle && !content) {
      return NextResponse.json({ error: '请填写记事内容。' }, { status: 400 });
    }

    const title = deriveNoteTitle(rawTitle, content);

    await prisma.$transaction(async (tx) => {
      const logs = createLogBuffer(user.id);
      const now = new Date().toISOString();

      await tx.note.create({
        data: {
          id: generateId(),
          userId: user.id,
          title,
          content,
          color,
          isPinned: false,
          createdAt: now,
          updatedAt: now,
        },
      });

      logs.push('info', `已新增记事："${title}"`);
      await tx.consoleLog.createMany({ data: logs.items });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '创建记事失败') },
      { status: 500 }
    );
  }
}
