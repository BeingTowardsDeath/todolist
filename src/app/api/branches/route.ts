import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { getSnapshot, errorMessage, generateId, createLogBuffer, toBranch } from '@/lib/db';
import type { Branch } from '@/types';

// GET /api/branches — paginated list with filters.
// Query: ?q= &env=dev|qa|uat|pro|none &type= &status= &page= &pageSize=
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const env = searchParams.get('env');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize')) || 20));

    const where: Prisma.BranchWhereInput = { userId: user.id };
    if (status) where.status = status;
    if (type) where.type = type;
    if (env === 'dev') where.dev = true;
    else if (env === 'qa') where.qa = true;
    else if (env === 'uat') where.uat = true;
    else if (env === 'pro') where.pro = true;
    else if (env === 'none') where.AND = [{ dev: false }, { qa: false }, { uat: false }, { pro: false }];
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { impact: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        orderBy: { seq: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { history: { orderBy: { seq: 'asc' } } },
      }),
      prisma.branch.count({ where }),
    ]);

    return NextResponse.json({
      data: rows.map(toBranch),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '获取分支失败') },
      { status: 500 }
    );
  }
}

// POST /api/branches
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = (await request.json()) as {
      name: string;
      impact: string;
      base: string;
      status: Branch['status'];
      type?: Branch['type'];
    };
    const { name, impact, base, status, type } = body;

    await prisma.$transaction(async (tx) => {
      const logs = createLogBuffer(user.id);
      const branchId = generateId();

      await tx.branch.create({
        data: {
          id: branchId,
          userId: user.id,
          name,
          impact,
          base,
          status,
          type: type ?? null,
          history: {
            create: {
              id: 'h-' + generateId(),
              timestamp: new Date().toISOString(),
              action: '创建分支',
              details: `基于 ${base || 'master'} 创建${type ? `（类型：${type}）` : ''}`,
            },
          },
        },
      });

      logs.push('command', `git branch ${name} ${base}`);
      logs.push('success', `已基于 '${base}' 创建分支 '${name}'。`);

      await tx.consoleLog.createMany({ data: logs.items });
    });

    const snapshot = await getSnapshot(user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '创建分支失败') },
      { status: 500 }
    );
  }
}
