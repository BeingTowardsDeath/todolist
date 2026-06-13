import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { errorMessage, generateId, getSnapshot, toIdea, createLogBuffer } from '@/lib/db';
import { prisma } from '@/lib/prisma';

const deriveIdeaTitle = (title: string, content: string): string => {
  if (title) {
    return title;
  }

  const compactContent = content.replace(/\s+/g, ' ').trim();
  return compactContent.slice(0, 36) || '未命名想法';
};

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const q = searchParams.get('q');
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

    const where: Prisma.IdeaWhereInput = { userId: user.id };
    if (status === 'open' || status === 'archived') {
      where.status = status;
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.idea.findMany({
        where,
        orderBy: { seq: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.idea.count({ where }),
    ]);

    return NextResponse.json({
      data: rows.map(toIdea),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '获取想法失败') },
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

    const body = (await request.json()) as { title?: string; content?: string };
    const rawTitle = body.title?.trim() ?? '';
    const content = body.content?.trim() ?? '';

    if (!rawTitle && !content) {
      return NextResponse.json({ error: '请填写想法内容。' }, { status: 400 });
    }

    const title = deriveIdeaTitle(rawTitle, content);

    await prisma.$transaction(async (tx) => {
      const logs = createLogBuffer(user.id);
      const now = new Date().toISOString();

      await tx.idea.create({
        data: {
          id: generateId(),
          userId: user.id,
          title,
          content,
          status: 'open',
          createdAt: now,
          updatedAt: now,
        },
      });

      logs.push('info', `已记录想法："${title}"`);
      await tx.consoleLog.createMany({ data: logs.items });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '创建想法失败') },
      { status: 500 }
    );
  }
}
