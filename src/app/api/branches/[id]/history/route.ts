import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, unauthorizedResponse } from '@/lib/auth';
import { errorMessage, toHistoryItem } from '@/lib/db';

// GET /api/branches/[id]/history — history timeline for a single branch.
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
    const branch = await prisma.branch.findFirst({
      where: { id, userId: user.id },
      include: { history: { orderBy: { seq: 'asc' } } },
    });
    if (!branch) {
      return NextResponse.json({ error: '分支不存在。' }, { status: 404 });
    }
    return NextResponse.json({
      branchId: branch.id,
      branchName: branch.name,
      history: branch.history.map(toHistoryItem),
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, '获取分支历史失败') },
      { status: 500 }
    );
  }
}
