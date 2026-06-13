import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { getSnapshot, errorMessage, toLog, generateId, getTimestamp } from '@/lib/db';
import type { ConsoleLog } from '@/types';

// GET /api/logs — paginated log list, optional ?type= filter.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize')) || 50));

    const where: Prisma.ConsoleLogWhereInput = { userId: user.id };
    if (type) where.type = type;

    const [rows, total] = await Promise.all([
      prisma.consoleLog.findMany({
        where,
        orderBy: { seq: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.consoleLog.count({ where }),
    ]);

    return NextResponse.json({
      data: rows.map(toLog),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '获取日志失败') },
      { status: 500 }
    );
  }
}

// POST /api/logs — append a single log entry.
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { type, text } = (await request.json()) as { type: ConsoleLog['type']; text: string };

    await prisma.consoleLog.create({
      data: {
        id: generateId(),
        userId: user.id,
        timestamp: getTimestamp(),
        type,
        text,
      },
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '新增日志失败') },
      { status: 500 }
    );
  }
}

// DELETE /api/logs — clear all logs.
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    await prisma.consoleLog.deleteMany({ where: { userId: user.id } });
    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '清空日志失败') },
      { status: 500 }
    );
  }
}
